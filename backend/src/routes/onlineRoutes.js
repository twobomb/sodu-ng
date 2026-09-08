const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { getOnlineUsers } = require('../controllers/onlineController');

router.get('/', authenticate, getOnlineUsers);

module.exports = router;