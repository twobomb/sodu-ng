const dailyStatementService = require('../services/dailyStatementExportService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const Joi = require('joi');

const exportSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    dolzhnost: Joi.string().trim().max(300).allow('', null).default(''),
    zvanie: Joi.string().trim().max(200).allow('', null).default(''),
    fio: Joi.string().trim().max(300).allow('', null).default(''),
});

// POST /api/daily-statement/export
const exportStatement = asyncHandler(async (req, res) => {
    if (!req.user.can_view_all && req.user.role !== 'developer') {
        return res
            .status(403)
            .json({ error: 'Выгрузка ведомости доступна только при доступе ко всем подразделениям' });
    }

    const { error, value } = exportSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const result = await dailyStatementService.exportStatement(value);

        res.json({
            filename: result.filename,
            base64: result.buffer.toString('base64'),
            total: result.total,
        });
    } catch (err) {
        logger.error('Ошибка выгрузки суточной ведомости: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка выгрузки' });
    }
});

module.exports = { exportStatement };
