const path = require('path');
const fs = require('fs');
const chatService = require('../services/chatService');
const attachmentService = require('../services/attachmentService');
const settingsService = require('../services/settingsService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { buildUploadMiddleware } = require('../config/upload');
const pool = require('../db/pool');

// ============================================================
// Middleware: динамический multer на основе настройки
// ВАЖНО: не async-функция, чтобы Express точно дождался multer
// ============================================================
const uploadMiddleware = (req, res, next) => {
    settingsService
        .get('chat_max_file_size_mb')
        .then((val) => {
            const limitMb = Number(val) || 20;
            const limitBytes = limitMb * 1024 * 1024;

            const mw = buildUploadMiddleware(limitBytes);

            mw(req, res, (err) => {
                if (err) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(413).json({
                            error: `Файл превышает максимальный размер (${limitMb} МБ)`,
                        });
                    }
                    if (err.code === 'LIMIT_FILE_COUNT') {
                        return res
                            .status(400)
                            .json({ error: 'Слишком много файлов за раз (макс. 10)' });
                    }
                    logger.error('Ошибка multer: ' + err.message);
                    return res.status(500).json({ error: 'Ошибка загрузки файла' });
                }
                next();
            });
        })
        .catch(next);
};

// ============================================================
// Вспомогательная: сбросить is_missing, если файл снова на месте
// ============================================================
const clearMissingFlag = async (attachmentId) => {
    try {
        await pool.query(
            `UPDATE attachments SET is_missing = false
       WHERE id = $1 AND is_missing = true`,
            [attachmentId]
        );
    } catch (_) {
        // не критично
    }
};

const setMissingFlag = async (attachmentId) => {
    try {
        await pool.query(
            `UPDATE attachments SET is_missing = true
       WHERE id = $1 AND is_missing = false`,
            [attachmentId]
        );
    } catch (_) {
        // не критично
    }
};

// ============================================================
// Удаление временно загруженных файлов с диска (при отмене загрузки)
// ============================================================
const removeUploadedFiles = (files) => {
    if (!Array.isArray(files)) return;
    for (const f of files) {
        try {
            fs.unlinkSync(f.path);
        } catch (_) {}
    }
};

// ============================================================
// Проверка общего лимита хранилища.
// Размер уже загруженных файлов считается ТОЛЬКО по БД
// (без обращения к диску), чтобы не нагружать систему.
// Если после загрузки будет превышен лимит — загрузку отменяем.
// ============================================================
const exceedsTotalStorage = async (additionalBytes) => {
    const limitGb = Number(
        await settingsService.get('chat_max_total_storage_gb')
    );
    if (!limitGb || limitGb <= 0) return false; // лимит не задан — не ограничиваем

    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const usedBytes = await attachmentService.getTotalStoredBytes();

    return usedBytes + additionalBytes > limitBytes;
};

// ============================================================
// POST /api/chat/conversations/:id/upload
// ============================================================
const uploadFiles = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    const purpose = req.query.purpose || req.body?.purpose || null;
    const isPublic = purpose === 'avatar';

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Файлы не переданы' });
    }

    // Суммарный размер загружаемых файлов (из multer, без чтения с диска)
    const newBytes = req.files.reduce(
        (sum, f) => sum + (Number(f.size) || 0),
        0
    );

    try {
        const isMember = await chatService.isMember(conversationId, userId);
        if (!isMember) {
            removeUploadedFiles(req.files);
            return res.status(403).json({ error: 'Нет доступа к этому чату' });
        }

        // Общий лимит хранилища: проверяем ТОЛЬКО по БД
        if (await exceedsTotalStorage(newBytes)) {
            removeUploadedFiles(req.files);
            logger.warn(
                `Отклонена загрузка: превышен общий лимит хранилища ` +
                    `(+${newBytes} байт)`,
                { user: userId, conversationId }
            );
            return res.status(413).json({
                error:
                    'Превышен максимальный размер хранимых файлов. ' +
                    'Обратитесь к администратору, чтобы он освободил пространство.',
            });
        }

        const attachments = await attachmentService.createAttachments({
            conversationId,
            files: req.files,
            userId,
            isPublic,
        });

        res.status(201).json(attachments);
    } catch (err) {
        logger.error('Ошибка загрузки файлов: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId,
        });
        res.status(500).json({ error: err.message || 'Ошибка загрузки' });
    }
});

// ============================================================
// GET /api/chat/attachments/:id/download
// ============================================================
const downloadAttachment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const canAccess = await attachmentService.canAccessAttachment(id, userId);
        if (!canAccess) {
            return res.status(403).json({ error: 'Нет доступа к файлу' });
        }

        const attachment = await attachmentService.getAttachmentById(id);
        if (!attachment) {
            return res.status(404).json({ error: 'Файл не найден' });
        }

        const filePath = attachmentService.getFilePathRead(attachment);
        const fileExists = fs.existsSync(filePath);

        if (!fileExists) {
            // Файл отсутствует — помечаем и возвращаем 410
            await setMissingFlag(attachment.id);
            logger.warn(
                `Файл отсутствует на диске: ${attachment.id} (${attachment.original_name})`
            );
            return res.status(410).json({
                error: 'Файл был удалён с сервера',
                code: 'FILE_MISSING',
            });
        }

        // Файл на месте — на всякий случай сбрасываем флаг, если он был
        if (attachment.is_missing) {
            await clearMissingFlag(attachment.id);
        }

        res.setHeader(
            'Content-Type',
            attachment.mime_type || 'application/octet-stream'
        );
        res.setHeader('Content-Length', attachment.size);
        const safeName = encodeURIComponent(attachment.original_name);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${attachment.id}"; filename*=UTF-8''${safeName}`
        );

        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        logger.error('Ошибка скачивания файла: ' + err.message, {
            stack: err.stack,
            user: userId,
            attachmentId: id,
        });
        res.status(500).json({ error: 'Ошибка скачивания' });
    }
});

// ============================================================
// GET /api/chat/attachments/:id/preview
// ============================================================
const previewAttachment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const canAccess = await attachmentService.canAccessAttachment(id, userId);
        if (!canAccess) {
            return res.status(403).json({ error: 'Нет доступа к файлу' });
        }

        const attachment = await attachmentService.getAttachmentById(id);
        if (!attachment) {
            return res.status(404).json({ error: 'Файл не найден' });
        }

        // 1. Пытаемся отдать превью (jpg-миниатюра)
        const thumbPath = await attachmentService.getThumbnailPath(attachment);
        if (thumbPath && fs.existsSync(thumbPath)) {
            if (attachment.is_missing) await clearMissingFlag(attachment.id);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'private, max-age=86400');
            return fs.createReadStream(thumbPath).pipe(res);
        }

        // 2. Оригинал, если это картинка
        if (attachmentService.IMAGE_MIMES.has(attachment.mime_type)) {
            const originalPath = attachmentService.getFilePath(attachment);
            if (fs.existsSync(originalPath)) {
                if (attachment.is_missing) await clearMissingFlag(attachment.id);
                res.setHeader('Content-Type', attachment.mime_type);
                res.setHeader('Cache-Control', 'private, max-age=86400');
                return fs.createReadStream(originalPath).pipe(res);
            }
        }

        // 3. Ни превью, ни оригинала — файла нет
        await setMissingFlag(attachment.id);
        logger.warn(
            `Превью недоступно (файл отсутствует): ${attachment.id} (${attachment.original_name})`
        );
        return res.status(410).json({
            error: 'Файл был удалён с сервера',
            code: 'FILE_MISSING',
        });
    } catch (err) {
        logger.error('Ошибка получения превью: ' + err.message, {
            stack: err.stack,
            user: userId,
            attachmentId: id,
        });
        res.status(500).json({ error: 'Ошибка получения превью' });
    }
});

module.exports = {
    uploadMiddleware,
    uploadFiles,
    downloadAttachment,
    previewAttachment,
};