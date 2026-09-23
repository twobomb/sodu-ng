const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const { getLoginHistory } = require('../controllers/loginHistoryController');

// История входов. Поддерживает query-параметры:
//  ?userId=<uuid>  — только указанный пользователь
//  ?search=<text>  — поиск по username
//  ?limit=&offset= — пагинация
router.get(
    '/',
    authenticate,
    requirePermission('users.login_history'),
    getLoginHistory
);

module.exports = router;