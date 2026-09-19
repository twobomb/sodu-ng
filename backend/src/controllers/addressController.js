const addressAutocompleteService = require('../services/addressAutocompleteService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const MAX_LIMIT = 30;

// GET /api/address/autocomplete?q=...&limit=...
const autocomplete = asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, MAX_LIMIT) || 10;

    if (!q) {
        return res.json({query: q, results: []});
    }

    const t0 = Date.now();
    let results = [];
    try {
        results = addressAutocompleteService.autocomplete(q, {limit});
    } catch (err) {
        logger.error('Ошибка автодополнения адреса: ' + err.message, {stack: err.stack});
        return res.status(500).json({error: 'Ошибка автодополнения адреса'});
    }
    const tookMs = Date.now() - t0;

    res.json({query: q, tookMs, results});
});

module.exports = {autocomplete};