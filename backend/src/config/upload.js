const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

dotenv.config();

const UPLOAD_DIR = path.resolve(
    process.cwd(),
    process.env.UPLOAD_DIR || './uploads'
);

const AVATARS_DIR = path.resolve(
    process.cwd(),
    process.env.AVATARS_DIR || './uploads_avatars'
);

// Создаём папки при старте
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

// ============================================================
// Куда сохранять файл — зависит от purpose в query/body.
// purpose=avatar → uploads_avatars, иначе → uploads.
// ============================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const purpose = req.query?.purpose || req.body?.purpose;
        const dir = purpose === 'avatar' ? AVATARS_DIR : UPLOAD_DIR;
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).slice(0, 10);
        cb(null, `${uuidv4()}${ext}`);
    },
});

// ============================================================
// ФИКС КОДИРОВКИ ИМЕНИ ФАЙЛА
//
// Проблема: в зависимости от версии multer и настроек клиента
// originalname может приходить:
//   а) корректным UTF-8 — "Отчёт.pdf"
//   б) искажённым latin1 — "ÐžÑ‚Ñ‡Ñ‘Ñ‚.pdf"
//
// Нельзя слепо перекодировать — иначе корректное имя испортится.
// Проверяем характерные признаки и перекодируем только битые имена.
// ============================================================
const fixFilenameEncoding = (file) => {
    try {
        const original = file.originalname;
        if (!original || original.length === 0) return file;

        // Если уже есть кириллица и нет характерных признаков двойного
        // кодирования (Ð, Ñ, Ã, Â в паре с байтами 0x80-0xBF) — всё в порядке
        const hasCyrillic = /[а-яёА-ЯЁ]/.test(original);
        const looksLikeLatin1Artifact = /[ÐÑÃÂ][\x80-\xBF]/.test(original);

        if (hasCyrillic && !looksLikeLatin1Artifact) {
            // Имя уже корректное
            return file;
        }

        // Пробуем перекодировать latin1 → utf8
        const fixed = Buffer.from(original, 'latin1').toString('utf8');

        // Проверяем результат: не должно быть replacement-символов
        // и должна появиться кириллица (или имя изначально было ASCII)
        const fixedHasCyrillic = /[а-яёА-ЯЁ]/.test(fixed);
        const originalIsAscii = /^[\x00-\x7F]*$/.test(original);

        if (originalIsAscii) {
            // ASCII не нуждается в перекодировании
            return file;
        }

        if (!fixed.includes('\uFFFD') && fixedHasCyrillic) {
            file.originalname = fixed;
        }
    } catch (_) {
        // ignore
    }
    return file;
};

const buildUploadMiddleware = (maxSizeBytes) => {
    const upload = multer({
        storage,
        limits: { fileSize: maxSizeBytes },
        defParamCharset: 'utf8',
    });

    return (req, res, next) => {
        upload.array('files', 10)(req, res, (err) => {
            if (err) return next(err);
            if (req.files && req.files.length) {
                req.files.forEach(fixFilenameEncoding);
            }
            next();
        });
    };
};

module.exports = {
    UPLOAD_DIR,
    AVATARS_DIR,
    buildUploadMiddleware,
};