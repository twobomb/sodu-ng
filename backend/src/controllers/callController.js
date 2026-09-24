const callService = require('../services/callService');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh, emitNewCall } = require('../utils/socketEvents');
const Joi = require('joi');

const CALL_TYPES = callService.CALL_TYPES;
const CALL_RANKS = callService.CALL_RANKS;
const CALL_STATUSES = callService.CALL_STATUSES;

// Валидируем строки дат (приходят как ISO-строка или пустая строка / null)
const datetimeField = Joi.string().allow('', null);

const intField = Joi.number().integer().min(0).allow('', null).empty('');

const personDead = Joi.object({
    fio: Joi.string().allow('', null),
    birth_date: Joi.string().allow('', null),
});
const personInjured = Joi.object({
    fio: Joi.string().allow('', null),
    birth_date: Joi.string().allow('', null),
    diagnosis: Joi.string().allow('', null),
    hospitalization: Joi.string().allow('', null),
    hospital: Joi.string().allow('', null),
});
const personRescued = Joi.object({
    fio: Joi.string().allow('', null),
    birth_date: Joi.string().allow('', null),
});
const fireLeader = Joi.object({
    fio: Joi.string().allow('', null),
    position: Joi.string().allow('', null),
});

const updateCallSchema = Joi.object({
    type: Joi.string().valid(...CALL_TYPES).allow('', null),
    rank: Joi.string().valid(...CALL_RANKS).allow('', null),
    incident_at: datetimeField,
    message_received_at: datetimeField,
    municipality_id: Joi.string().uuid().allow('', null),
    address: Joi.string().max(500).allow('', null),
    dispatch_at: datetimeField,
    arrival_at: datetimeField,
    localization_at: datetimeField,
    open_fire_eliminated_at: datetimeField,
    fire_eliminated_at: datetimeField,
    description: Joi.string().max(10000).allow('', null),
    fire_area: Joi.alternatives().try(Joi.number().min(0), Joi.string().allow('', null)).allow(null).empty(''),
    area_type: Joi.string().valid('urban', 'rural').allow('', null),
    fire_category_id: Joi.string().uuid().allow('', null),
    fire_cause_id: Joi.string().uuid().allow('', null),
    fire_cause_other: Joi.string().max(1000).allow('', null),
    not_accounted_fire: Joi.boolean().allow('', null),
    not_accounted_reason_id: Joi.string().uuid().allow('', null),
    victims_dead_total: intField,
    victims_dead_children: intField,
    victims_dead_data: Joi.array().items(personDead).default([]),
    victims_injured_total: intField,
    victims_injured_children: intField,
    victims_injured_data: Joi.array().items(personInjured).default([]),
    victims_rescued_total: intField,
    victims_rescued_children: intField,
    victims_rescued_data: Joi.array().items(personRescued).default([]),
    victims_evacuated_total: intField,
    victims_evacuated_children: intField,
    dtp_circumstances: Joi.string().allow('', null),
    dtp_vehicle_marks: Joi.array()
        .items(Joi.object({ mark: Joi.string().allow('', null) }))
        .default([]),
    dtp_work_description: Joi.string().allow('', null),
    involved_staff: Joi.array()
        .items(Joi.object({
            department_id: Joi.string().uuid().allow('', null),
            uid: Joi.string().max(64).allow('', null),
            name: Joi.string().max(500).allow('', null),
            count: intField.default(0),
        }))
        .default([]),
    fire_leaders: Joi.array()
        .items(fireLeader)
        .default([]),
}).min(1);

const setStatusSchema = Joi.object({
    status: Joi.string().valid(...CALL_STATUSES).required(),
});

const setUnitsSchema = Joi.object({
    unit_ids: Joi.array().items(Joi.string().uuid()).default([]),
});

const setDepartmentsSchema = Joi.object({
    department_ids: Joi.array().items(Joi.string().uuid()).default([]),
});

const addEventSchema = Joi.object({
    event_at: Joi.string().required(),
    text: Joi.string().min(1).max(5000).required(),
});

// ============================================================
// Вспомогательные
// ============================================================
const callExistsPermission = (req, permission) => {
    const user = req.user;
    if (!user) return false;
    if (user.role === 'developer') return true;
    return (user.permissions || []).includes(permission);
};

// Можно ли редактировать поля вызова:
//  - обработка / ошибка → нужно calls.update
//  - закрыт → нужно calls.update_closed
const canEditCall = (req, call) => {
    if (call.status === 'closed') {
        return callExistsPermission(req, 'calls.update_closed');
    }
    return callExistsPermission(req, 'calls.update');
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
// GET /api/calls — список с пагинацией и фильтрами
// ============================================================
const getCalls = asyncHandler(async (req, res) => {
    try {
        const filters = {
            status: req.query.status || 'all',
            type: req.query.type || 'all',
            municipality: req.query.municipality || 'all',
            search: req.query.search || '',
            date_from: req.query.date_from || null,
            date_to: req.query.date_to || null,
            created_from: req.query.created_from || null,
            created_to: req.query.created_to || null,
            page: req.query.page,
            pageSize: req.query.pageSize,
        };
        const result = await callService.getCalls(filters, {
            canViewAll: req.user.can_view_all,
            departmentIds: await callService.getUserDepartmentIds(req.user.id),
        });
        res.json(result);
    } catch (err) {
        logger.error('Ошибка получения вызовов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения вызовов' });
    }
});

// ============================================================
// GET /api/calls/monitor — мониторинг вызовов в обработке
// ============================================================
const getMonitorCalls = asyncHandler(async (req, res) => {
    try {
        const depts = await callService.getUserDepartmentIds(req.user.id);
        const rows = await callService.getMonitorCalls(
            req.user.id,
            req.user.can_view_all,
            depts
        );
        res.json(rows);
    } catch (err) {
        logger.error('Ошибка мониторинга вызовов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка мониторинга вызовов' });
    }
});

// ============================================================
// GET /api/calls/municipalities — округа, доступные пользователю
// ============================================================
const getMunicipalities = asyncHandler(async (req, res) => {
    try {
        const rows = await callService.getAccessibleMunicipalities(
            req.user.id,
            req.user.can_view_all
        );
        res.json(rows);
    } catch (err) {
        logger.error('Ошибка получения округов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения округов' });
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

        // Доступ к карточке: can_view_all видит всё, остальные — по привязанным подразделениям
        if (!req.user.can_view_all) {
            const depts = await callService.getUserDepartmentIds(req.user.id);
            const vis = await pool.query(
                `SELECT 1 FROM call_departments
                 WHERE call_id = $1 AND department_id = ANY($2) LIMIT 1`,
                [id, depts]
            );
            if (!vis.rows.length) {
                return res.status(403).json({ error: 'Нет доступа к этому вызову' });
            }
        }

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
// POST /api/calls — создание нового (пустые поля, тип «Пожар»)
// ============================================================
const createCall = asyncHandler(async (req, res) => {
    try {
        const call = await callService.createCall(req.user.id, req.user.can_view_all);
        const io = req.app.get('io');
        emitNewCall(io, call);
        emitForceRefresh(io, 'calls');
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
        emitForceRefresh(io, 'calls');
        res.json(updated);
    } catch (err) {
        if (err.status === 403 || err.status === 400) {
            return res.status(err.status).json({ error: err.message });
        }
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

        if (!callExistsPermission(req, 'calls.update_status')) {
            return res.status(403).json({ error: 'Недостаточно прав для смены статуса' });
        }

        // С закрытого вызова статус может менять только тот, кто может
        // редактировать закрытые вызовы
        if (call.status === 'closed' && !callExistsPermission(req, 'calls.update_closed')) {
            return res.status(403).json({
                error: 'Вызов закрыт. Менять статус могут только пользователи с правом правки закрытых вызовов.',
            });
        }

        const updated = await callService.setCallStatus(id, value.status);
        const io = req.app.get('io');
        emitForceRefresh(io, 'calls');
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

        const uniqueIds = [...new Set(value.unit_ids)];
        // Доступ пользователя к самому вызову (по привязанным подразделениям)
        if (!req.user.can_view_all) {
            const depts = await callService.getUserDepartmentIds(req.user.id);
            const vis = await pool.query(
                `SELECT 1 FROM call_departments
                 WHERE call_id = $1 AND department_id = ANY($2) LIMIT 1`,
                [id, depts]
            );
            if (!vis.rows.length) {
                return res.status(403).json({ error: 'Нет доступа к этому вызову' });
            }
        }

        // Проверяем доступ только к ВНОВЬ добавляемой технике.
        // Удаление техники не требует доступа, а уже прикреплённая техника
        // других подразделений не должна блокировать добавление своей.
        const currentUnitIds = (call.units || []).map((u) => u.unit_id);
        const addedIds = uniqueIds.filter((uid) => !currentUnitIds.includes(uid));
        await assertUnitAccess(req.user, addedIds);

        await callService.setCallUnits(id, uniqueIds);
        const updated = await callService.getCallById(id);

        const io = req.app.get('io');
        emitForceRefresh(io, 'calls');
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
        emitForceRefresh(io, 'calls');
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
        emitForceRefresh(io, 'calls');
        res.json({ ok: true });
    } catch (err) {
        logger.error(`Ошибка удаления события вызова ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка удаления события' });
    }
});

// ============================================================
// GET /api/calls/:id/departments — привязанные подразделения
// ============================================================
const getCallDepartments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const rows = await callService.getCallDepartments(id);
        res.json(rows);
    } catch (err) {
        logger.error(`Ошибка получения подразделений вызова ${id}: ` + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения подразделений' });
    }
});

// ============================================================
// PUT /api/calls/:id/departments — обновить привязку подразделений
// ============================================================
const setCallDepartments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error, value } = setDepartmentsSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const call = await callService.getCallById(id);
        if (!call) return res.status(404).json({ error: 'Вызов не найден' });
        if (!canEditCall(req, call)) {
            return res.status(403).json({
                error: call.status === 'closed'
                    ? 'Вызов закрыт. Редактировать могут только пользователи с правом правки закрытых вызовов.'
                    : 'Недостаточно прав для изменения доступа',
            });
        }

        const user = req.user;
        const unique = [...new Set(value.department_ids || [])];
        // Обычный пользователь может назначать только подразделения из своего доступа
        if (!user.can_view_all) {
            const depts = await callService.getUserDepartmentIds(user.id);
            if (unique.some((d) => !depts.includes(d))) {
                return res.status(403).json({ error: 'Нет доступа к одному из выбранных подразделений' });
            }
        }

        await callService.setCallDepartments(id, unique);
        const io = req.app.get('io');
        emitForceRefresh(io, 'calls');
        res.json(await callService.getCallDepartments(id));
    } catch (err) {
        logger.error(`Ошибка обновления доступа вызова ${id}: ` + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления доступа' });
    }
});

module.exports = {
    getCalls,
    getMonitorCalls,
    getMunicipalities,
    getCallById,
    createCall,
    updateCall,
    setCallStatus,
    setCallUnits,
    addCallEvent,
    deleteCallEvent,
    getCallDepartments,
    setCallDepartments,
};



