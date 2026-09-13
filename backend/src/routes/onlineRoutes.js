const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const { getOnlineUsers } = require('../controllers/onlineController');

router.get(
    '/',
    authenticate,
    requirePermission('users.view_online'),
    getOnlineUsers
);

module.exports = router;