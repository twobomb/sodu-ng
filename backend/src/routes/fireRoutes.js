const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleGuard');
const {
    getFires,
    getFireById,
    createFire,
    updateFire,
    deleteFire,
} = require('../controllers/fireController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// Все пользователи могут просматривать (с фильтром по доступу)
router.get('/', getFires);
router.get('/:id', getFireById);

// Создание и изменение требуют хотя бы роль dispatcher (или admin/developer)
router.post('/', requireRole(['admin', 'developer', 'dispatcher']), createFire);
router.put('/:id', requireRole(['admin', 'developer', 'dispatcher']), updateFire);
router.delete('/:id', requireRole(['admin', 'developer']), deleteFire);

module.exports = router;