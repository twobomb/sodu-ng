const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireDeveloper } = require('../middlewares/developerGuard');
const {
    getSettings,
    getPublicSettings,
    updateSettings,
    sendBroadcast,
    getLatestBroadcast,
} = require('../controllers/settingsController');

const {
    listFiles,
    getFolderSize,
    deleteFiles,
} = require('../controllers/filesController');

// Публичный — без авторизации
router.get('/public', getPublicSettings);


// Всё остальное — только developer
router.use(authenticate);
router.use(requireDeveloper);

// Управление файлами
router.get('/files/folder-size', getFolderSize);
router.get('/files', listFiles);
router.post('/files/delete', deleteFiles);

// Основные настройки
router.post('/broadcast', sendBroadcast);
router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/broadcast', sendBroadcast);
router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;