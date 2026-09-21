const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const { getAll, create, update, remove } = require('../controllers/departmentTypeController');

router.use(authenticate);

router.get('/', requirePermission('departments.view'), getAll);
router.post('/', requirePermission('departments.update'), create);
router.put('/:id', requirePermission('departments.update'), update);
router.delete('/:id', requirePermission('departments.update'), remove);

module.exports = router;