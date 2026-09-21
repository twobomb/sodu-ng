const lineNoteService = require('../services/lineNoteService');
const lineNoteExportService = require('../services/lineNoteExportService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const Joi = require('joi');
const pool = require('../db/pool');

const STATUSES = ['draft', 'approved'];

const listParamsSchema = Joi.object({
    departmentId: Joi.string().uuid().required(),
});

const dateParamsSchema = Joi.object({
    departmentId: Joi.string().uuid().required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
});

const createSchema = Joi.object({
    department_id: Joi.string().uuid().required(),
    note_date: Joi.date().iso().required(),
    status: Joi.string().valid(...STATUSES).default('draft'),
    data: Joi.object().default({}),
});

const updateSchema = Joi.object({
    status: Joi.string().valid(...STATUSES),
    data: Joi.object(),
});

// Проверка, что подразделение доступно пользователю
const canAccessDepartment = async (user, departmentId) => {
    if (user.can_view_all) return true;
    const res = await pool.query(
        `SELECT 1 FROM user_departments
         WHERE user_id = $1 AND department_id = $2`,
        [user.id, departmentId]
    );
    return res.rows.length > 0;
};

const doAccessCheck = async (res, user, departmentId) => {
    const ok = await canAccessDepartment(user, departmentId);
    if (!ok) {
        res.status(403).json({ error: 'Подразделение недоступно' });
        return false;
    }
    return true;
};

// GET /api/line-notes/department/:departmentId — список записей (даты+статусы)
const listByDepartment = asyncHandler(async (req, res) => {
    const { error, value } = listParamsSchema.validate(req.params);
    if (error) return res.status(400).json({ error: 'Некорректный id подразделения' });

    try {
        if (!(await doAccessCheck(res, req.user, value.departmentId))) return;
        const notes = await lineNoteService.listByDepartment(value.departmentId);
        res.json(notes);
    } catch (err) {
        logger.error('Ошибка получения списка строевых записок: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения списка' });
    }
});

// GET /api/line-notes/department/:departmentId/:date
const getByDate = asyncHandler(async (req, res) => {
    const { error, value } = dateParamsSchema.validate(req.params);
    if (error) return res.status(400).json({ error: 'Некорректные параметры' });

    try {
        if (!(await doAccessCheck(res, req.user, value.departmentId))) return;
        const note = await lineNoteService.getByDepartmentAndDate(
            value.departmentId,
            value.date
        );
        // 200 + null, если записки нет — чтобы клиент не плодил 404 и retry
        res.json(note || null);
    } catch (err) {
        logger.error('Ошибка получения строевой записки: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения записки' });
    }
});

// POST /api/line-notes
const create = asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        if (!(await doAccessCheck(res, req.user, value.department_id))) return;

        const exists = await lineNoteService.getByDepartmentAndDate(
            value.department_id,
            value.note_date
        );
        if (exists) {
            return res.status(409).json({ error: 'Записка на эту дату уже существует' });
        }

        // Создание сразу в статусе «Утверждённая» — только с правом «утверждение»
        const user = req.user;
        const has = (p) => user.role === 'developer' || (user.permissions || []).includes(p);
        if (value.status === 'approved' && !has('line_notes.approve')) {
            return res.status(403).json({
                error: 'Переводить записку в «Утверждённую» можно только с правом «утверждение»',
            });
        }

        const note = await lineNoteService.create({
            department_id: value.department_id,
            note_date: value.note_date,
            status: value.status,
            data: value.data,
            created_by: req.user.id,
        });

        const io = req.app.get('io');
        emitForceRefresh(io);
        res.status(201).json(note);
    } catch (err) {
        logger.error('Ошибка создания строевой записки: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания записки' });
    }
});

const copySchema = Joi.object({
    department_id: Joi.string().uuid().required(),
    from_date: Joi.date().iso().required(),
    to_date: Joi.date().iso().required(),
});

const statusDateSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
});

// GET /api/line-notes/status/:date — статусы записей всех доступных подразделений
const statusByDate = asyncHandler(async (req, res) => {
    const { error, value } = statusDateSchema.validate(req.params);
    if (error) return res.status(400).json({ error: 'Некорректная дата' });

    try {
        let deptIds;
        if (req.user.can_view_all) {
            const r = await pool.query('SELECT id FROM departments');
            deptIds = r.rows.map((x) => x.id);
        } else {
            deptIds = req.user.department_ids || [];
        }
        if (!deptIds.length) return res.json([]);

        const result = await lineNoteService.statusByDate(deptIds, value.date);
        res.json(result);
    } catch (err) {
        logger.error('Ошибка получения статусов строевых записок: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения статусов' });
    }
});

// POST /api/line-notes/export
const exportSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    federal_district: Joi.string().trim().max(200).default('Южный ФО'),
    mchs_org_name: Joi.string()
        .trim()
        .max(300)
        .default('ГУ МЧС России по Луганской Народной Республике'),
});

const exportFile = asyncHandler(async (req, res) => {
    if (!req.user.can_view_all && req.user.role !== 'developer') {
        return res
            .status(403)
            .json({ error: 'Выгрузка доступна только при доступе ко всем подразделениям' });
    }

    const { error, value } = exportSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const result = await lineNoteExportService.exportLineNotes({
            date: value.date,
            federalDistrict: value.federal_district,
            mchsOrg: value.mchs_org_name,
        });

        res.json({
            filename: result.filename,
            base64: result.buffer.toString('base64'),
            ignored: result.ignored,
        });
    } catch (err) {
        logger.error('Ошибка выгрузки строевой записки: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка выгрузки' });
    }
});

// POST /api/line-notes/copy
const copy = asyncHandler(async (req, res) => {
    const { error, value } = copySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        if (!(await doAccessCheck(res, req.user, value.department_id))) return;

        const fromDate = value.from_date.toISOString().slice(0, 10);
        const toDate = value.to_date.toISOString().slice(0, 10);
        if (fromDate === toDate) {
            return res.status(400).json({ error: 'Даты копирования должны отличаться' });
        }

        const result = await lineNoteService.copy({
            department_id: value.department_id,
            from_date: fromDate,
            to_date: toDate,
            created_by: req.user.id,
        });

        if (!result.ok) {
            const messages = {
                source_not_found: 'Записка-источник не найдена',
                target_approved: 'Нельзя копировать на утверждённую строевую записку',
            };
            const status = result.error === 'source_not_found' ? 404 : 400;
            return res
                .status(status)
                .json({ error: messages[result.error] || 'Невозможно выполнить копирование' });
        }

        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(result.note);
    } catch (err) {
        logger.error('Ошибка копирования строевой записки: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка копирования записки' });
    }
});

// PUT /api/line-notes/:id
const update = asyncHandler(async (req, res) => {
    const { error: paramError } = Joi.string().uuid().required().validate(req.params.id);
    if (paramError) return res.status(400).json({ error: 'Некорректный id' });

    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const note = await lineNoteService.getById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Записка не найдена' });

    try {
        if (!(await doAccessCheck(res, req.user, note.department_id))) return;

        const user = req.user;
        const has = (p) => user.role === 'developer' || (user.permissions || []).includes(p);
        const newStatus = value.status ?? note.status;
        const isApproved = note.status === 'approved';
        const becomingApproved = newStatus === 'approved' && note.status !== 'approved';

        // Утверждённую записку может редактировать (или возвращать в черновик)
        // только пользователь с правом «редактирование утверждённых»
        if (isApproved) {
            if (!has('line_notes.edit_approved')) {
                return res.status(403).json({
                    error:
                        'Утверждённые записки можно редактировать только с правом «редактирование утверждённых»',
                });
            }
        } else if (!has('line_notes.manage') && !becomingApproved) {
            return res.status(403).json({ error: 'Недостаточно прав для редактирования' });
        }

        // Перевод в «Утверждённую» — только с правом «утверждение»
        if (becomingApproved && !has('line_notes.approve')) {
            return res.status(403).json({
                error: 'Переводить записку в «Утверждённую» можно только с правом «утверждение»',
            });
        }

        const updated = await lineNoteService.update(req.params.id, value);
        const io = req.app.get('io');
        emitForceRefresh(io);
        res.json(updated);
    } catch (err) {
        logger.error('Ошибка обновления строевой записки: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления записки' });
    }
});

module.exports = {
    listByDepartment,
    getByDate,
    create,
    update,
    copy,
    statusByDate,
    exportFile,
};