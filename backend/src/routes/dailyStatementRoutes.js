const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const { exportStatement } = require('../controllers/dailyStatementController');

router.use(authenticate);

// Выгрузка суточной ведомости в Excel (.xls) по шаблону
// (доступ ко всем подразделениям — проверяется дополнительно в контроллере)
router.post('/export', requirePermission('daily_statement.export'), exportStatement);

module.exports = router;
