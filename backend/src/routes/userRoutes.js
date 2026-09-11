const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
} = require('../controllers/userController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// Просмотр
router.get('/', requirePermission('users.view'), getAllUsers);
router.get('/:id', requirePermission('users.view'), getUserById);

// Создание
router.post('/', requirePermission('users.create'), createUser);

// Редактирование
router.put('/:id', requirePermission('users.update'), updateUser);

// Удаление
router.delete('/:id', requirePermission('users.delete'), deleteUser);

// Блокировка и разблокировка — одно общее право
router.post('/:id/block', requirePermission('users.block'), blockUser);
router.post('/:id/unblock', requirePermission('users.block'), unblockUser);

module.exports = router;