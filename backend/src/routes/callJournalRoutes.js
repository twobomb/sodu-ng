const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const { exportJournal } = require('../controllers/callJournalController');

router.use(authenticate);

// Выгрузка журнала вызовов в Excel по шаблону
// (доступ ко всем подразделениям — проверяется дополнительно в контроллере)
router.post('/export', requirePermission('call_journal.export'), exportJournal);

module.exports = router;