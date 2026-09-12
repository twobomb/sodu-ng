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
// multer/busboy парсит Content-Disposition как latin1.
// Перекодируем originalname: latin1 → UTF-8.
// ============================================================
const fixFilenameEncoding = (file) => {
    try {
        const original = file.originalname;
        const fixed = Buffer.from(original, 'latin1').toString('utf8');
        if (/[^\x00-\x7F]/.test(original) && !fixed.includes('\uFFFD')) {
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
        defParamCharset: 'utf8', // для новых версий multer
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