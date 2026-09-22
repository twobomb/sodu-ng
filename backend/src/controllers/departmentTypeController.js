const departmentTypeService = require('../services/departmentTypeService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

const nameSchema = { name: Joi.string().min(1).max(100).trim().required() };

// GET /api/department-types
const getAll = asyncHandler(async (req, res) => {
    try {
        const rows = await departmentTypeService.getAll();
        res.json(rows);
    } catch (err) {
        logger.error('Ошибка получения видов подразделений: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка получения видов подразделений' });
    }
});

// POST /api/department-types
const create = asyncHandler(async (req, res) => {
    const { error, value } = Joi.object(nameSchema).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const row = await departmentTypeService.create(value);
        emitForceRefresh(req.app.get('io'), 'department-types');
        res.status(201).json(row);
    } catch (err) {
        logger.error('Ошибка создания вида подразделения: ' + err.message, {
            stack: err.stack,
            body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания вида подразделения' });
    }
});

// PUT /api/department-types/:id
const update = asyncHandler(async (req, res) => {
    const { error, value } = Joi.object(nameSchema).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const row = await departmentTypeService.update(req.params.id, value);
        if (!row) return res.status(404).json({ error: 'Вид подразделения не найден' });
        emitForceRefresh(req.app.get('io'), 'department-types');
        res.json(row);
    } catch (err) {
        logger.error(`Ошибка обновления вида подразделения ${req.params.id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления вида подразделения' });
    }
});

// DELETE /api/department-types/:id
const remove = asyncHandler(async (req, res) => {
    try {
        const result = await departmentTypeService.remove(req.params.id);
        if (!result.ok) {
            const messages = {
                not_found: 'Вид подразделения не найден',
                system: 'Системный вид подразделения нельзя удалить',
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }
        emitForceRefresh(req.app.get('io'), 'department-types');
        res.json({ ok: true });
    } catch (err) {
        logger.error(`Ошибка удаления вида подразделения ${req.params.id}: ` + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка удаления вида подразделения' });
    }
});

module.exports = { getAll, create, update, remove };