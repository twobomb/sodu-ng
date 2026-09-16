const callService = require('../services/callService');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');

const CALL_TYPES = callService.CALL_TYPES;
const CALL_RANKS = callService.CALL_RANKS;
const CALL_STATUSES = callService.CALL_STATUSES;

// Валидируем строки дат (приходят как ISO-строка или пустая строка / null)
const datetimeField = Joi.string().allow('', null);

const updateCallSchema = Joi.object({
    type: Joi.string().valid(...CALL_TYPES).allow('', null),
    rank: Joi.string().valid(...CALL_RANKS).allow('', null),
    incident_at: datetimeField,
    message_received_at: datetimeField,
    municipality: Joi.string().max(300).allow('', null),
    address: Joi.string().max(500).allow('', null),
    dispatch_at: datetimeField,
    arrival_at: datetimeField,
    localization_at: datetimeField,
    open_fire_eliminated_at: datetimeField,
    fire_eliminated_at: datetimeField,
    description: Joi.string().max(10000).allow('', null),
}).min(1);

const setStatusSchema = Joi.object({
    status: Joi.string().valid(...CALL_STATUSES).required(),
});

const setUnitsSchema = Joi.object({
    unit_ids: Joi.array().items(Joi.string().uuid()).default([]),
});

const addEventSchema = Joi.object({
    event_at: Joi.string().required(),
    text: Joi.string().min(1).max(5000).required(),
});

// ============================================================
// Вспомогательные
// ============================================================
// Можно ли редактировать поля вызова:
//  - обработка / ошибка → нужно calls.update
//  - закрыт → нужно calls.update_closed
const canEditCall = (req, call) => {
    if (call.status === 'closed') {
        return callExistsPermission(req, 'calls.update_closed');
    }
    return callExistsPermission(req, 'calls.update');
};

// Для юнит-тестов не нужен, просто обёртка над hasPermission-like через роли.
// Т.к. в этом проекте проверка прав — на middleware, здесь мы просто проверяем флаг
// (developer уже прошёл middleware; у него permissions = null).
const callExistsPermission = (req, permission) => {
    const user = req.user;
    if (!user) return false;
    if (user.role === 'developer') return true;
    return (user.permissions || []).includes(permission);
};

// Проверить доступ пользователя к каждой единице техники
const assertUnitAccess = async (user, unitIds) => {
    if (!unitIds.length) return;
    if (user.can_view_all) return;

    const deps = await callService.getUserDepartmentIds(user.id);
    if (!deps.length) return;

    const res = await pool.query(
        `SELECT id, department_id FROM units WHERE id = ANY($1)`,
        [unitIds]
    );
    const byId = new Map(res.rows.map((r) => [r.id, r.department_id]));
    for (const unitId of unitIds) {
        const dept = byId.get(unitId);
        if (!dept) {
            const err = new Error('Техника не найдена');
            err.status = 400;
            throw err;
        }
        if (!deps.includes(dept)) {
            const err = new Error('Нет доступа к технике одного из подразделений');
            err.status = 403;
            throw err;
        }
    }
};

// ============================================================
// GET /api/calls
// ============================================================
const getCalls = asyncHandler(async (req, res) => {
    try {
        const filters = {
            status: req.query.status || 'all',
            type: req.query.type || 'all',
            search: req.query.search || '',
            date_from: req.query.date_from || null,
            date_to: req.query.date_to || null,
        };
        const calls = await callService.getCalls(filters);
        res.json(calls);
    } catch (err) {
        logger.error('Ошибка получения вызовов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения вызовов' });
    }
});

// ============================================================
// GET /api/calls/:id
// ============================================================
const getCallById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });
        res.json(call);
    } catch (err) {
        logger.error(`Ошибка получения вызова ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения вызова' });
    }
});

// ============================================================
// POST /api/calls — создание нового (пустые поля)
// ============================================================
const createCall = asyncHandler(async (req, res) => {
    try {
        const call = await callService.createCall(req.user.id);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(call);
    } catch (err) {
        logger.error('Ошибка создания вызова: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка создания вызова' });
    }
});

// ============================================================
// PUT /api/calls/:id — редактирование полей
// ============================================================
const updateCall = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = updateCallSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });

        if (!canEditCall(req, call)) {
            return res.status(403).json({
                error: call.status === 'closed'
                    ? 'Вызов закрыт. Редактировать могут только пользователи с правом правки закрытых вызовов.'
                    : 'Недостаточно прав для редактирования вызова',
            });
        }

        const updated = await callService.updateCall(id, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка обновления вызова ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления вызова' });
    }
});

// ============================================================
// PUT /api/calls/:id/status — смена статуса
// ============================================================
const setCallStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = setStatusSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });

        // Ошибочный — аналог удаления. Разрешаем только с правом смены статуса;
        // документируется на фронте подтверждением.
        if (!callExistsPermission(req, 'calls.update_status')) {
            return res.status(403).json({ error: 'Недостаточно прав для смены статуса' });
        }

        const updated = await callService.setCallStatus(id, value.status);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error(`Ошибка смены статуса вызова ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка смены статуса' });
    }
});

// ============================================================
// PUT /api/calls/:id/units — привлекаемая техника
// ============================================================
const setCallUnits = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = setUnitsSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });

        if (!canEditCall(req, call)) {
            return res.status(403).json({
                error: call.status === 'closed'
                    ? 'Вызов закрыт. Редактировать могут только пользователи с правом правки закрытых вызовов.'
                    : 'Недостаточно прав для редактирования вызова',
            });
        }

        // Проверяем доступ к каждой единице техники
        const uniqueIds = [...new Set(value.unit_ids)];
        await assertUnitAccess(req.user, uniqueIds);

        await callService.setCallUnits(id, uniqueIds);
        const updated = await callService.getCallById(id);

        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        if (err.status === 403 || err.status === 400) {
            return res.status(err.status).json({ error: err.message });
        }
        logger.error(`Ошибка привязки техники вызова ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка привязки техники' });
    }
});

// ============================================================
// POST /api/calls/:id/events — добавить ход событий
// ============================================================
const addCallEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = addEventSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });

        if (!canEditCall(req, call)) {
            return res.status(403).json({
                error: call.status === 'closed'
                    ? 'Вызов закрыт. Редактировать могут только пользователи с правом правки закрытых вызовов.'
                    : 'Недостаточно прав для добавления событий',
            });
        }

        const event = await callService.addCallEvent(id, req.user.id, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(event);
    } catch (err) {
        logger.error(`Ошибка добавления события вызова ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка добавления события' });
    }
});

// ============================================================
// DELETE /api/calls/:id/events/:eventId
// ============================================================
const deleteCallEvent = asyncHandler(async (req, res) => {
    const { id, eventId } = req.params;
    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });

        if (!canEditCall(req, call)) {
            return res.status(403).json({
                error: call.status === 'closed'
                    ? 'Вызов закрыт. Редактировать могут только пользователи с правом правки закрытых вызовов.'
                    : 'Недостаточно прав для редактирования вызова',
            });
        }

        const deleted = await callService.deleteCallEvent(id, eventId);
        if (!deleted) return res.status(404).json({ error: 'Событие не найдено' });

        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json({ ok: true });
    } catch (err) {
        logger.error(`Ошибка удаления события вызова ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка удаления события' });
    }
});

module.exports = {
    getCalls,
    getCallById,
    createCall,
    updateCall,
    setCallStatus,
    setCallUnits,
    addCallEvent,
    deleteCallEvent,
};