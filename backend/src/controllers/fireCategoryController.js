const fireCategoryService = require('../services/fireCategoryService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

const schema = Joi.object({
    name: Joi.string().min(2).max(300).required(),
    parent_id: Joi.string().uuid().allow('', null),
    code: Joi.string().max(20).allow('', null),
});

const updateSchema = Joi.object({
    name: Joi.string().min(2).max(300),
    parent_id: Joi.string().uuid().allow('', null),
    code: Joi.string().max(20).allow('', null),
});

// Чтение справочника — доступно всем, кто видит вызовы
const getAll = asyncHandler(async (req, res) => {
    try {
        const items = await fireCategoryService.getAll();
        res.json(items);
    } catch (err) {
        logger.error('Ошибка получения категорий пожаров: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения категорий' });
    }
});

const getById = asyncHandler(async (req, res) => {
    try {
        const item = await fireCategoryService.getById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Категория не найдена' });
        res.json(item);
    } catch (err) {
        logger.error('Ошибка получения категории: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения категории' });
    }
});

const create = asyncHandler(async (req, res) => {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    try {
        const created = await fireCategoryService.create(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(created);
    } catch (err) {
        logger.error('Ошибка создания категории: ' + err.message, { stack: err.stack, body: req.body });
        res.status(500).json({ error: err.message || 'Ошибка создания категории' });
    }
});

const update = asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    try {
        const updated = await fireCategoryService.update(req.params.id, value);
        if (updated && updated.error === 'Nested_self') {
            return res.status(400).json({ error: 'Нельзя назначить категорию своей собственной подкатегорией' });
        }
        if (!updated) return res.status(404).json({ error: 'Категория не найдена' });
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error('Ошибка обновления категории: ' + err.message, { stack: err.stack, body: req.body });
        res.status(500).json({ error: err.message || 'Ошибка обновления категории' });
    }
});

const remove = asyncHandler(async (req, res) => {
    try {
        const result = await fireCategoryService.remove(req.params.id);
        if (!result.ok) {
            const messages = {
                not_found: 'Категория не найдена',
                has_children: `Сначала удалите подкатегории (${result.count})`,
                in_use: `Категория используется в вызовах (${result.count}) — сначала переназначьте`,
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json({ message: 'Категория удалена' });
    } catch (err) {
        logger.error('Ошибка удаления категории: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка удаления категории' });
    }
});

module.exports = { getAll, getById, create, update, remove };