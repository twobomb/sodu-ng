const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const pool = require('./db/pool');
const logger = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const fireRoutes = require('./routes/fireRoutes');
const unitRoutes = require('./routes/unitRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const onlineRoutes = require('./routes/onlineRoutes');
const roleRoutes = require('./routes/roleRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const messageRoutes = require('./routes/messageRoutes');
const chatRoutes = require('./routes/chatRoutes');

const { verifyToken } = require('./utils/jwt');
const { touchSession } = require('./services/authService');
const chatService = require('./services/chatService');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// ----- Роуты -----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fires', fireRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/online', onlineRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat', messageRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Socket.IO
// ============================================================
// Реестр активных socket-соединений: userId -> Set<socketId>
const onlineSockets = new Map();

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Токен не предоставлен'));

        const decoded = verifyToken(token);
        if (!decoded) return next(new Error('Недействительный токен'));

        const session = await pool.query(
            'SELECT user_id FROM sessions WHERE token = $1',
            [token]
        );
        if (!session.rows.length) return next(new Error('Сессия не найдена'));

        await touchSession(token);

        const userResult = await pool.query(
            `SELECT u.id, u.username, u.role, u.can_view_all,
                    r.permissions, r.name AS role_name
             FROM users u
                      LEFT JOIN roles r ON u.role = r.code
             WHERE u.id = $1`,
            [session.rows[0].user_id]
        );
        if (!userResult.rows.length) return next(new Error('Пользователь не найден'));

        socket.user = userResult.rows[0];
        socket.token = token;
        next();
    } catch (err) {
        logger.error('Ошибка авторизации сокета: ' + err.message);
        next(new Error('Ошибка авторизации'));
    }
});

io.on('connection', async (socket) => {
    const uid = socket.user.id;
    logger.info(`Socket подключён: ${socket.user.username} (${socket.id})`);

    // Регистрация онлайн
    if (!onlineSockets.has(uid)) onlineSockets.set(uid, new Set());
    onlineSockets.get(uid).add(socket.id);

    // Личная комната (для force_logout, session_replaced и т.п.)
    socket.join(`user:${uid}`);

    // ============================================================
    // Bootstrap: общий канал + избранное + chat-профиль
    // ============================================================
    try {
        await chatService.bootstrapUser(uid);
    } catch (err) {
        logger.error('Ошибка bootstrapUser при подключении сокета: ' + err.message);
    }

    // ============================================================
    // Автоматически подписываем на все чаты пользователя
    // ============================================================
    try {
        const memberRes = await pool.query(
            `SELECT conversation_id FROM conversation_members WHERE user_id = $1`,
            [uid]
        );
        for (const row of memberRes.rows) {
            socket.join(`conversation:${row.conversation_id}`);
        }
        logger.info(
            `Socket ${socket.id} подписан на ${memberRes.rows.length} чатов`
        );
    } catch (err) {
        logger.error('Ошибка подписки на чаты: ' + err.message);
    }

    broadcastOnlineUsers();

    // ============================================================
    // chat:join — подписаться на комнату чата
    // ============================================================
    socket.on('chat:join', async ({ conversationId }, ack) => {
        try {
            if (!conversationId) return ack?.({ ok: false, error: 'No id' });

            const member = await pool.query(
                `SELECT 1 FROM conversation_members
         WHERE conversation_id = $1 AND user_id = $2`,
                [conversationId, uid]
            );
            if (!member.rows.length) {
                return ack?.({ ok: false, error: 'Not a member' });
            }

            socket.join(`conversation:${conversationId}`);
            ack?.({ ok: true });
        } catch (err) {
            logger.error('chat:join ошибка: ' + err.message);
            ack?.({ ok: false });
        }
    });

    // ============================================================
    // chat:leave — выйти из комнаты чата
    // ============================================================
    socket.on('chat:leave', ({ conversationId }) => {
        if (conversationId) {
            socket.leave(`conversation:${conversationId}`);
        }
    });

    // ============================================================
    // chat:typing — кто-то печатает
    // ============================================================
    socket.on('chat:typing', ({ conversationId, isTyping }) => {
        if (!conversationId) return;
        socket.to(`conversation:${conversationId}`).emit('chat:typing', {
            conversation_id: conversationId,
            user_id: uid,
            username: socket.user.username,
            is_typing: !!isTyping,
        });
    });

    // ============================================================
    // chat:read — пометить чат как прочитанный
    // ============================================================
    socket.on('chat:read', async ({ conversationId, messageId }, ack) => {
        if (!conversationId) return ack?.({ ok: false });

        try {
            const member = await pool.query(
                `SELECT 1 FROM conversation_members
                 WHERE conversation_id = $1 AND user_id = $2`,
                [conversationId, uid]
            );
            if (!member.rows.length) return ack?.({ ok: false });

            await pool.query(
                `INSERT INTO message_reads (conversation_id, user_id, last_read_message_id, last_read_at)
                 VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (conversation_id, user_id) DO UPDATE
                                                                   SET last_read_message_id = COALESCE($3, message_reads.last_read_message_id),
                                                                   last_read_at = NOW()`,
                [conversationId, uid, messageId || null]
            );

            await pool.query(
                `UPDATE conversation_members
                 SET last_read_at = NOW()
                 WHERE conversation_id = $1 AND user_id = $2`,
                [conversationId, uid]
            );

            io.to(`conversation:${conversationId}`).emit('chat:read', {
                conversation_id: conversationId,
                user_id: uid,
                last_read_message_id: messageId || null,
                last_read_at: new Date().toISOString(),
            });

            ack?.({ ok: true });
        } catch (err) {
            logger.error('chat:read ошибка: ' + err.message);
            ack?.({ ok: false });
        }
    });

    // ============================================================
    // disconnect
    // ============================================================
    socket.on('disconnect', async () => {
        logger.info(`Socket отключён: ${socket.user.username} (${socket.id})`);

        const set = onlineSockets.get(uid);
        if (set) {
            set.delete(socket.id);
            if (set.size === 0) {
                onlineSockets.delete(uid);
                try {
                    await pool.query(
                        `UPDATE sessions
                         SET last_active_at = NOW() - INTERVAL '10 minutes'
                         WHERE user_id = $1`,
                        [uid]
                    );
                } catch (err) {
                    logger.error('Ошибка обновления last_active_at: ' + err.message);
                }
            }
        }

        broadcastOnlineUsers();
    });
});

// ============================================================
// broadcastOnlineUsers
// ============================================================
async function broadcastOnlineUsers() {
    try {
        const activeIds = Array.from(onlineSockets.keys());
        if (activeIds.length === 0) {
            io.emit('online_users', []);
            return;
        }

        const result = await pool.query(
            `SELECT
                 u.id, u.username, u.role, r.name AS role_name,
                 MAX(s.last_active_at) AS last_active_at
             FROM users u
                      LEFT JOIN roles r ON u.role = r.code
                      LEFT JOIN sessions s ON s.user_id = u.id
             WHERE u.id = ANY($1::uuid[])
             GROUP BY u.id, u.username, u.role, r.name
             ORDER BY MAX(s.last_active_at) DESC NULLS LAST`,
            [activeIds]
        );

        io.emit('online_users', result.rows);
    } catch (err) {
        logger.error('Ошибка broadcastOnlineUsers: ' + err.message);
    }
}

app.set('io', io);

// 404 и обработка ошибок — ОБЯЗАТЕЛЬНО в конце
app.use(notFoundHandler);
app.use(errorHandler);

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

// Ловим необработанные ошибки на уровне процесса
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection: ' + reason);
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception: ' + err.message, { stack: err.stack });
});