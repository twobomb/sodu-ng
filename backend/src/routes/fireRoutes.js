const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getFires,
    getFireById,
    createFire,
    updateFire,
    deleteFire,
} = require('../controllers/fireController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// Просмотр
router.get('/', requirePermission('fires.view'), getFires);
router.get('/:id', requirePermission('fires.view'), getFireById);

// Создание
router.post('/', requirePermission('fires.create'), createFire);

// Редактирование
router.put('/:id', requirePermission('fires.update'), updateFire);

// Удаление
router.delete('/:id', requirePermission('fires.delete'), deleteFire);

module.exports = router;