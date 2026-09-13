const departmentService = require('../services/departmentService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

// Схема валидации создания
const createDepartmentSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    full_name: Joi.string().allow('', null).max(300),
    address: Joi.string().allow('', null).max(500),
    phone: Joi.string().allow('', null).max(50),
    parent_id: Joi.string().uuid().allow(null).optional(),
});

const updateDepartmentSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    full_name: Joi.string().allow('', null).max(300),
    address: Joi.string().allow('', null).max(500),
    phone: Joi.string().allow('', null).max(50),
    parent_id: Joi.string().uuid().allow(null).optional(),
});

// ---------- Массовая перестановка подразделений ----------
const reorderDepartments = asyncHandler(async (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'Некорректный формат данных' });
    }

    // Простая валидация каждого элемента
    for (const u of updates) {
        if (
            !u.id ||
            typeof u.sort_order !== 'number' ||
            (u.parent_id !== null && typeof u.parent_id !== 'string')
        ) {
            return res.status(400).json({ error: 'Некорректные данные в updates' });
        }
    }

    try {
        await departmentService.reorderDepartments(updates);

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json({ success: true });
    } catch (err) {
        logger.error('Ошибка перестановки подразделений: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка перестановки' });
    }
});
// ---------- Получение всех подразделений ----------
const getAllDepartments = asyncHandler(async (req, res) => {
    try {
        const departments = await departmentService.getAllDepartments();
        res.json(departments);
    } catch (err) {
        logger.error('Ошибка получения подразделений: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения подразделений' });
    }
});

// ---------- Получение подразделения по ID ----------
const getDepartmentById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const department = await departmentService.getDepartmentById(id);
        if (!department) {
            return res.status(404).json({ error: 'Подразделение не найдено' });
        }
        res.json(department);
    } catch (err) {
        logger.error(`Ошибка получения подразделения ${req.params.id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения подразделения' });
    }
});

// ---------- Создание подразделения ----------
const createDepartment = asyncHandler(async (req, res) => {
    const { error, value } = createDepartmentSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const newDept = await departmentService.createDepartment(value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(newDept);
    } catch (err) {
        logger.error('Ошибка создания подразделения: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        if (err.message.includes('Родительское подразделение не найдено')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Ошибка создания подразделения' });
    }
});

// ---------- Обновление подразделения ----------
const updateDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = updateDepartmentSchema.validate(req.body);

    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const updated = await departmentService.updateDepartment(id, value);

        if (!updated) {
            return res.status(404).json({ error: 'Подразделение не найдено' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления подразделения ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });

        if (
            err.message.includes('Родительское') ||
            err.message.includes('циклическую')
        ) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Ошибка обновления подразделения' });
    }
});

// ---------- Удаление подразделения ----------
const deleteDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const deleted = await departmentService.deleteDepartment(id);

        if (!deleted) {
            return res.status(404).json({ error: 'Подразделение не найдено' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);

        res.json({ message: 'Подразделение удалено' });
    } catch (err) {
        logger.error(`Ошибка удаления подразделения ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });

        if (err.message.includes('дочерние')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Ошибка удаления подразделения' });
    }
});

module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reorderDepartments,
};