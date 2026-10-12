const asyncHandler = require('../utils/asyncHandler');
const Joi = require('joi');
const service = require('../services/callObjectParamService');

const createParamSchema = Joi.object({
    name: Joi.string().trim().min(1).max(300).required(),
});

const createValueSchema = Joi.object({
    param_name: Joi.string().trim().min(1).max(300).required(),
    value: Joi.string().trim().min(1).max(1000).required(),
});

// Есть ли право управлять справочником параметров объектов (developer — всегда).
const canManage = (user) =>
    user.role === 'developer' ||
    (user.permissions || []).includes('calls.manage_object_params');

// GET /api/calls/object-params — параметры и их значения (для автодополнения)
const getObjectParams = asyncHandler(async (req, res) => {
    const catalog = await service.listCatalog();
    res.json(catalog);
});

// POST /api/calls/object-params — добавить параметр
const createObjectParam = asyncHandler(async (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({
            error: 'Недостаточно прав: добавление параметров доступно пользователям с правом «Справочник параметров объектов»',
        });
    }
    const { error, value } = createParamSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { existed, param } = await service.createParam({
        name: value.name,
        createdBy: req.user.id,
    });
    res.status(existed ? 200 : 201).json(param);
});

// DELETE /api/calls/object-params/:paramId — удалить параметр (вместе со значениями)
const deleteObjectParam = asyncHandler(async (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления параметров' });
    }
    const { paramId } = req.params;
    if (!paramId) return res.status(400).json({ error: 'Отсутствует id параметра' });
    await service.deleteParam(paramId);
    res.json({ ok: true });
});

// POST /api/calls/object-param-values — добавить значение параметра
const createObjectParamValue = asyncHandler(async (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({
            error: 'Недостаточно прав: добавление значений доступно пользователям с правом «Справочник параметров объектов»',
        });
    }
    const { error, value } = createValueSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { existed, value: row } = await service.createValue({
        paramName: value.param_name,
        value: value.value,
        createdBy: req.user.id,
    });
    res.status(existed ? 200 : 201).json(row);
});

// DELETE /api/calls/object-param-values/:valueId — удалить значение параметра
const deleteObjectParamValue = asyncHandler(async (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления значений' });
    }
    const { valueId } = req.params;
    if (!valueId) return res.status(400).json({ error: 'Отсутствует id значения' });
    await service.deleteValue(valueId);
    res.json({ ok: true });
});

module.exports = {
    getObjectParams,
    createObjectParam,
    deleteObjectParam,
    createObjectParamValue,
    deleteObjectParamValue,
};
