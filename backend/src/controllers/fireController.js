const fireService = require('../services/fireService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

// Схема для создания
const createFireSchema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
    lat: Joi.number(),
    lng: Joi.number(),
    status: Joi.string().valid('active', 'resolved', 'closed').required(),
    department_id: Joi.string().uuid().required(),
});

// Схема для обновления (все поля опциональны)
const updateFireSchema = Joi.object({
    title: Joi.string(),
    description: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
    lat: Joi.number(),
    lng: Joi.number(),
    status: Joi.string().valid('active', 'resolved', 'closed'),
    department_id: Joi.string().uuid(),
});

// ---------- Получение всех пожаров ----------
const getFires = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        const fires = await fireService.getFires(user.id, user.can_view_all);
        res.json(fires);
    } catch (err) {
        logger.error('Ошибка получения пожаров: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения пожаров' });
    }
});

// ---------- Получение пожара по ID ----------
const getFireById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const fire = await fireService.getFireById(id, user.id, user.can_view_all);
        if (!fire) {
            return res.status(404).json({ error: 'Пожар не найден или нет доступа' });
        }
        res.json(fire);
    } catch (err) {
        logger.error(`Ошибка получения пожара ${req.params.id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения пожара' });
    }
});

// ---------- Создание пожара ----------
const createFire = asyncHandler(async (req, res) => {
    const { error, value } = createFireSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const user = req.user;

        // Проверяем доступ к указанному подразделению (если не can_view_all)
        if (!user.can_view_all) {
            const userDeps = await fireService.getUserDepartments(user.id, false);
            if (!userDeps.includes(value.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к данному подразделению' });
            }
        }

        const newFire = await fireService.createFire(value, user.id);
        const io = req.app.get('io');
        emitForceRefresh(io);

        res.status(201).json(newFire);
    } catch (err) {
        logger.error('Ошибка создания пожара: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания пожара' });
    }
});

// ---------- Обновление пожара ----------
const updateFire = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = updateFireSchema.validate(req.body);

    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const user = req.user;
        const updated = await fireService.updateFire(id, value, user.id, user.can_view_all);

        if (!updated) {
            return res.status(404).json({ error: 'Пожар не найден или нет доступа' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления пожара ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        if (err.message === 'Нет доступа к указанному подразделению') {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Ошибка обновления пожара' });
    }
});

// ---------- Удаление пожара ----------
const deleteFire = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const user = req.user;
        const deleted = await fireService.deleteFire(id, user.id, user.can_view_all);

        if (!deleted) {
            return res.status(404).json({ error: 'Пожар не найден или нет доступа' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json({ message: 'Пожар удалён' });
    } catch (err) {
        logger.error(`Ошибка удаления пожара ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления пожара' });
    }
});

module.exports = {
    getFires,
    getFireById,
    createFire,
    updateFire,
    deleteFire,
};