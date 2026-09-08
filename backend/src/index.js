const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const pool = require('./db/pool');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const fireRoutes = require('./routes/fireRoutes');
const unitRoutes = require('./routes/unitRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const onlineRoutes = require('./routes/onlineRoutes');
const { verifyToken } = require('./utils/jwt');
const { touchSession } = require('./services/authService');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // В продакшене замени на реальный домен
        methods: ['GET', 'POST'],
    },
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Подключаем роуты
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fires', fireRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/online', onlineRoutes);
app.use('/api/departments', departmentRoutes);

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- Socket.IO -----
// Middleware для аутентификации сокетов
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Токен не предоставлен'));
    }
    const decoded = verifyToken(token);
    if (!decoded) {
        return next(new Error('Недействительный токен'));
    }
    // Проверяем сессию в БД
    const session = await pool.query(
        'SELECT user_id FROM sessions WHERE token = $1',
        [token]
    );
    if (!session.rows.length) {
        return next(new Error('Сессия не найдена'));
    }
    // Обновляем last_active_at
    await touchSession(token);
    // Сохраняем пользователя в socket
    const userResult = await pool.query(
        'SELECT id, username, role, can_view_all FROM users WHERE id = $1',
        [session.rows[0].user_id]
    );
    if (!userResult.rows.length) {
        return next(new Error('Пользователь не найден'));
    }
    socket.user = userResult.rows[0];
    socket.token = token;
    next();
});

io.on('connection', (socket) => {
    console.log(`Пользователь ${socket.user.username} подключился`);

    // Отправляем всем обновлённый список онлайн-пользователей
    broadcastOnlineUsers();

    // При отключении
    socket.on('disconnect', () => {
        console.log(`Пользователь ${socket.user.username} отключился`);
        broadcastOnlineUsers();
    });
});

// Функция для рассылки списка онлайн-пользователей
async function broadcastOnlineUsers() {
    try {
        const result = await pool.query(`
      SELECT 
        u.id, u.username, u.role,
        s.last_active_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.last_active_at > NOW() - INTERVAL '5 minutes'
      ORDER BY s.last_active_at DESC
    `);
        io.emit('online_users', result.rows);
    } catch (err) {
        console.error('Ошибка получения онлайн-пользователей:', err.message);
    }
}

// Делаем io доступным для контроллеров (чтобы отправлять force_refresh)
app.set('io', io);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});