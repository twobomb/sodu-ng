const garrisonService = require('../services/garrisonService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

const nameSchema = { name: Joi.string().min(1).max(200).trim().required() };

// GET /api/garrisons
const getAll = asyncHandler(async (req, res) => {
    try {
        const rows = await garrisonService.getAll();
        res.json(rows);
    } catch (err) {
        logger.error('Ошибка получения гарнизонов: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения гарнизонов' });
    }
});

// POST /api/garrisons
const create = asyncHandler(async (req, res) => {
    const { error, value } = Joi.object(nameSchema).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const row = await garrisonService.create(value);
        emitForceRefresh(req.app.get('io'));
        res.status(201).json(row);
    } catch (err) {
        logger.error('Ошибка создания гарнизона: ' + err.message, {
            stack: err.stack,
            body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания гарнизона' });
    }
});

// PUT /api/garrisons/:id
const update = asyncHandler(async (req, res) => {
    const { error, value } = Joi.object(nameSchema).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const row = await garrisonService.update(req.params.id, value);
        if (!row) return res.status(404).json({ error: 'Гарнизон не найден' });
        emitForceRefresh(req.app.get('io'));
        res.json(row);
    } catch (err) {
        logger.error(`Ошибка обновления гарнизона ${req.params.id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления гарнизона' });
    }
});

// PUT /api/garrisons/order — перестановка (перетаскивание)
const reorder = asyncHandler(async (req, res) => {
    const schema = Joi.object({
        garrison_ids: Joi.array().items(Joi.string().uuid()).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const garrisonIds = [...new Set(value.garrison_ids)];
    if (!garrisonIds.length) {
        return res.status(400).json({ error: 'Нет гарнизонов для сортировки' });
    }

    try {
        await garrisonService.reorder({ garrisonIds });
        emitForceRefresh(req.app.get('io'));
        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка сортировки гарнизонов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка сортировки гарнизонов' });
    }
});

// DELETE /api/garrisons/:id
const remove = asyncHandler(async (req, res) => {
    try {
        const result = await garrisonService.remove(req.params.id);
        if (!result.ok) {
            const messages = {
                not_found: 'Гарнизон не найден',
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }
        emitForceRefresh(req.app.get('io'));
        res.json({ ok: true });
    } catch (err) {
        logger.error(`Ошибка удаления гарнизона ${req.params.id}: ` + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка удаления гарнизона' });
    }
});

module.exports = { getAll, create, update, reorder, remove };