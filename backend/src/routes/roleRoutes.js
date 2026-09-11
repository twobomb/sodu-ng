const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getPermissionsCatalog,
    getAllRoles,
    getRoleByCode,
    createRole,
    updateRole,
    deleteRole,
} = require('../controllers/roleController');

router.use(authenticate);

router.get('/permissions/catalog', requirePermission('roles.view'), getPermissionsCatalog);
router.get('/', requirePermission('roles.view'), getAllRoles);
router.post('/', requirePermission('roles.create'), createRole);
router.get('/:code', requirePermission('roles.view'), getRoleByCode);
router.put('/:code', requirePermission('roles.update'), updateRole);
router.delete('/:code', requirePermission('roles.delete'), deleteRole);

module.exports = router;