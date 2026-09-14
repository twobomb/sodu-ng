const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { UPLOAD_DIR } = require('../config/upload');

// ============================================================
// GET /api/settings/files
// Список всех файлов в uploads/ с привязкой к БД
// ============================================================
const listFiles = asyncHandler(async (req, res) => {
    try {
        // Один запрос всех attachments — эффективнее, чем по файлу
        const dbRes = await pool.query(`
      SELECT id, stored_name, original_name, mime_type, is_public,
             conversation_id, message_id, created_at, is_missing
      FROM attachments
    `);
        const byStoredName = {};
        for (const row of dbRes.rows) {
            byStoredName[row.stored_name] = row;
        }

        const names = await fsp.readdir(UPLOAD_DIR);
        const items = [];

        for (const name of names) {
            const fullPath = path.join(UPLOAD_DIR, name);
            try {
                const stat = await fsp.stat(fullPath);
                if (!stat.isFile()) continue;

                const attachment = byStoredName[name] || null;
                const isThumb = name.startsWith('thumb_');

                items.push({
                    stored_name: name,
                    size: stat.size,
                    fs_created_at: (stat.birthtime && stat.birthtime.getTime() > 0
                            ? stat.birthtime
                            : stat.ctime
                    ).toISOString(),
                    fs_modified_at: stat.mtime.toISOString(),
                    // Из БД (если привязан)
                    attachment_id: attachment?.id || null,
                    original_name: attachment?.original_name || null,
                    mime_type: attachment?.mime_type || null,
                    message_id: attachment?.message_id || null,
                    conversation_id: attachment?.conversation_id || null,
                    db_created_at: attachment?.created_at || null,
                    is_missing: attachment?.is_missing || false,
                    is_orphan: !attachment && !isThumb,
                    is_thumbnail: isThumb,
                });
            } catch (_) {
                // пропускаем битые файлы
            }
        }

        res.json(items);
    } catch (err) {
        logger.error('Ошибка получения списка файлов: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения списка файлов' });
    }
});

// ============================================================
// GET /api/settings/files/folder-size
// Общий вес папки uploads
// ============================================================
const getFolderSize = asyncHandler(async (req, res) => {
    try {
        const names = await fsp.readdir(UPLOAD_DIR);
        let totalBytes = 0;
        let filesCount = 0;
        let orphansBytes = 0;
        let orphansCount = 0;

        // Получаем список всех stored_name из БД
        const dbRes = await pool.query(`SELECT stored_name FROM attachments`);
        const knownFiles = new Set(dbRes.rows.map((r) => r.stored_name));

        for (const name of names) {
            try {
                const stat = await fsp.stat(path.join(UPLOAD_DIR, name));
                if (!stat.isFile()) continue;
                totalBytes += stat.size;
                filesCount++;

                const isThumb = name.startsWith('thumb_');
                if (!knownFiles.has(name) && !isThumb) {
                    orphansBytes += stat.size;
                    orphansCount++;
                }
            } catch (_) {}
        }

        res.json({
            total_bytes: totalBytes,
            files_count: filesCount,
            orphans_bytes: orphansBytes,
            orphans_count: orphansCount,
        });
    } catch (err) {
        logger.error('Ошибка подсчёта размера папки: ' + err.message, {
            stack: err.stack,
        });
        res.status(500).json({ error: 'Ошибка подсчёта размера' });
    }
});

// ============================================================
// POST /api/settings/files/delete
// Удаление списка файлов: { files: ['stored_name1', ...] }
// ============================================================
const deleteFiles = asyncHandler(async (req, res) => {
    const { files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Не передан список файлов' });
    }

    if (files.length > 500) {
        return res
            .status(400)
            .json({ error: 'За раз можно удалить не более 500 файлов' });
    }

    const deleted = [];
    const failed = [];

    for (const name of files) {
        // Защита от path traversal
        if (
            typeof name !== 'string' ||
            name.includes('/') ||
            name.includes('\\') ||
            name.includes('..') ||
            name.length === 0
        ) {
            failed.push({ name, error: 'Недопустимое имя файла' });
            continue;
        }

        const fullPath = path.join(UPLOAD_DIR, name);
        try {
            await fsp.unlink(fullPath);

            // Помечаем в БД как missing, чтобы фронт не пытался скачать
            await pool.query(
                `UPDATE attachments SET is_missing = true WHERE stored_name = $1`,
                [name]
            );

            deleted.push(name);
        } catch (err) {
            failed.push({ name, error: err.message });
        }
    }

    logger.warn(
        `Удалено файлов: ${deleted.length}, ошибок: ${failed.length}`,
        { by: req.user.id, deleted }
    );

    res.json({ deleted, failed });
});

module.exports = { listFiles, getFolderSize, deleteFiles };