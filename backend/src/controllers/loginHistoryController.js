const loginHistoryService = require('../services/loginHistoryService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const getLoginHistory = asyncHandler(async (req, res) => {
    try {
        const userId = req.query.userId || null;
        const search = req.query.search || '';
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const data = await loginHistoryService.getLoginHistory({
            userId,
            search,
            limit,
            offset,
        });

        res.json(data);
    } catch (err) {
        logger.error('Ошибка получения истории входов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения истории входов' });
    }
});

module.exports = { getLoginHistory };