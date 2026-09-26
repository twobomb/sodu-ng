const callJournalExportService = require('../services/callJournalExportService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const Joi = require('joi');

const exportSchema = Joi.object({
    date_from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    date_to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    sdal_zvanie: Joi.string().trim().max(200).allow('', null).default(''),
    sdal_fio: Joi.string().trim().max(300).allow('', null).default(''),
    prinyal_zvanie: Joi.string().trim().max(200).allow('', null).default(''),
    prinyal_fio: Joi.string().trim().max(300).allow('', null).default(''),
    proveril_zvanie: Joi.string().trim().max(200).allow('', null).default(''),
    proveril_fio: Joi.string().trim().max(300).allow('', null).default(''),
});

// POST /api/call-journal/export
const exportJournal = asyncHandler(async (req, res) => {
    if (!req.user.can_view_all && req.user.role !== 'developer') {
        return res
            .status(403)
            .json({ error: 'Выгрузка журнала доступна только при доступе ко всем подразделениям' });
    }

    const { error, value } = exportSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.date_to < value.date_from) {
        return res.status(400).json({ error: 'Дата «по» не может быть раньше даты «с»' });
    }

    try {
        const result = await callJournalExportService.exportJournal(value);

        if (result.empty) {
            return res.status(404).json({ error: 'Нет вызовов за выбранный период' });
        }

        res.json({
            filename: result.filename,
            base64: result.buffer.toString('base64'),
            ignored: result.ignored,
        });
    } catch (err) {
        logger.error('Ошибка выгрузки журнала вызовов: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка выгрузки' });
    }
});

module.exports = { exportJournal };