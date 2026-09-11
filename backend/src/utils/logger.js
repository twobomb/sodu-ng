const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
// Создаём папку, если её нет
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}


const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            return stack
                ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
                : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        // Все логи в файл combined.log
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5 MB
            maxFiles: 5,
        }),
        // Только ошибки в error.log
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }),
        // Вывод в консоль с цветами
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, stack }) => {
                    return stack
                        ? `[${timestamp}] ${level}: ${message}\n${stack}`
                        : `[${timestamp}] ${level}: ${message}`;
                })
            ),
        }),
    ],
});

module.exports = logger;