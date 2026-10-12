const service = require('../services/personnelService');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

// ============================================================
// СХЕМЫ
// ============================================================
const createPersonnelSchema = Joi.object({
    full_name: Joi.string().trim().min(1).max(300).required(),
    department_id: Joi.string().uuid().required(),
    position: Joi.string().allow('', null).max(200),
    rank_name: Joi.string().allow('', null).max(200),
    phone: Joi.string().allow('', null).max(50),
    note: Joi.string().allow('', null).max(2000),
    unit_id: Joi.string().uuid().allow('', null),
});

const updatePersonnelSchema = Joi.object({
    full_name: Joi.string().trim().min(1).max(300),
    department_id: Joi.string().uuid(),
    position: Joi.string().allow('', null).max(200),
    rank_name: Joi.string().allow('', null).max(200),
    phone: Joi.string().allow('', null).max(50),
    note: Joi.string().allow('', null).max(2000),
    unit_id: Joi.string().uuid().allow('', null),
}).min(1);

const reorderPersonnelSchema = Joi.object({
    personnel_ids: Joi.array().items(Joi.string().uuid()).required(),
});

const setUnitPersonnelSchema = Joi.object({
    personnel_ids: Joi.array().items(Joi.string().uuid()).required(),
});

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================
const getUserDepartmentIds = async (userId) => {
    const res = await pool.query(
        'SELECT department_id FROM user_departments WHERE user_id = $1',
        [userId]
    );
    return res.rows.map((row) => row.department_id);
};

// Если пользователь видит не всё — собираем список его подразделений
const resolveScope = async (user) => {
    if (user.can_view_all) return { canViewAll: true, deptIds: [] };
    const deptIds = await getUserDepartmentIds(user.id);
    return { canViewAll: false, deptIds };
};

const canAccessDepartment = (user, deptIds, departmentId) =>
    user.can_view_all || deptIds.includes(departmentId);

// ============================================================
// GET /api/personnel — список личного состава доступных подразделений
// ============================================================
const getAllPersonnel = asyncHandler(async (req, res) => {
    try {
        const { canViewAll, deptIds } = await resolveScope(req.user);
        const rows = await service.getAllPersonnel(canViewAll, deptIds);
        res.json(rows);
    } catch (err) {
        logger.error('Ошибка получения личного состава: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения личного состава' });
    }
});

// ============================================================
// GET /api/personnel/:id
// ============================================================
const getPersonnelById = asyncHandler(async (req, res) => {
    const person = await service.getPersonnelById(req.params.id);
    if (!person) return res.status(404).json({ error: 'Человек не найден' });

    const { canViewAll, deptIds } = await resolveScope(req.user);
    if (!canAccessDepartment(req.user, deptIds, person.department_id)) {
        return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
    }
    res.json(person);
});

// ============================================================
// POST /api/personnel — создание
// ============================================================
const createPersonnel = asyncHandler(async (req, res) => {
    const { error, value } = createPersonnelSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { canViewAll, deptIds } = await resolveScope(req.user);
    if (!canAccessDepartment(req.user, deptIds, value.department_id)) {
        return res.status(403).json({ error: 'Нет доступа к выбранному подразделению' });
    }

    try {
        const created = await service.createPersonnel(value);
        const io = req.app.get('io');
        emitForceRefresh(io, 'personnel');
        res.status(201).json(created);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error('Ошибка создания человека: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания' });
    }
});

// ============================================================
// PUT /api/personnel/:id — обновление
// ============================================================
const updatePersonnel = asyncHandler(async (req, res) => {
    const { error, value } = updatePersonnelSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existing = await service.getPersonnelById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Человек не найден' });

    const { canViewAll, deptIds } = await resolveScope(req.user);
    if (!canAccessDepartment(req.user, deptIds, existing.department_id)) {
        return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
    }
    // Перенос в другое подразделение — тоже под проверкой доступа
    if (value.department_id && !canAccessDepartment(req.user, deptIds, value.department_id)) {
        return res.status(403).json({ error: 'Нет доступа к выбранному подразделению' });
    }

    try {
        const updated = await service.updatePersonnel(req.params.id, value);
        const io = req.app.get('io');
        emitForceRefresh(io, 'personnel');
        res.json(updated);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error(`Ошибка обновления человека ${req.params.id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления' });
    }
});

// ============================================================
// DELETE /api/personnel/:id
// ============================================================
const deletePersonnel = asyncHandler(async (req, res) => {
    const existing = await service.getPersonnelById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Человек не найден' });

    const { canViewAll, deptIds } = await resolveScope(req.user);
    if (!canAccessDepartment(req.user, deptIds, existing.department_id)) {
        return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
    }

    try {
        await service.deletePersonnel(req.params.id);
        const io = req.app.get('io');
        emitForceRefresh(io, 'personnel');
        res.json({ ok: true });
    } catch (err) {
        logger.error(`Ошибка удаления человека ${req.params.id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

// ============================================================
// PUT /api/personnel/order — порядок внутри подразделения
// ============================================================
const reorderPersonnel = asyncHandler(async (req, res) => {
    const { error, value } = reorderPersonnelSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const ids = [...new Set(value.personnel_ids)];
    if (!ids.length) return res.status(400).json({ error: 'Нет людей для сортировки' });

    try {
        const { canViewAll, deptIds } = await resolveScope(req.user);
        if (!canViewAll) {
            const rows = await pool.query(
                'SELECT id, department_id FROM personnel WHERE id = ANY($1::uuid[])',
                [ids]
            );
            const byId = new Map(rows.rows.map((r) => [r.id, r.department_id]));
            for (const id of ids) {
                const dept = byId.get(id);
                if (!dept) return res.status(404).json({ error: 'Человек не найден' });
                if (!deptIds.includes(dept)) {
                    return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
                }
            }
        }

        await service.reorderPersonnel(ids);
        const io = req.app.get('io');
        emitForceRefresh(io, 'personnel');
        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка сортировки личного состава: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка сортировки' });
    }
});

// ============================================================
// PUT /api/units/:id/personnel — привязка людей к технике
// (используется со страницы «Техника»; проверка права — на роуте)
// ============================================================
const setUnitPersonnel = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = setUnitPersonnelSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const unitRes = await pool.query(
            'SELECT id, department_id FROM units WHERE id = $1',
            [id]
        );
        if (!unitRes.rows.length) return res.status(404).json({ error: 'Техника не найдена' });

        const { canViewAll, deptIds } = await resolveScope(req.user);
        if (!canAccessDepartment(req.user, deptIds, unitRes.rows[0].department_id)) {
            return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
        }

        const result = await service.setUnitPersonnel(id, value.personnel_ids);
        const io = req.app.get('io');
        emitForceRefresh(io, 'personnel');
        res.json(result);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error(`Ошибка привязки людей к технике ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка привязки' });
    }
});

module.exports = {
    getAllPersonnel,
    getPersonnelById,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    reorderPersonnel,
    setUnitPersonnel,
};


