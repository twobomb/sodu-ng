const unitStatusService = require('../services/unitStatusService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');
const pool = require('../db/pool');

const createSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    short_name: Joi.string().min(1).max(50).required(),
    color: Joi.string()
        .pattern(/^#[0-9a-fA-F]{6}$/)
        .required()
        .messages({ 'string.pattern.base': 'Цвет должен быть в формате #RRGGBB' }),
    color_name: Joi.string().max(50).allow('', null),
    sort_order: Joi.number().integer().min(0).max(10000),
});

const updateSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    short_name: Joi.string().min(1).max(50),
    color: Joi.string()
        .pattern(/^#[0-9a-fA-F]{6}$/)
        .messages({ 'string.pattern.base': 'Цвет должен быть в формате #RRGGBB' }),
    color_name: Joi.string().max(50).allow('', null),
    sort_order: Joi.number().integer().min(0).max(10000),
});

// GET /api/unit-statuses
const getAll = asyncHandler(async (req, res) => {
    try {
        const user = req.user;

        let deptIds = null;
        if (!user.can_view_all) {
            const result = await pool.query(
                'SELECT department_id FROM user_departments WHERE user_id = $1',
                [user.id]
            );
            deptIds = result.rows.map((r) => r.department_id);
        }

        const statuses = await unitStatusService.getAll(deptIds);
        res.json(statuses);
    } catch (err) {
        logger.error('Ошибка получения статусов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения статусов' });
    }
});

// GET /api/unit-statuses/:id
const getById = asyncHandler(async (req, res) => {
    try {
        const status = await unitStatusService.getById(req.params.id);
        if (!status) return res.status(404).json({ error: 'Статус не найден' });
        res.json(status);
    } catch (err) {
        logger.error('Ошибка получения статуса: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка получения статуса' });
    }
});

// POST /api/unit-statuses
const create = asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const created = await unitStatusService.create(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        logger.info(`Статус создан: ${created.short_name}`, {
            by: req.user?.id,
        });
        res.status(201).json(created);
    } catch (err) {
        logger.error('Ошибка создания статуса: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания статуса' });
    }
});

// PUT /api/unit-statuses/:id
const update = asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const updated = await unitStatusService.update(req.params.id, value);
        if (!updated) return res.status(404).json({ error: 'Статус не найден' });

        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error('Ошибка обновления статуса: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления статуса' });
    }
});

// DELETE /api/unit-statuses/:id
const remove = asyncHandler(async (req, res) => {
    try {
        const result = await unitStatusService.remove(req.params.id);
        if (!result.ok) {
            const messages = {
                not_found: 'Статус не найден',
                system: 'Системный статус нельзя удалить',
                in_use: `Статус используется техникой (${result.count} ед.) — сначала переназначьте`,
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);
        logger.info(`Статус удалён: ${req.params.id}`, { by: req.user?.id });
        res.json({ message: 'Статус удалён' });
    } catch (err) {
        logger.error('Ошибка удаления статуса: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления статуса' });
    }
});

module.exports = { getAll, getById, create, update, remove };