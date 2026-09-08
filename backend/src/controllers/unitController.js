const unitService = require('../services/unitService');
const pool = require('../db/pool');
const Joi = require('joi');

// Схема создания
const createUnitSchema = Joi.object({
    name: Joi.string().required(),
    type: Joi.string().required(),
    plate_number: Joi.string().allow('', null),
    status: Joi.string().valid('available', 'dispatched', 'repair', 'unavailable').required(),
    department_id: Joi.string().uuid().required(),
});

// Схема обновления
const updateUnitSchema = Joi.object({
    name: Joi.string(),
    type: Joi.string(),
    plate_number: Joi.string().allow('', null),
    status: Joi.string().valid('available', 'dispatched', 'repair', 'unavailable'),
    department_id: Joi.string().uuid(),
});

// Вспомогательная функция
const getUserDepartmentIds = async (userId) => {
    const result = await pool.query(
        'SELECT department_id FROM user_departments WHERE user_id = $1',
        [userId]
    );
    return result.rows.map(row => row.department_id);
};

const getAllUnits = async (req, res) => {
    try {
        const user = req.user;
        const depts = await getUserDepartmentIds(user.id);
        const units = await unitService.getAllUnits(user.id, user.can_view_all, depts);
        res.json(units);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения техники' });
    }
};

const getUnitById = async (req, res) => {
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
        res.status(500).json({ error: 'Ошибка получения техники' });
    }
};

const createUnit = async (req, res) => {
    try {
        const { error, value } = createUnitSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(value.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
            }
        }
        const newUnit = await unitService.createUnit(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        // TODO: Socket.IO force_refresh
        res.status(201).json(newUnit);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка создания техники' });
    }
};

const updateUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateUnitSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const existing = await unitService.getUnitById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }
        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(existing.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к этой технике' });
            }
            if (value.department_id && !depts.includes(value.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к новому подразделению' });
            }
        }
        const updated = await unitService.updateUnit(id, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!updated) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }
        // TODO: Socket.IO force_refresh
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка обновления техники' });
    }
};

const deleteUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await unitService.getUnitById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }
        const user = req.user;
        if (!user.can_view_all) {
            const depts = await getUserDepartmentIds(user.id);
            if (!depts.includes(existing.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к этой технике' });
            }
        }
        const deleted = await unitService.deleteUnit(id);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!deleted) {
            return res.status(404).json({ error: 'Техника не найдена' });
        }
        // TODO: Socket.IO force_refresh
        res.json({ message: 'Техника удалена' });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка удаления техники' });
    }
};

module.exports = {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit,
};