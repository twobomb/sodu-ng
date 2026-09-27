const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getFields,
    list,
    save,
    update,
    remove,
    preview,
} = require('../controllers/callSampleController');

router.use(authenticate);

// Каталог полей и предпросмотр — доступны всем, кто видит раздел
router.get('/fields', requirePermission('call_samples.view'), getFields);
router.post('/preview', requirePermission('call_samples.view'), preview);

router.get('/', requirePermission('call_samples.view'), list);
router.post('/', requirePermission('call_samples.manage'), save);
router.put('/:id', requirePermission('call_samples.manage'), update);
router.delete('/:id', requirePermission('call_samples.manage'), remove);

module.exports = router;
