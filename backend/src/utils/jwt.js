const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Генерирует JWT токен для пользователя
 * @param {object} payload - данные для токена (обычно id и роль)
 * @param {string} expiresIn - время жизни (например '7d')
 * @returns {string} токен
 */
const generateToken = (payload, expiresIn = '7d') => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Проверяет и декодирует JWT токен
 * @param {string} token
 * @returns {object|null} декодированный payload или null при ошибке
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
};

module.exports = { generateToken, verifyToken };