const fireCauseService = require('../services/fireCauseService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

const schema = Joi.object({ name: Joi.string().min(2).max(300).required() });
const updateSchema = Joi.object({ name: Joi.string().min(2).max(300) });

const getAll = asyncHandler(async (req, res) => {
    try {
        res.json(await fireCauseService.getAll());
    } catch (err) {
        logger.error('Ошибка получения причин пожара: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения причин' });
    }
});

const getById = asyncHandler(async (req, res) => {
    try {
        const item = await fireCauseService.getById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Причина не найдена' });
        res.json(item);
    } catch (err) {
        logger.error('Ошибка получения причины: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения причины' });
    }
});

const create = asyncHandler(async (req, res) => {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    try {
        const created = await fireCauseService.create(value);
        emitForceRefresh(req.app.get('io'));
        res.status(201).json(created);
    } catch (err) {
        logger.error('Ошибка создания причины: ' + err.message, { stack: err.stack, body: req.body });
        res.status(500).json({ error: 'Ошибка создания причины' });
    }
});

const update = asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    try {
        const updated = await fireCauseService.update(req.params.id, value);
        if (updated && updated.error === 'system') {
            return res.status(400).json({ error: 'Системную причину «Иные причины (указать причину)» нельзя редактировать' });
        }
        if (!updated) return res.status(404).json({ error: 'Причина не найдена' });
        emitForceRefresh(req.app.get('io'));
        res.json(updated);
    } catch (err) {
        logger.error('Ошибка обновления причины: ' + err.message, { stack: err.stack, body: req.body });
        res.status(500).json({ error: 'Ошибка обновления причины' });
    }
});

const remove = asyncHandler(async (req, res) => {
    try {
        const result = await fireCauseService.remove(req.params.id);
        if (!result.ok) {
            const messages = {
                not_found: 'Причина не найдена',
                system: 'Системную причину «Иные причины (указать причину)» нельзя удалить',
                in_use: `Причина используется в вызовах (${result.count}) — сначала переназначьте`,
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }
        emitForceRefresh(req.app.get('io'));
        res.json({ message: 'Причина удалена' });
    } catch (err) {
        logger.error('Ошибка удаления причины: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка удаления причины' });
    }
});

module.exports = { getAll, getById, create, update, remove };