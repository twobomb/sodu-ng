const path = require('path');
const fs = require('fs');
const chatService = require('../services/chatService');
const attachmentService = require('../services/attachmentService');
const settingsService = require('../services/settingsService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { buildUploadMiddleware } = require('../config/upload');
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
// POST /api/chat/conversations/:id/upload
// multipart/form-data, поле "files" (до 10 файлов)
// ============================================================
const uploadFiles = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    // purpose: 'avatar' — файл помечается как публичный
    const purpose = req.query.purpose || req.body?.purpose || null;
    const isPublic = purpose === 'avatar';

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Файлы не переданы' });
    }

    try {
        const isMember = await chatService.isMember(conversationId, userId);
        if (!isMember) {
            for (const f of req.files) {
                try { fs.unlinkSync(f.path); } catch (_) {}
            }
            return res.status(403).json({ error: 'Нет доступа к этому чату' });
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

        const filePath = attachmentService.getFilePath(attachment);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Файл не найден на диске' });
        }

        // inline для картинок, attachment для остальных — но фронт сам решает,
        // через атрибут download у <a>. Отдаём как attachment для безопасности.
        res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
        res.setHeader('Content-Length', attachment.size);
        // RFC 5987 — безопасная передача unicode имени
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
// Отдаёт превью (jpg) для картинок, оригинал для остальных или 404
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

        const thumbPath = await attachmentService.getThumbnailPath(attachment);
        if (thumbPath && fs.existsSync(thumbPath)) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'private, max-age=86400');
            return fs.createReadStream(thumbPath).pipe(res);
        }

        // Нет превью — отдаём оригинал, если это картинка
        if (attachmentService.IMAGE_MIMES.has(attachment.mime_type)) {
            const originalPath = attachmentService.getFilePath(attachment);
            if (fs.existsSync(originalPath)) {
                res.setHeader('Content-Type', attachment.mime_type);
                res.setHeader('Cache-Control', 'private, max-age=86400');
                return fs.createReadStream(originalPath).pipe(res);
            }
        }

        res.status(404).json({ error: 'Превью недоступно' });
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