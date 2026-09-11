const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reorderDepartments,
} = require('../controllers/departmentController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// Просмотр
router.get('/', requirePermission('departments.view'), getAllDepartments);

// Создание
router.post('/', requirePermission('departments.create'), createDepartment);

// Изменение порядка — ВАЖНО: до /:id, иначе Express примет "reorder" за id
router.put('/reorder', requirePermission('departments.reorder'), reorderDepartments);

// Просмотр конкретного
router.get('/:id', requirePermission('departments.view'), getDepartmentById);

// Редактирование
router.put('/:id', requirePermission('departments.update'), updateDepartment);

// Удаление
router.delete('/:id', requirePermission('departments.delete'), deleteDepartment);

module.exports = router;