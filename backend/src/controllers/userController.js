const userService = require('../services/userService');
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

const getAllUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userService.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения пользователя' });
    }
};

const createUser = async (req, res) => {
    try {
        const { error, value } = createUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const newUser = await userService.createUser(value);
        // Убираем пароль из ответа
        const { password_hash, ...userWithoutPassword } = newUser;
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(userWithoutPassword);
    } catch (err) {
        // Обработка дубликата username
        if (err.code === '23505' && err.constraint === 'users_username_key') {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }
        res.status(500).json({ error: 'Ошибка создания пользователя' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const updated = await userService.updateUser(id, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!updated) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(updated);
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'users_username_key') {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }
        res.status(500).json({ error: 'Ошибка обновления пользователя' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await userService.deleteUser(id);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!deleted) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка удаления пользователя' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
};