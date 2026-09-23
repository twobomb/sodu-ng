const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireDeveloper } = require('../middlewares/developerGuard');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getSettings,
    getPublicSettings,
    getUploadDisk,
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

// Всё остальное — только для авторизованных
router.use(authenticate);

// Управление файлами — доступ по правилу «Управление файлами»
router.get(
    '/files/folder-size',
    requirePermission('settings.files'),
    getFolderSize
);
router.get('/files', requirePermission('settings.files'), listFiles);
router.post('/files/delete', requirePermission('settings.files'), deleteFiles);

// Системные настройки — только developer
router.use(requireDeveloper);

router.get('/disk', getUploadDisk);
router.post('/broadcast', sendBroadcast);
router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;