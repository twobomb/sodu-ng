const departmentService = require('../services/departmentService');
const Joi = require('joi');

// Схема валидации создания
const createDepartmentSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    parent_id: Joi.string().uuid().allow(null).optional(),
});

// Схема валидации обновления
const updateDepartmentSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    parent_id: Joi.string().uuid().allow(null).optional(),
});

const getAllDepartments = async (req, res) => {
    try {
        const departments = await departmentService.getAllDepartments();
        res.json(departments);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения подразделений' });
    }
};

const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const department = await departmentService.getDepartmentById(id);
        if (!department) {
            return res.status(404).json({ error: 'Подразделение не найдено' });
        }
        res.json(department);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения подразделения' });
    }
};

const createDepartment = async (req, res) => {
    try {
        const { error, value } = createDepartmentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const newDept = await departmentService.createDepartment(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(newDept);
    } catch (err) {
        if (err.message.includes('Родительское подразделение не найдено')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка создания подразделения' });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateDepartmentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const updated = await departmentService.updateDepartment(id, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!updated) {
            return res.status(404).json({ error: 'Подразделение не найдено' });
        }
        res.json(updated);
    } catch (err) {
        if (err.message.includes('Родительское') || err.message.includes('циклическую')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка обновления подразделения' });
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await departmentService.deleteDepartment(id);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!deleted) {
            return res.status(404).json({ error: 'Подразделение не найдено' });
        }
        res.json({ message: 'Подразделение удалено' });
    } catch (err) {
        if (err.message.includes('дочерние')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка удаления подразделения' });
    }
};

module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
};