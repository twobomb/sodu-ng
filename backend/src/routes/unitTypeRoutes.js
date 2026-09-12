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
} = require('../controllers/unitTypeController');

router.use(authenticate);

// Просмотр — тем, кто видит технику
router.get('/', requirePermission('units.view'), getAll);
router.get('/:id', requirePermission('units.view'), getById);

// Управление справочником — отдельное право
router.post('/', requirePermission('units.manage_dictionaries'), create);
router.put('/:id', requirePermission('units.manage_dictionaries'), update);
router.delete('/:id', requirePermission('units.manage_dictionaries'), remove);

module.exports = router;