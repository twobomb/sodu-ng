const asyncHandler = require('../utils/asyncHandler');
const Joi = require('joi');
const templateService = require('../services/callEventTemplateService');

const createTemplateSchema = Joi.object({
    text: Joi.string().min(1).max(1000).required(),
    scope: Joi.string().valid('personal', 'global').default('personal'),
});

// Есть ли право управлять общими фразами (developer — всегда).
const canManageGlobal = (user) =>
    user.role === 'developer' ||
    (user.permissions || []).includes('calls.manage_event_templates');

// GET /api/calls/event-templates — список общих + личных фраз текущего пользователя
const getEventTemplates = asyncHandler(async (req, res) => {
    const rows = await templateService.listForUser(req.user.id);
    res.json(rows);
});

// POST /api/calls/event-templates — добавить фразу (личную или общую)
const createEventTemplate = asyncHandler(async (req, res) => {
    const { error, value } = createTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Общие фразы может добавлять только пользователь с правом manage_event_templates.
    if (value.scope === 'global' && !canManageGlobal(req.user)) {
        return res.status(403).json({
            error: 'Недостаточно прав: добавление общих фраз доступно пользователям с правом «Типовые фразы»',
        });
    }

    const { existed, template } = await templateService.createTemplate({
        text: value.text.trim(),
        scope: value.scope,
        createdBy: req.user.id,
    });
    res.status(existed ? 200 : 201).json(template);
});

// DELETE /api/calls/event-templates/:id — удалить фразу
const deleteEventTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    if (!templateId) {
        return res.status(400).json({ error: 'Отсутствует id фразы' });
    }

    const result = await templateService.deleteTemplate(
        templateId,
        req.user.id,
        canManageGlobal(req.user)
    );
    if (result.forbidden) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления этой фразы' });
    }
    res.json({ ok: true });
});

module.exports = {
    getEventTemplates,
    createEventTemplate,
    deleteEventTemplate,
};