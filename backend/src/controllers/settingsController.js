const settingsService = require('../services/settingsService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const pool = require('../db/pool');
const fsp = require('fs/promises');
const { UPLOAD_DIR } = require('../config/upload');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');


const updateSettingsSchema = Joi.object({
    maintenance_mode: Joi.boolean(),
    chat_max_file_size_mb: Joi.number().integer().min(1).max(500),
    chat_max_total_storage_gb: Joi.number().integer().min(1).max(1000000),
    chat_max_pinned_chats: Joi.number().integer().min(1).max(50),
    chat_max_pinned_channels: Joi.number().integer().min(1).max(50),
    chat_edit_window_minutes: Joi.number().integer().min(1).max(1440),
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

// GET /api/settings/disk — информация о разделе, где хранится папка uploads.
// Нужна для подсказки при настройке общего лимита хранилища. Только developer.
const getUploadDisk = asyncHandler(async (req, res) => {
    try {
        const stats = await fsp.statfs(UPLOAD_DIR);
        const bsize = Number(stats.bsize);
        const totalBytes = Number(stats.blocks) * bsize;
        const freeBytes = Number(stats.bavail) * bsize;

        res.json({
            path: UPLOAD_DIR,
            total_bytes: totalBytes,
            free_bytes: freeBytes,
            used_bytes: totalBytes - freeBytes,
        });
    } catch (err) {
        logger.error('Ошибка получения данных о диске: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Не удалось получить информацию о разделе' });
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

        // --- Простые числовые настройки ---
        const numericKeys = [
            'chat_max_file_size_mb',
            'chat_max_total_storage_gb',
            'chat_max_pinned_chats',
            'chat_max_pinned_channels',
            'chat_edit_window_minutes',
        ];

        for (const key of numericKeys) {
            if (value[key] !== undefined) {
                await settingsService.set(key, value[key], req.user.id);
                updates[key] = value[key];
            }
        }

        const io = req.app.get('io');

        // --- Режим ТО ---
        if (value.maintenance_mode !== undefined) {
            await settingsService.set(
                'maintenance_mode',
                value.maintenance_mode,
                req.user.id
            );
            updates.maintenance_mode = value.maintenance_mode;

            if (value.maintenance_mode === true) {
                const sessions = await pool.query(`
          SELECT DISTINCT s.user_id
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE u.role != 'developer'
        `);
                const nonDevUserIds = sessions.rows.map((r) => r.user_id);

                if (nonDevUserIds.length) {
                    await pool.query(
                        `DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`,
                        [nonDevUserIds]
                    );
                }

                if (io) {
                    for (const uid of nonDevUserIds) {
                        io.to(`user:${uid}`).emit('force_logout', {
                            reason: 'maintenance_mode',
                        });
                    }
                    io.emit('force_refresh', { domains: ['settings'] });
                }

                logger.warn(
                    `Включён режим ТО. Сессий завершено: ${nonDevUserIds.length}`,
                    { by: req.user.id }
                );
            } else {
                if (io) {
                    io.emit('maintenance_mode_off');
                    io.emit('force_refresh', { domains: ['settings'] });
                }
                logger.info('Режим ТО выключен', { by: req.user.id });
            }
        }

        // Если поменяли размер файла — уведомим фронт
        if (updates.chat_max_file_size_mb !== undefined && io) {
            io.emit('force_refresh', { domains: ['settings'] });
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


// ============================================================
// Настройки СОДУ (глобальные, применяются ко всем пользователям)
// ============================================================
const SODU_SETTING_DEFAULTS = {
    map_link_template: 'https://yandex.ru/maps/?&text=Луганская Народная Республика,$ADDRESS&z=14',
    show_map_button: true,
    enable_address_autocomplete: true,
};

const soduSettingsSchema = Joi.object({
    map_link_template: Joi.string().allow('').max(1000),
    show_map_button: Joi.boolean(),
    enable_address_autocomplete: Joi.boolean(),
});

// GET /api/settings/sodu — доступно всем авторизованным (нужно для UI всех юзеров)
const getSoduSettings = asyncHandler(async (req, res) => {
    try {
        const all = await settingsService.getAll();
        const out = {};

        for (const key of Object.keys(SODU_SETTING_DEFAULTS)) {
            const v = all[key];
            if (key === 'map_link_template') {
                out[key] =
                    typeof v === 'string' && v !== ''
                        ? v
                        : SODU_SETTING_DEFAULTS[key];
            } else {
                // show_map_button / enable_address_autocomplete — булевы
                out[key] =
                    v === undefined ? SODU_SETTING_DEFAULTS[key] : !!v;
            }
        }

        res.json(out);
    } catch (err) {
        logger.error('Ошибка получения настроек СОДУ: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка получения настроек СОДУ' });
    }
});

// PUT /api/settings/sodu — только по праву sodu.settings
const updateSoduSettings = asyncHandler(async (req, res) => {
    const { error, value } = soduSettingsSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const keys = Object.keys(SODU_SETTING_DEFAULTS);
    try {
        const updates = {};
        for (const key of keys) {
            if (value[key] !== undefined) {
                await settingsService.set(key, value[key], req.user.id);
                updates[key] = value[key];
            }
        }

        const io = req.app.get('io');
        if (io) io.emit('force_refresh', { domains: ['sodu'] });

        res.json(updates);
    } catch (err) {
        logger.error('Ошибка обновления настроек СОДУ: ' + err.message, {
            stack: err.stack,
            body: req.body,
            user: req.user?.id,
        });
        res.status(500).json({
            error: err.message || 'Ошибка обновления настроек СОДУ',
        });
    }
});

module.exports = {
    getSettings,
    getPublicSettings,
    getUploadDisk,
    getSoduSettings,
    updateSoduSettings,
    updateSettings,
    sendBroadcast,
};