const roleService = require('../services/roleService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const { PERMISSIONS_CATALOG, ALL_PERMISSION_KEYS } = require('../config/permissions');
const Joi = require('joi');

const createRoleSchema = Joi.object({
    code: Joi.string()
        .pattern(/^[a-z][a-z0-9_]*$/)
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.pattern.base':
                'Код роли может содержать только латиницу в нижнем регистре, цифры и _',
        }),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().allow('', null),
    permissions: Joi.array()
        .items(Joi.string().valid(...ALL_PERMISSION_KEYS))
        .default([]),
});

const updateRoleSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    description: Joi.string().allow('', null),
    permissions: Joi.array().items(Joi.string().valid(...ALL_PERMISSION_KEYS)),
});

// GET /api/permissions — каталог правил
const getPermissionsCatalog = asyncHandler(async (req, res) => {
    res.json(PERMISSIONS_CATALOG);
});

// GET /api/roles
const getAllRoles = asyncHandler(async (req, res) => {
    try {
        const roles = await roleService.getAllRoles();
        res.json(roles);
    } catch (err) {
        logger.error('Ошибка получения ролей: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения ролей' });
    }
});

// GET /api/roles/:code
const getRoleByCode = asyncHandler(async (req, res) => {
    try {
        const role = await roleService.getRoleByCode(req.params.code);
        if (!role) return res.status(404).json({ error: 'Роль не найдена' });
        res.json(role);
    } catch (err) {
        logger.error('Ошибка получения роли: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Ошибка получения роли' });
    }
});

// POST /api/roles
const createRole = asyncHandler(async (req, res) => {
    const { error, value } = createRoleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const newRole = await roleService.createRole(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(newRole);
    } catch (err) {
        logger.error('Ошибка создания роли: ' + err.message, {
            stack: err.stack, body: req.body,
        });
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Роль с таким кодом уже существует' });
        }
        res.status(500).json({ error: err.message || 'Ошибка создания роли' });
    }
});

// PUT /api/roles/:code
const updateRole = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { error, value } = updateRoleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const existing = await roleService.getRoleByCode(code);
        if (!existing) return res.status(404).json({ error: 'Роль не найдена' });

        // Код developer менять нельзя
        if (existing.code === 'developer') {
            return res.status(400).json({ error: 'Роль "Разработчик" нельзя изменять' });
        }

        const updated = await roleService.updateRole(code, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления роли ${code}: ` + err.message, {
            stack: err.stack, body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления роли' });
    }
});

// DELETE /api/roles/:code
const deleteRole = asyncHandler(async (req, res) => {
    const { code } = req.params;
    try {
        const result = await roleService.deleteRole(code);
        if (!result.ok) {
            const messages = {
                not_found: 'Роль не найдена',
                system: 'Системную роль нельзя удалить',
                in_use: 'Роль назначена пользователям — сначала переназначьте их',
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json({ message: 'Роль удалена' });
    } catch (err) {
        logger.error(`Ошибка удаления роли ${code}: ` + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления роли' });
    }
});

module.exports = {
    getPermissionsCatalog,
    getAllRoles,
    getRoleByCode,
    createRole,
    updateRole,
    deleteRole,
};