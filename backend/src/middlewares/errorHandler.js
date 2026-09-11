const logger = require('../utils/logger');

// 404 — не найдено
const notFoundHandler = (req, res, next) => {
    res.status(404).json({ error: 'Маршрут не найден' });
};

// Централизованный обработчик ошибок
const errorHandler = (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Внутренняя ошибка сервера';

    // Логируем с полным стеком
    logger.error(`${req.method} ${req.originalUrl} - ${message}`, {
        stack: err.stack,
        status,
        body: req.body,
        params: req.params,
        query: req.query,
        user: req.user?.id,
    });

    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = { notFoundHandler, errorHandler };