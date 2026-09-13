const unitTypeService = require('../services/unitTypeService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');
const pool = require('../db/pool');



const createSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    short_name: Joi.string().min(1).max(50).required(),
    sort_order: Joi.number().integer().min(0).max(10000),
});

const updateSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    short_name: Joi.string().min(1).max(50),
    sort_order: Joi.number().integer().min(0).max(10000),
});

// GET /api/unit-types
const getAll = asyncHandler(async (req, res) => {
    try {
        const user = req.user;

        // Собираем id подразделений, доступных пользователю
        let deptIds = null; // null = все
        if (!user.can_view_all) {
            const result = await pool.query(
                'SELECT department_id FROM user_departments WHERE user_id = $1',
                [user.id]
            );
            deptIds = result.rows.map((r) => r.department_id);
        }

        const types = await unitTypeService.getAll(deptIds);
        res.json(types);
    } catch (err) {
        logger.error('Ошибка получения типов техники: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения типов' });
    }
});
// GET /api/unit-types/:id
const getById = asyncHandler(async (req, res) => {
    try {
        const type = await unitTypeService.getById(req.params.id);
        if (!type) return res.status(404).json({ error: 'Тип не найден' });
        res.json(type);
    } catch (err) {
        logger.error('Ошибка получения типа: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка получения типа' });
    }
});

// POST /api/unit-types
const create = asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const created = await unitTypeService.create(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        logger.info(`Тип техники создан: ${created.short_name}`, {
            by: req.user?.id,
        });
        res.status(201).json(created);
    } catch (err) {
        logger.error('Ошибка создания типа: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания типа' });
    }
});

// PUT /api/unit-types/:id
const update = asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const updated = await unitTypeService.update(req.params.id, value);
        if (!updated) return res.status(404).json({ error: 'Тип не найден' });

        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error('Ошибка обновления типа: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления типа' });
    }
});

// DELETE /api/unit-types/:id
const remove = asyncHandler(async (req, res) => {
    try {
        const result = await unitTypeService.remove(req.params.id);
        if (!result.ok) {
            const messages = {
                not_found: 'Тип не найден',
                in_use: `Тип используется техникой (${result.count} ед.) — сначала переназначьте`,
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);
        logger.info(`Тип техники удалён: ${req.params.id}`, { by: req.user?.id });
        res.json({ message: 'Тип удалён' });
    } catch (err) {
        logger.error('Ошибка удаления типа: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления типа' });
    }
});

module.exports = { getAll, getById, create, update, remove };