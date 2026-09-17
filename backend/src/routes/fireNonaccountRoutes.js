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
} = require('../controllers/fireNonaccountController');

router.use(authenticate);

const requireAny = (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Не авторизован' });
    if (user.role === 'developer') return next();
    const perms = user.permissions || [];
    const allowed = ['calls.view', 'calls.update', 'calls.update_closed', 'dictionaries.manage'];
    if (allowed.some((p) => perms.includes(p))) return next();
    return res.status(403).json({ error: 'Недостаточно прав' });
};

router.get('/', requireAny, getAll);
router.get('/:id', requireAny, getById);

router.post('/', requirePermission('dictionaries.manage'), create);
router.put('/:id', requirePermission('dictionaries.manage'), update);
router.delete('/:id', requirePermission('dictionaries.manage'), remove);

module.exports = router;