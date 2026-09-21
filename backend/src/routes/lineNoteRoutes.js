const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    listByDepartment,
    getByDate,
    create,
    update,
    copy,
    statusByDate,
    exportFile,
} = require('../controllers/lineNoteController');

router.use(authenticate);

// Просмотр
router.get('/status/:date', requirePermission('line_notes.view'), statusByDate);
router.get(
    '/department/:departmentId/:date',
    requirePermission('line_notes.view'),
    getByDate
);
router.get(
    '/department/:departmentId',
    requirePermission('line_notes.view'),
    listByDepartment
);

// Создание — правом «редактирование»
router.post('/', requirePermission('line_notes.manage'), create);

// Копирование на другую дату (черновик) — правом «редактирование»
router.post('/copy', requirePermission('line_notes.manage'), copy);

// Выгрузка в Excel по шаблону (доступ ко всем подразделениям — проверяется в контроллере)
router.post('/export', requirePermission('line_notes.view'), exportFile);

// Обновление — правом «редактирование», «утверждение» или «редактирование утверждённых»
// (детальная проверка по текущему статусу — в контроллере)
router.put('/:id', (req, res, next) => {
    if (req.user.role === 'developer') return next();
    const perms = req.user.permissions || [];
    const allowed = ['line_notes.manage', 'line_notes.approve', 'line_notes.edit_approved'];
    if (perms.some((p) => allowed.includes(p))) return next();
    return res.status(403).json({ error: 'Недостаточно прав' });
}, update);

module.exports = router;