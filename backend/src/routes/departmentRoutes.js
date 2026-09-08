const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleGuard');
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/departmentController');

// Все маршруты требуют аутентификации, доступ только админам и разработчикам (можно разрешить и диспетчерам просмотр)
// Для просмотра оставляем всем, но создание/обновление/удаление только админам.
// Можно разделить: GET - для всех аутентифицированных, остальные - admin/developer.
router.use(authenticate);

// GET - доступны всем аутентифицированным
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);

// POST, PUT, DELETE - только admin и developer
router.post('/', requireRole(['admin', 'developer']), createDepartment);
router.put('/:id', requireRole(['admin', 'developer']), updateDepartment);
router.delete('/:id', requireRole(['admin', 'developer']), deleteDepartment);

module.exports = router;