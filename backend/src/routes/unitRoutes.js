const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit,
} = require('../controllers/unitController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// Просмотр
router.get('/', requirePermission('units.view'), getAllUnits);
router.get('/:id', requirePermission('units.view'), getUnitById);

// Создание
router.post('/', requirePermission('units.create'), createUnit);

// Редактирование
router.put('/:id', requirePermission('units.update'), updateUnit);

// Удаление
router.delete('/:id', requirePermission('units.delete'), deleteUnit);

module.exports = router;