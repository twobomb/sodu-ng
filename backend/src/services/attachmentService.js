const pool = require('../db/pool');
const fs = require('fs');                 // синхронные: existsSync
const fsp = require('fs/promises');       // асинхронные: unlink, access, mkdir
const path = require('path');
const { UPLOAD_DIR, AVATARS_DIR } = require('../config/upload');

// Опциональный sharp — если не установлен, работаем без превью
let sharp = null;
try {
    sharp = require('sharp');
} catch (err) {
    console.warn('sharp не установлен — превью картинок генерироваться не будут');
}

const IMAGE_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);

const createAttachments = async ({
                                     conversationId,
                                     files,
                                     userId,
                                     isPublic = false,
                                 }) => {
    const client = await pool.connect();
    const results = [];

    try {
        await client.query('BEGIN');

        for (const file of files) {
            let width = null;
            let height = null;

            if (sharp && IMAGE_MIMES.has(file.mimetype)) {
                try {
                    const meta = await sharp(file.path).metadata();
                    width = meta.width || null;
                    height = meta.height || null;
                } catch (err) {}
            }

            const res = await client.query(
                `INSERT INTO attachments
                 (conversation_id, original_name, stored_name, mime_type, size, width, height, is_public)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING *`,
                [
                    conversationId,
                    file.originalname,
                    file.filename,
                    file.mimetype,
                    file.size,
                    width,
                    height,
                    isPublic,
                ]
            );
            results.push(res.rows[0]);
        }

        await client.query('COMMIT');
        return results;
    } catch (err) {
        await client.query('ROLLBACK');
        for (const file of files) {
            try {
                await fsp.unlink(file.path);
            } catch (_) {}
        }
        throw err;
    } finally {
        client.release();
    }
};

const getAttachmentById = async (id) => {
    const res = await pool.query(
        `SELECT * FROM attachments WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// Проверка, что пользователь — участник разговора, к которому привязан файл
const canAccessAttachment = async (attachmentId, userId) => {
    // 1. Публичные (аватары) — доступны всем авторизованным
    const publicRes = await pool.query(
        `SELECT 1 FROM attachments WHERE id = $1 AND is_public = true`,
        [attachmentId]
    );
    if (publicRes.rows.length) return true;

    // 2. Иначе — только участники разговора
    const res = await pool.query(
        `SELECT 1
         FROM attachments a
                  JOIN conversation_members cm
                       ON cm.conversation_id = a.conversation_id AND cm.user_id = $2
         WHERE a.id = $1`,
        [attachmentId, userId]
    );
    return res.rows.length > 0;
};

// ============================================================
// Путь, куда ДОЛЖЕН быть записан файл
// ============================================================
const getFilePath = (attachment) => {
    const baseDir = attachment.is_public ? AVATARS_DIR : UPLOAD_DIR;
    return path.join(baseDir, attachment.stored_name);
};

// ============================================================
// Путь для ЧТЕНИЯ — с обратной совместимостью.
// Если аватар помечен is_public, но файла в uploads_avatars нет,
// пробуем найти его в uploads (старое место хранения).
// ============================================================
const getFilePathRead = (attachment) => {
    const primary = attachment.is_public
        ? path.join(AVATARS_DIR, attachment.stored_name)
        : path.join(UPLOAD_DIR, attachment.stored_name);

    if (fs.existsSync(primary)) return primary;

    // Fallback для старых аватаров из uploads/
    if (attachment.is_public) {
        const legacy = path.join(UPLOAD_DIR, attachment.stored_name);
        if (fs.existsSync(legacy)) return legacy;
    }

    return primary;
};

// Генерация превью (jpg 400px по ширине)
const getThumbnailPath = async (attachment) => {
    if (!sharp || !IMAGE_MIMES.has(attachment.mime_type)) return null;

    const originalPath = getFilePath(attachment);
    const thumbName = `thumb_${attachment.id}.jpg`;
    const thumbPath = path.join(UPLOAD_DIR, thumbName);

    // Кешируем: если уже есть — отдаём
    try {
        await fsp.access(thumbPath);
        return thumbPath;
    } catch (_) {
        // Нет — генерируем
    }

    try {
        await sharp(originalPath)
            .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
        return thumbPath;
    } catch (err) {
        return null;
    }
};

// Удаление файла с диска (для очистки)
const deleteFileFromDisk = async (storedName) => {
    try {
        await fsp.unlink(path.join(UPLOAD_DIR, storedName));
    } catch (_) {
        /* ignore */
    }
};

module.exports = {
    createAttachments,
    getAttachmentById,
    canAccessAttachment,
    getFilePath,
    getFilePathRead,
    getThumbnailPath,
    deleteFileFromDisk,
    IMAGE_MIMES,
};