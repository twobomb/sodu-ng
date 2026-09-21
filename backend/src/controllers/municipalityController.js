const municipalityService = require('../services/municipalityService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

const createSchema = Joi.object({
    name: Joi.string().min(1).max(200).trim().required(),
});

// GET /api/municipalities
const getAll = asyncHandler(async (req, res) => {
    try {
        const rows = await municipalityService.getAll();
        res.json(rows);
    } catch (err) {
        logger.error('Ошибка получения округов: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения округов' });
    }
});

// POST /api/municipalities
const create = asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    try {
        const row = await municipalityService.create(value);
        emitForceRefresh(req.app.get('io'));
        res.status(201).json(row);
    } catch (err) {
        logger.error('Ошибка создания округа: ' + err.message, {
            stack: err.stack,
            body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания округа' });
    }
});

// DELETE /api/municipalities/:id
const remove = asyncHandler(async (req, res) => {
    try {
        const ok = await municipalityService.remove(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Округ не найден' });
        emitForceRefresh(req.app.get('io'));
        res.json({ ok: true });
    } catch (err) {
        logger.error(`Ошибка удаления округа ${req.params.id}: ` + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка удаления округа' });
    }
});

const updateSchema = Joi.object({
    name: Joi.string().min(1).max(200).trim().required(),
});

// PUT /api/municipalities/order — перестановка (перетаскивание)
const reorder = asyncHandler(async (req, res) => {
    const schema = Joi.object({
        municipality_ids: Joi.array().items(Joi.string().uuid()).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const municipalityIds = [...new Set(value.municipality_ids)];
    if (!municipalityIds.length) {
        return res.status(400).json({ error: 'Нет округов для сортировки' });
    }

    try {
        await municipalityService.reorder({ municipalityIds });
        emitForceRefresh(req.app.get('io'));
        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка сортировки округов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка сортировки округов' });
    }
});

// PUT /api/municipalities/:id
const update = asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    try {
        const row = await municipalityService.update(req.params.id, value);
        if (!row) return res.status(404).json({ error: 'Округ не найден' });
        emitForceRefresh(req.app.get('io'));
        res.json(row);
    } catch (err) {
        logger.error(`Ошибка обновления округа ${req.params.id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
        });
        res.status(500).json({ error: 'Ошибка обновления округа' });
    }
});

module.exports = { getAll, create, update, reorder, remove };
