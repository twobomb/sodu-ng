const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireDeveloper } = require('../middlewares/developerGuard');
const {
    getSettings,
    getPublicSettings,
    updateSettings,
} = require('../controllers/settingsController');

// Публичный — без авторизации
router.get('/public', getPublicSettings);

// Всё остальное — только developer
router.use(authenticate);
router.use(requireDeveloper);
router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;