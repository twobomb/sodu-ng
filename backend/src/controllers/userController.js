const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

// Схема валидации для создания
const createUserSchema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('developer', 'admin', 'dispatcher', 'viewer').required(),
    can_view_all: Joi.boolean().default(false),
    departmentIds: Joi.array().items(Joi.string().uuid()).default([]),
});

// Схема валидации для обновления (все поля опциональны)
const updateUserSchema = Joi.object({
    username: Joi.string().min(3).max(50),
    password: Joi.string().min(6),
    role: Joi.string().valid('developer', 'admin', 'dispatcher', 'viewer'),
    can_view_all: Joi.boolean(),
    departmentIds: Joi.array().items(Joi.string().uuid()),
});

// ---------- Получение всех пользователей ----------
const getAllUsers = asyncHandler(async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users);
    } catch (err) {
        logger.error('Ошибка получения пользователей: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});

// ---------- Получение пользователя по ID ----------
const getUserById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userService.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (err) {
        logger.error(`Ошибка получения пользователя ${req.params.id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения пользователя' });
    }
});

// ---------- Создание пользователя ----------
const createUser = asyncHandler(async (req, res) => {
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    if (value.role === 'developer') {
        return res.status(403).json({ error: 'Роль "Разработчик" нельзя назначить через интерфейс' });
    }
    try {
        const newUser = await userService.createUser(value);

        // Убираем пароль из ответа
        const { password_hash, ...userWithoutPassword } = newUser;

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.status(201).json(userWithoutPassword);
    } catch (err) {
        logger.error('Ошибка создания пользователя: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        // Обработка дубликата username
        if (err.code === '23505' && err.constraint === 'users_username_key') {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }
        res.status(500).json({ error: err.message || 'Ошибка создания пользователя' });
    }
});

// ---------- Обновление пользователя ----------
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = updateUserSchema.validate(req.body);


    // Сначала — валидация Joi
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    if (value.role === 'developer') {
        return res.status(403).json({ error: 'Роль "Разработчик" нельзя назначить через интерфейс' });
    }
    try {
        const updated = await userService.updateUser(id, value);

        if (!updated) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления пользователя ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        // Тут — проверка на дубликат username (ошибка от PostgreSQL)
        if (err.code === '23505' && err.constraint === 'users_username_key') {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }
        res.status(500).json({ error: err.message || 'Ошибка обновления пользователя' });
    }
});

// ---------- Удаление пользователя ----------
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const deleted = await userService.deleteUser(id);

        if (!deleted) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        logger.error(`Ошибка удаления пользователя ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления пользователя' });
    }
});
// ---------- Блокировка пользователя ----------
const blockUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const blocked = await userService.blockUser(id);
        if (!blocked) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        if (io) {
            // Заставляем всех подключённых под этим пользователем выйти
            io.to(`user:${id}`).emit('force_logout', { reason: 'blocked' });
            io.emit('force_refresh');
        }

        logger.info(`Пользователь заблокирован: ${blocked.username}`, {
            userId: id,
            by: req.user?.id,
        });

        res.json(blocked);
    } catch (err) {
        logger.error(`Ошибка блокировки пользователя ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка блокировки' });
    }
});

// ---------- Разблокировка пользователя ----------
const unblockUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const unblocked = await userService.unblockUser(id);
        if (!unblocked) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        logger.info(`Пользователь разблокирован: ${unblocked.username}`, {
            userId: id,
            by: req.user?.id,
        });

        res.json(unblocked);
    } catch (err) {
        logger.error(`Ошибка разблокировки пользователя ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка разблокировки' });
    }
});
module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
};