const addressAutocompleteService = require('../services/addressAutocompleteService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const MAX_LIMIT = 30;

// GET /api/address/autocomplete?q=...&limit=...
// Служебный параметр debug=1 добавляет в ответ диагностику (доступность БД, путь),
// чтобы было проще понять причину пустых результатов на продакшене.
const autocomplete = asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, MAX_LIMIT) || 10;
    const debug = req.query.debug === '1' || req.query.debug === 'true';

    let results = [];
    let tookMs = 0;
    if (q) {
        const t0 = Date.now();
        try {
            results = addressAutocompleteService.autocomplete(q, { limit });
            tookMs = Date.now() - t0;
        } catch (err) {
            logger.error('Ошибка автодополнения адреса: ' + err.message, { stack: err.stack });
            return res.status(500).json({ error: 'Ошибка автодополнения адреса' });
        }
    }

    // Служебная диагностика (debug=1) — видна причина пустых результатов на проде
    const payload = { query: q, tookMs, results };
    if (debug) {
        payload.available = addressAutocompleteService.isDbAvailable();
        payload.error = addressAutocompleteService.getDbError();
        payload.dbPath = addressAutocompleteService.getDbPath();
    }

    return res.json(payload);
});

module.exports = { autocomplete };