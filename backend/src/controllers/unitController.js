const unitService = require('../services/unitService');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

// ============================================================
// СХЕМЫ
// ============================================================
const createUnitSchema = Joi.object({
    name: Joi.string().min(2).max(200).required(),
    plate_number: Joi.string().allow('', null).max(50),
    type_id: Joi.string().uuid().allow(null),
    status_id: Joi.string().uuid().allow(null),
    department_id: Joi.string().uuid().required(),
    squad_number: Joi.number().integer().min(1).max(10).allow(null),
    show_in_grid: Joi.boolean().default(true),
});

const updateUnitSchema = Joi.object({
    name: Joi.string().min(2).max(200),
    plate_number: Joi.string().allow('', null).max(50),
    type_id: Joi.string().uuid().allow(null),
    department_id: Joi.string().uuid(),
    squad_number: Joi.number().integer().min(1).max(10).allow(null),
    show_in_grid: Joi.boolean(),
});

const changeStatusSchema = Joi.object({
    status_id: Joi.string().uuid().required(),
    comment: Joi.string().max(500).allow('', null),
});

// ============================================================
// Вспомогательная — id подразделений пользователя
// ============================================================
const getUserDepartmentIds = async (userId) => {
    const result = await pool.query(
        'SELECT department_id FROM user_departments WHERE user_id = $1',
        [userId]
    );
    return result.rows.map((row) => row.department_id);
};

// ============================================================
// GET /api/units
// ============================================================
const getAllUnits = asyncHandler(async (req, res) => {
    try {


        const user = req.user;
        const depts = await getUserDepartmentIds(user.id);
        const units = await unitService.getAllUnits(
            user.id,
            user.can_view_all,
            depts
        );
        res.json(units);
    } catch (err) {
        logger.error('Ошибка получения техники: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения техники' });
    }
});

// ============================================================
// GET /api/units/:id
// ============================================================
const getUnitById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const unit = await unitService.getUnitById(id);
        if (!unit) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(unit.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к этой технике' });
            }
        }
        res.json(unit);
    } catch (err) {
        logger.error(
            `Ошибка получения техники ${req.params.id}: ` + err.message,
            {
                stack: err.stack,
                user: req.user?.id,
            }
        );
        res.status(500).json({ error: 'Ошибка получения техники' });
    }
});

// ============================================================
// POST /api/units
// ============================================================
const createUnit = asyncHandler(async (req, res) => {
    const { error, value } = createUnitSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const user = req.user;

        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(value.department_id)) {
                return res
                    .status(403)
                    .json({ error: 'Нет доступа к этому подразделению' });
            }
        }

        const newUnit = await unitService.createUnit(value, user.id);

        const io = req.app.get('io');
        emitForceRefresh(io);

        logger.info(`Техника создана: ${newUnit.name}`, {
            unitId: newUnit.id,
            by: user.id,
        });

        res.status(201).json(newUnit);
    } catch (err) {
        logger.error('Ошибка создания техники: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания техники' });
    }
});

// ============================================================
// PUT /api/units/:id
// ============================================================
const updateUnit = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = updateUnitSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const existing = await unitService.getUnitById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(existing.department_id)) {
                return res
                    .status(403)
                    .json({ error: 'Нет доступа к этой технике' });
            }
            if (value.department_id && !depts.includes(value.department_id)) {
                return res
                    .status(403)
                    .json({ error: 'Нет доступа к новому подразделению' });
            }
        }

        const updated = await unitService.updateUnit(id, value);
        if (!updated) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления техники ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления техники' });
    }
});

// ============================================================
// POST /api/units/:id/status — смена статуса
// ============================================================
const changeStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = changeStatusSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const existing = await unitService.getUnitById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(existing.department_id)) {
                return res
                    .status(403)
                    .json({ error: 'Нет доступа к этой технике' });
            }
        }

        const result = await unitService.changeStatus(
            id,
            value.status_id,
            user.id,
            value.comment || null
        );

        if (!result.ok) {
            const messages = {
                not_found: 'Техника не найдена',
                status_not_found: 'Статус не найден',
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const io = req.app.get('io');
        if (io && !result.noChange) {
            io.emit('unit:status_changed', {
                unit_id: result.unit.id,
                unit_name: result.unit.name,
                department_id: result.unit.department_id,
                department_name: result.unit.department_name,
                status_id: result.unit.status_id,
                status_name: result.unit.status_name,
                status_short_name: result.unit.status_short_name,
                status_color: result.unit.status_color,
                changed_at: new Date().toISOString(),
            });
            emitForceRefresh(io);
        }

        logger.info(
            `Статус техники ${existing.name} изменён на ${result.unit.status_name}`,
            { unitId: id, by: user.id, noChange: result.noChange }
        );

        res.json(result.unit);
    } catch (err) {
        logger.error(`Ошибка смены статуса техники ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка смены статуса' });
    }
});

// ============================================================
// DELETE /api/units/:id
// ============================================================
const deleteUnit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await unitService.getUnitById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(existing.department_id)) {
                return res
                    .status(403)
                    .json({ error: 'Нет доступа к этой технике' });
            }
        }

        const deleted = await unitService.deleteUnit(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        logger.info(`Техника удалена: ${existing.name}`, {
            unitId: id,
            by: user.id,
        });

        res.json({ message: 'Техника удалена' });
    } catch (err) {
        logger.error(`Ошибка удаления техники ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления техники' });
    }
});
// ============================================================
// GET /api/units/:id/history
// ============================================================
const getUnitHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await unitService.getUnitById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }

        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(existing.department_id)) {
                return res.status(403).json({ error: 'Нет доступа' });
            }
        }

        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const beforeChangedAt = req.query.before_changed_at || null;
        const beforeId = req.query.before_id || null;
        const before =
            beforeChangedAt && beforeId
                ? { changed_at: beforeChangedAt, id: beforeId }
                : null;

        const result = await unitService.getUnitHistory(id, { limit, before });
        res.json(result);
    } catch (err) {
        logger.error(`Ошибка получения истории техники ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения истории' });
    }
});

// ============================================================
// GET /api/units/history/global
// ============================================================
const getGlobalHistory = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        const depts = await getUserDepartmentIds(user.id);
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const before = req.query.before || null;

        const history = await unitService.getGlobalHistory(
            user.id,
            user.can_view_all,
            depts,
            { limit, before }
        );

        res.json(history);
    } catch (err) {
        logger.error('Ошибка получения глобальной истории: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения истории' });
    }
});

// ============================================================
// GET /api/units/grid?sort=default|dynamic
// ============================================================
const getGridData = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        const depts = await getUserDepartmentIds(user.id);
        const sort = req.query.sort === 'dynamic' ? 'dynamic' : 'default';

        const grid = await unitService.getGridData(
            user.id,
            user.can_view_all,
            depts,
            sort
        );

        res.json(grid);
    } catch (err) {
        logger.error('Ошибка получения сетки техники: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения сетки техники' });
    }
});

// ============================================================
// ЭКСПОРТ
// ============================================================
module.exports = {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    changeStatus,
    deleteUnit,
    getUnitHistory,
    getGlobalHistory,
    getGridData,
};