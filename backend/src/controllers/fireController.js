const fireService = require('../services/fireService');
const Joi = require('joi');

// Схема для создания
const createFireSchema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
    lat: Joi.number(),
    lng: Joi.number(),
    status: Joi.string().valid('active', 'resolved', 'closed').required(),
    department_id: Joi.string().uuid().required(),
});

// Схема для обновления (все поля опциональны)
const updateFireSchema = Joi.object({
    title: Joi.string(),
    description: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
    lat: Joi.number(),
    lng: Joi.number(),
    status: Joi.string().valid('active', 'resolved', 'closed'),
    department_id: Joi.string().uuid(),
});

const getFires = async (req, res) => {
    try {
        const user = req.user;
        const fires = await fireService.getFires(user.id, user.can_view_all);
        res.json(fires);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка получения пожаров' });
    }
};

const getFireById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const fire = await fireService.getFireById(id, user.id, user.can_view_all);
        if (!fire) {
            return res.status(404).json({ error: 'Пожар не найден или нет доступа' });
        }
        res.json(fire);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения пожара' });
    }
};

const createFire = async (req, res) => {
    try {
        const { error, value } = createFireSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const user = req.user;
        // Проверяем, что пользователь имеет доступ к department_id (если не can_view_all)
        if (!user.can_view_all) {
            const userDeps = await fireService.getUserDepartments(user.id, false);
            if (!userDeps.includes(value.department_id)) {
                return res.status(403).json({ error: 'Нет доступа к данному подразделению' });
            }
        }
        const newFire = await fireService.createFire(value, user.id);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(newFire);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка создания пожара' });
    }
};

const updateFire = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateFireSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const user = req.user;
        const updated = await fireService.updateFire(id, value, user.id, user.can_view_all);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!updated) {
            return res.status(404).json({ error: 'Пожар не найден или нет доступа' });
        }
        res.json(updated);
    } catch (err) {
        if (err.message === 'Нет доступа к указанному подразделению') {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка обновления пожара' });
    }
};

const deleteFire = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const deleted = await fireService.deleteFire(id, user.id, user.can_view_all);
        const io = req.app.get('io');
        emitForceRefresh(io);
        if (!deleted) {
            return res.status(404).json({ error: 'Пожар не найден или нет доступа' });
        }
        res.json({ message: 'Пожар удалён' });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка удаления пожара' });
    }
};

module.exports = {
    getFires,
    getFireById,
    createFire,
    updateFire,
    deleteFire,
};