const Joi = require('joi');
const asyncHandler = require('../utils/asyncHandler');
const callSampleService = require('../services/callSampleService');
const callService = require('../services/callService');
const { getFieldCatalog } = require('../services/callQueryBuilder');

// Определение запроса — произвольный JSON; структуру проверяет построитель.
const saveSchema = Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    definition: Joi.object().required(),
    id: Joi.string().uuid().allow(null, ''),
});

const updateSchema = Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    definition: Joi.object().required(),
});

const previewSchema = Joi.object({
    definition: Joi.object().required(),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(25),
});

// Ошибка построения запроса → 400
const isBuildError = (err) => err && (err.name === 'QueryBuildError' || err.status === 400);

// ============================================================
// GET /api/call-samples/fields — каталог доступных полей и операторов
// ============================================================
const getFields = asyncHandler(async (_req, res) => {
    res.json(getFieldCatalog());
});

// ============================================================
// GET /api/call-samples — список сохранённых выборок
// ============================================================
const list = asyncHandler(async (_req, res) => {
    res.json(await callSampleService.listSamples());
});

// ============================================================
// POST /api/call-samples — сохранить / пересохранить выборку
// ============================================================
const save = asyncHandler(async (req, res) => {
    const { error, value } = saveSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const sample = await callSampleService.saveSample({
            id: value.id || null,
            name: value.name,
            definition: value.definition,
            userId: req.user.id,
        });
        if (!sample) return res.status(404).json({ error: 'Выборка не найдена' });
        res.status(201).json(sample);
    } catch (err) {
        if (isBuildError(err)) return res.status(400).json({ error: err.message });
        throw err;
    }
});

// ============================================================
// PUT /api/call-samples/:id — обновить выборку (переименование / пересохранение)
// ============================================================
const update = asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const sample = await callSampleService.saveSample({
            id: req.params.id,
            name: value.name,
            definition: value.definition,
            userId: req.user.id,
        });
        if (!sample) return res.status(404).json({ error: 'Выборка не найдена' });
        res.json(sample);
    } catch (err) {
        if (isBuildError(err)) return res.status(400).json({ error: err.message });
        throw err;
    }
});

// ============================================================
// DELETE /api/call-samples/:id — удалить выборку
// ============================================================
const remove = asyncHandler(async (req, res) => {
    await callSampleService.deleteSample(req.params.id);
    res.json({ ok: true });
});

// ============================================================
// POST /api/call-samples/preview — сколько вызовов попадает под выборку
// ============================================================
const preview = asyncHandler(async (req, res) => {
    const { error, value } = previewSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const result = await callService.getCalls(
            {
                sample: JSON.stringify(value.definition),
                page: value.page,
                pageSize: value.pageSize,
            },
            {
                canViewAll: req.user.can_view_all,
                departmentIds: await callService.getUserDepartmentIds(req.user.id),
            }
        );
        res.json({ total: result.total });
    } catch (err) {
        if (isBuildError(err)) return res.status(400).json({ error: err.message });
        throw err;
    }
});

module.exports = { getFields, list, save, update, remove, preview };
