const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');
const pool = require('../db/pool');

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

/**
 * Возвращает пользователя по id или null.
 */
const fetchUserById = async (id) => {
    const res = await pool.query(
        'SELECT id, username, role, is_blocked FROM users WHERE id = $1',
        [id]
    );
    return res.rows[0] || null;
};

/**
 * Проверяет, может ли актор менять этого пользователя.
 * - developer может менять только себя
 * - developer не может быть изменён ни кем другим
 */
const canManageTargetUser = (actor, target) => {
    if (!target) return { ok: false, reason: 'not_found' };

    if (target.role === 'developer') {
        if (actor.id !== target.id) {
            return { ok: false, reason: 'developer_protected' };
        }
    }
    return { ok: true };
};

/**
 * Сообщения для ошибок защиты developer.
 */
const PROTECT_MESSAGES = {
    not_found: 'Пользователь не найден',
    developer_protected:
        'Пользователя с ролью «Разработчик» может изменять только он сам',
};
/**
 * Проверяет, что роль с таким кодом существует в БД.
 */
const validateRoleExists = async (roleCode) => {
    const res = await pool.query(
        'SELECT code FROM roles WHERE code = $1',
        [roleCode]
    );
    return res.rows.length > 0;
};

// ============================================================
// СХЕМЫ ВАЛИДАЦИИ
// ============================================================
const createUserSchema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().max(50).required(),
    can_view_all: Joi.boolean().default(false),
    departmentIds: Joi.array().items(Joi.string().uuid()).default([]),
});

const updateUserSchema = Joi.object({
    username: Joi.string().min(3).max(50),
    password: Joi.string().min(6),
    role: Joi.string().max(50),
    can_view_all: Joi.boolean(),
    departmentIds: Joi.array().items(Joi.string().uuid()),
});

// ============================================================
// ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================
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

// ============================================================
// ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ПО ID
// ============================================================
const getUserById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userService.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (err) {
        logger.error(
            `Ошибка получения пользователя ${req.params.id}: ` + err.message,
            {
                stack: err.stack,
                user: req.user?.id,
            }
        );
        res.status(500).json({ error: 'Ошибка получения пользователя' });
    }
});

// ============================================================
// СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const createUser = asyncHandler(async (req, res) => {
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

        // Проверяем, что роль существует
        const roleExists = await validateRoleExists(value.role);
        if (!roleExists) {
            return res.status(400).json({ error: 'Указанная роль не найдена' });
        }
    if (value.role === 'developer') {
        return res.status(403).json({
            error: 'Роль «Разработчик» нельзя назначить через интерфейс',
        });
    }

    try {
        const newUser = await userService.createUser(value);

        // Убираем пароль из ответа
        const { password_hash, ...userWithoutPassword } = newUser;

        const io = req.app.get('io');
        emitForceRefresh(io);

        logger.info(`Пользователь создан: ${newUser.username} (${newUser.role})`, {
            by: req.user?.id,
        });

        res.status(201).json(userWithoutPassword);
    } catch (err) {
        logger.error('Ошибка создания пользователя: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        if (err.code === '23505' && err.constraint === 'users_username_key') {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }
        res
            .status(500)
            .json({ error: err.message || 'Ошибка создания пользователя' });
    }
});

// ============================================================
// ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = updateUserSchema.validate(req.body);

    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const target = await fetchUserById(id);
        const check = canManageTargetUser(req.user, target);
        if (!check.ok) {
            const status = check.reason === 'not_found' ? 404 : 403;
            return res.status(status).json({ error: PROTECT_MESSAGES[check.reason] });
        }
    // Проверяем роль, если она меняется
            if (value.role !== undefined) {
                const roleExists = await validateRoleExists(value.role);
                if (!roleExists) {
                    return res.status(400).json({ error: 'Указанная роль не найдена' });
                }
            }
        // Нельзя назначить роль developer через API
        if (value.role === 'developer' && target.role !== 'developer') {
            return res.status(403).json({
                error: 'Роль «Разработчик» нельзя назначить через интерфейс',
            });
        }

        // Нельзя "понизить" себя с developer до другой роли
        if (
            target.role === 'developer' &&
            target.id === req.user.id &&
            value.role &&
            value.role !== 'developer'
        ) {
            return res.status(403).json({
                error: 'Вы не можете изменить свою роль «Разработчик»',
            });
        }

        const updated = await userService.updateUser(id, value);

        if (!updated) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        logger.info(`Пользователь обновлён: ${updated.username}`, {
            userId: id,
            by: req.user?.id,
        });

        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления пользователя ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        if (err.code === '23505' && err.constraint === 'users_username_key') {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }
        res
            .status(500)
            .json({ error: err.message || 'Ошибка обновления пользователя' });
    }
});

// ============================================================
// УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const target = await fetchUserById(id);
        if (!target) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Developer нельзя удалить даже самому себе
        if (target.role === 'developer') {
            return res
                .status(403)
                .json({ error: 'Пользователя с ролью «Разработчик» нельзя удалить' });
        }

        // Нельзя удалить самого себя
        if (target.id === req.user.id) {
            return res.status(403).json({ error: 'Нельзя удалить самого себя' });
        }

        const deleted = await userService.deleteUser(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        logger.info(`Пользователь удалён: ${target.username}`, {
            userId: id,
            by: req.user?.id,
        });

        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        logger.error(`Ошибка удаления пользователя ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res
            .status(500)
            .json({ error: err.message || 'Ошибка удаления пользователя' });
    }
});

// ============================================================
// БЛОКИРОВКА ПОЛЬЗОВАТЕЛЯ
// ============================================================
const blockUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const target = await fetchUserById(id);
        if (!target) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (target.role === 'developer') {
            return res.status(403).json({
                error: 'Пользователя с ролью «Разработчик» нельзя заблокировать',
            });
        }

        if (target.id === req.user.id) {
            return res
                .status(403)
                .json({ error: 'Нельзя заблокировать самого себя' });
        }

        const blocked = await userService.blockUser(id);
        if (!blocked) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const io = req.app.get('io');
        if (io) {
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

// ============================================================
// РАЗБЛОКИРОВКА ПОЛЬЗОВАТЕЛЯ
// ============================================================
const unblockUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const target = await fetchUserById(id);
        if (!target) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (target.role === 'developer') {
            return res.status(403).json({
                error:
                    'Пользователя с ролью «Разработчик» нельзя разблокировать (он не может быть заблокирован)',
            });
        }

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