const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getCalls,
    getCallById,
    createCall,
    updateCall,
    setCallStatus,
    setCallUnits,
    addCallEvent,
    deleteCallEvent,
} = require('../controllers/callController');

// Все маршруты требуют аутентификации
router.use(authenticate);

// Правка полей может требовать разного права в зависимости от статуса вызова
// (обработка → calls.update, закрыт → calls.update_closed), поэтому на уровне
// роута пропускаем того, у кого есть хотя бы одно из этих прав, а финальную
// проверку по фактическому статусу выполняет контроллер.
const requireCallUpdate = (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Не авторизован' });
    if (user.role === 'developer') return next();
    const perms = user.permissions || [];
    if (perms.includes('calls.update') || perms.includes('calls.update_closed')) {
        return next();
    }
    return res.status(403).json({ error: 'Недостаточно прав' });
};

// ----- Просмотр -----
router.get('/', requirePermission('calls.view'), getCalls);
router.get('/:id', requirePermission('calls.view'), getCallById);

// ----- Создание -----
router.post('/', requirePermission('calls.create'), createCall);

// ----- Редактирование -----
router.put('/:id', requireCallUpdate, updateCall);
router.put('/:id/status', requirePermission('calls.update_status'), setCallStatus);
router.put('/:id/units', requireCallUpdate, setCallUnits);
router.post('/:id/events', requireCallUpdate, addCallEvent);
router.delete('/:id/events/:eventId', requireCallUpdate, deleteCallEvent);

module.exports = router;