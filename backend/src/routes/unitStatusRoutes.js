const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getAll,
    getById,
    create,
    update,
    remove,
} = require('../controllers/unitStatusController');

router.use(authenticate);

router.get('/', requirePermission('units.view'), getAll);
router.get('/:id', requirePermission('units.view'), getById);

// Статусы техники — статические: создание/редактирование/удаление запрещены.
// (запись о сущности и эндпоинты CRUD оставлены, но недоступны из UI и сервера)

module.exports = router;