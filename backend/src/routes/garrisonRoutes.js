const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const { getAll, create, update, reorder, remove } = require('../controllers/garrisonController');

router.use(authenticate);

router.get('/', requirePermission('departments.view'), getAll);
router.post('/', requirePermission('departments.update'), create);
// Изменение порядка — ДО /:id
router.put('/order', requirePermission('departments.update'), reorder);
router.put('/:id', requirePermission('departments.update'), update);
router.delete('/:id', requirePermission('departments.update'), remove);

module.exports = router;