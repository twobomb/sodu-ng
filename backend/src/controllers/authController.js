const {
    authenticateUser,
    changeOwnPassword,
    createSession,
    deleteSessionByToken,
} = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const pool = require('../db/pool');
const settingsService = require('../services/settingsService');
const securityService = require('../services/securityService');
const loginHistoryService = require('../services/loginHistoryService');
const Joi = require('joi');

/**
 * POST /api/auth/login
 * Тело: { username, password }
 */
const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Требуется имя пользователя и пароль' });
    }

    try {
        const user = await authenticateUser(username, password);

        if (!user) {
            logger.warn(`Неудачная попытка входа: ${username}`, { ip: req.ip });
            return res.status(401).json({ error: 'Неверные учётные данные' });
        }

        // ---- Проверка срока действия пароля ----
        // Просроченный пароль не пускает в систему, кроме пользователей,
        // у роли которых есть право «Бессрочный пароль».
        const passwordInfo = securityService.buildPasswordInfo(user);
        if (passwordInfo.password_expired && !passwordInfo.password_never_expires) {
            logger.warn(`Попытка входа с просроченным паролем: ${username}`, {
                ip: req.ip,
            });
            return res.status(403).json({
                error: 'Срок действия пароля истёк. Обратитесь к администратору.',
                password_expired: true,
            });
        }

        // ---- Проверка режима ТО ----
        const maintenanceMode = await settingsService.get('maintenance_mode');
        if (maintenanceMode && user.role !== 'developer') {
            logger.warn(`Попытка входа во время ТО: ${username}`, { ip: req.ip });
            return res.status(503).json({
                error: 'Система на техническом обслуживании. Попробуйте позже.',
                maintenance: true,
            });
        }

        // ---- Оповещаем старые сессии о вытеснении ----
        const io = req.app.get('io');
        const roomName = `user:${user.id}`;
        const existingSessions = await pool.query(
            'SELECT id FROM sessions WHERE user_id = $1',
            [user.id]
        );

        // ВАЖНО: считаем по сокетам, а не по сессиям.
        // Сокет может остаться в комнате даже после удаления сессии из БД.
                const socketsInRoom = io?.sockets?.adapter?.rooms?.get(roomName);
                const socketsCount = socketsInRoom?.size ?? 0;

                if (socketsCount > 0 && io) {
                    io.to(roomName).emit('session_replaced', {
                        username: user.username,
                        message: 'Выполнен вход с другого устройства',
                    });

                    logger.info(
                        `Сессия пользователя ${user.username} заменена. Сокетов в комнате: ${socketsCount}, старых сессий в БД: ${existingSessions.rows.length}`,
                        { userId: user.id, ip: req.ip }
                    );
                }

        // createSession удалит старые сессии и создаст новую
                const session = await createSession(user.id);

                // ---- Логирование входа (время, пользователь, IP) ----
                // Ошибка записи истории не должна блокировать сам вход.
                try {
                    await loginHistoryService.recordLogin({
                        userId: user.id,
                        username: user.username,
                        ip: req.ip,
                    });
                } catch (e) {
                    logger.error(
                        `Ошибка записи истории входа ${user.username}: ` + e.message,
                        { stack: e.stack }
                    );
                }

        logger.info(`Успешный вход: ${user.username} (${user.role})`, {
            userId: user.id,
            ip: req.ip,
        });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                role_name: user.role_name,
                can_view_all: user.can_view_all,
                permissions: user.permissions,
                department_ids: user.department_ids || [],
                ...passwordInfo,
            },
            token: session.token,
        });
    } catch (err) {
        if (err.code === 'USER_BLOCKED') {
            logger.warn(`Попытка входа заблокированного пользователя: ${username}`, {
                ip: req.ip,
            });
            return res.status(403).json({ error: 'Пользователь заблокирован' });
        }

        logger.error(`Ошибка входа для ${username}: ` + err.message, {
            stack: err.stack,
            ip: req.ip,
        });
        res.status(500).json({ error: 'Ошибка входа' });
    }
});

/**
 * POST /api/auth/logout
 * Требуется валидный токен (будет удалён)
 */
const logout = asyncHandler(async (req, res) => {
    const token = req.token;

    try {
        if (token) {
            await deleteSessionByToken(token);
        }

        logger.info(`Выход из системы: ${req.user?.username || 'unknown'}`, {
            userId: req.user?.id,
        });

        res.json({ message: 'Успешный выход из системы' });
    } catch (err) {
        logger.error('Ошибка выхода из системы: ' + err.message, {
            stack: err.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка выхода из системы' });
    }
});

/**
 * GET /api/auth/me
 * Возвращает данные текущего пользователя (из req.user, установленного middleware)
 */
const getMe = (req, res) => {
    res.json(req.user);
};

const changePasswordSchema = Joi.object({
    current_password: Joi.string().min(1).max(200).required(),
    new_password: Joi.string().min(1).max(200).required(),
});

/**
 * POST /api/auth/change-password
 * Смена собственного пароля (доступно любому авторизованному пользователю).
 */
const changePassword = asyncHandler(async (req, res) => {
    const { error, value } = changePasswordSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        await changeOwnPassword(req.user.id, value.current_password, value.new_password);
        logger.info(`Пароль изменён: ${req.user.username}`, { userId: req.user.id });
        res.json({ ok: true });
    } catch (err) {
        // Понятные пользователю ошибки — неверный текущий пароль и слабый новый
        if (err.code === 'BAD_CURRENT_PASSWORD' || err.code === 'WEAK_PASSWORD') {
            return res.status(400).json({ error: err.message });
        }
        logger.error(`Ошибка смены пароля ${req.user?.username}: ` + err.message, {
            stack: err.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ error: 'Не удалось изменить пароль' });
    }
});

module.exports = {
    login,
    logout,
    getMe,
    changePassword,
};