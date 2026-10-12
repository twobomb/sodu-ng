const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getAllPersonnel,
    getPersonnelById,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    reorderPersonnel,
} = require('../controllers/personnelController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// ----- Просмотр -----
router.get('/', requirePermission('personnel.view'), getAllPersonnel);

// ----- Сортировка внутри подразделения (перетаскивание) — ДО /:id -----
router.put('/order', requirePermission('personnel.update'), reorderPersonnel);

// ----- Создание -----
router.post('/', requirePermission('personnel.create'), createPersonnel);

// ----- Конкретный человек -----
router.get('/:id', requirePermission('personnel.view'), getPersonnelById);
router.put('/:id', requirePermission('personnel.update'), updatePersonnel);
router.delete('/:id', requirePermission('personnel.delete'), deletePersonnel);

module.exports = router;
