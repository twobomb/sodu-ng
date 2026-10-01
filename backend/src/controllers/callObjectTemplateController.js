const asyncHandler = require('../utils/asyncHandler');
const Joi = require('joi');
const templateService = require('../services/callObjectTemplateService');

const createTemplateSchema = Joi.object({
    name: Joi.string().min(1).max(300).required(),
    scope: Joi.string().valid('personal', 'global').default('personal'),
});

// Есть ли право управлять общими значениями (developer — всегда).
const canManageGlobal = (user) =>
    user.role === 'developer' ||
    (user.permissions || []).includes('calls.manage_object_templates');

// GET /api/calls/object-templates — список общих + личных значений текущего пользователя
const getObjectTemplates = asyncHandler(async (req, res) => {
    const rows = await templateService.listForUser(req.user.id);
    res.json(rows);
});

// POST /api/calls/object-templates — добавить значение (личное или общее)
const createObjectTemplate = asyncHandler(async (req, res) => {
    const { error, value } = createTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Общие значения может добавлять только пользователь с правом manage_object_templates.
    if (value.scope === 'global' && !canManageGlobal(req.user)) {
        return res.status(403).json({
            error: 'Недостаточно прав: добавление общих значений доступно пользователям с правом «Справочник объектов»',
        });
    }

    const { existed, template } = await templateService.createTemplate({
        name: value.name.trim(),
        scope: value.scope,
        createdBy: req.user.id,
    });
    res.status(existed ? 200 : 201).json(template);
});

// DELETE /api/calls/object-templates/:templateId — удалить значение
const deleteObjectTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    if (!templateId) {
        return res.status(400).json({ error: 'Отсутствует id значения' });
    }

    const result = await templateService.deleteTemplate(
        templateId,
        req.user.id,
        canManageGlobal(req.user)
    );
    if (result.forbidden) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления этого значения' });
    }
    res.json({ ok: true });
});

module.exports = {
    getObjectTemplates,
    createObjectTemplate,
    deleteObjectTemplate,
};
