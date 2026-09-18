
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    changeStatus,
    updateMetrics,
    reorderUnits,
    getAvailableCalls,
    deleteUnit,
    getUnitHistory,
    getUnitMetricsHistory,
    getGlobalHistory,
    getGridData
} = require('../controllers/unitController');

router.use(authenticate);

// ----- Просмотр -----
router.get('/', requirePermission('units.view'), getAllUnits);
router.get('/grid', requirePermission('units.view'), getGridData);

// ----- История -----
// Глобальный лог — ДО /:id
router.get(
    '/history/global',
    requirePermission('units.view_history'),
    getGlobalHistory
);

// Доступные вызовы для привязки техники (ДО /:id)
router.get(
    '/calls-available',
    requirePermission('units.update_status'),
    getAvailableCalls
);

// ----- Создание -----
router.post('/', requirePermission('units.create'), createUnit);

// ----- Работа с конкретной техникой -----
router.get('/:id', requirePermission('units.view'), getUnitById);
router.get(
    '/:id/history',
    requirePermission('units.view_history'),
    getUnitHistory
);
router.get(
    '/:id/metrics-history',
    requirePermission('units.view_history'),
    getUnitMetricsHistory
);
router.post(
    '/:id/metrics',
    requirePermission('units.update_metrics'),
    updateMetrics
);
// Сортировка техники в подразделении (перетаскивание) — ДО /:id
router.put('/order', requirePermission('units.update'), reorderUnits);
router.put('/:id', requirePermission('units.update'), updateUnit);
router.post(
    '/:id/status',
    requirePermission('units.update_status'),
    changeStatus
);
router.delete('/:id', requirePermission('units.delete'), deleteUnit);

module.exports = router;