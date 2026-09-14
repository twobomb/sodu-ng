const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { reportBug } = require('../controllers/reportController');

router.use(authenticate);

router.post('/bug', reportBug);

module.exports = router;