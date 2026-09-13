const settingsService = require('../services/settingsService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const pool = require('../db/pool');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');


const updateSettingsSchema = Joi.object({
    maintenance_mode: Joi.boolean(),
});

// GET /api/settings — только developer
const getSettings = asyncHandler(async (req, res) => {
    try {
        const settings = await settingsService.getAll();
        res.json(settings);
    } catch (err) {
        logger.error('Ошибка получения настроек: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка получения настроек' });
    }
});

// GET /api/settings/public — публичный (без авторизации)
const getPublicSettings = asyncHandler(async (req, res) => {
    try {
        const maintenanceMode = await settingsService.get('maintenance_mode');
        res.json({ maintenance_mode: !!maintenanceMode });
    } catch (err) {
        logger.error('Ошибка получения публичных настроек: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка получения настроек' });
    }
});

// PUT /api/settings — только developer
const updateSettings = asyncHandler(async (req, res) => {
    const { error, value } = updateSettingsSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const updates = {};

        if (value.maintenance_mode !== undefined) {
            await settingsService.set(
                'maintenance_mode',
                value.maintenance_mode,
                req.user.id
            );
            updates.maintenance_mode = value.maintenance_mode;
        }

        const io = req.app.get('io');

        // ---- Включение режима ТО ----
        if (value.maintenance_mode === true) {
            // Находим все сессии не-developer пользователей
            const sessions = await pool.query(`
                SELECT DISTINCT s.user_id
                FROM sessions s
                         JOIN users u ON s.user_id = u.id
                WHERE u.role != 'developer'
            `);

            const nonDevUserIds = sessions.rows.map((r) => r.user_id);

            // Удаляем их сессии
            if (nonDevUserIds.length) {
                await pool.query(
                    `DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`,
                    [nonDevUserIds]
                );
            }

            // Оповещаем сокеты: с причиной 'maintenance_mode', чтобы фронт
            // показал корректное сообщение на странице логина
            if (io) {
                for (const uid of nonDevUserIds) {
                    io.to(`user:${uid}`).emit('force_logout', {
                        reason: 'maintenance_mode',
                        message: 'Система переведена в режим технического обслуживания',
                    });
                }
                io.emit('force_refresh');
            }

            logger.warn(
                `Включён режим ТО. Сессий завершено: ${nonDevUserIds.length}`,
                { by: req.user.id }
            );
        }

        // ---- Выключение режима ТО ----
        if (value.maintenance_mode === false) {
            if (io) {
                io.emit('maintenance_mode_off');
                io.emit('force_refresh');
            }
            logger.info('Режим ТО выключен', { by: req.user.id });
        }

        res.json(updates);
    } catch (err) {
        logger.error('Ошибка обновления настроек: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления настроек' });
    }
});

// ============================================================
// Схема для broadcast
// ============================================================
const broadcastSchema = Joi.object({
    title: Joi.string().min(2).max(200).required(),
    message: Joi.string().min(1).max(5000).required(),
});

// ============================================================
// POST /api/settings/broadcast
// Отправка системного сообщения всем пользователям.
// Только developer.
// ============================================================
const sendBroadcast = asyncHandler(async (req, res) => {
    const { error, value } = broadcastSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const broadcast = {
            id: uuidv4(),
            title: value.title.trim(),
            message: value.message.trim(),
            sent_at: new Date().toISOString(),
            sent_by: req.user.username,
        };

        const io = req.app.get('io');
        if (io) {
            io.emit('admin:broadcast', broadcast);
        }

        logger.info(
            `Broadcast отправлен: "${broadcast.title}" (id=${broadcast.id})`,
            { by: req.user.id }
        );

        res.status(201).json(broadcast);
    } catch (err) {
        logger.error('Ошибка отправки broadcast: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({ error: err.message || 'Ошибка отправки' });
    }
});


module.exports = {
    getSettings,
    getPublicSettings,
    updateSettings,
    sendBroadcast,
};