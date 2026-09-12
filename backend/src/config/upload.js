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

// Создаём папку при старте
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        // Сохраняем как <uuid>.<ext>, оригинальное имя — только в БД
        const ext = path.extname(file.originalname).slice(0, 10);
        const name = `${uuidv4()}${ext}`;
        cb(null, name);
    },
});

// ============================================================
// ФИКС КОДИРОВКИ ИМЕНИ ФАЙЛА
// multer/busboy парсит Content-Disposition как latin1,
// из-за чего UTF-8 (кириллица) превращается в кракозябры.
// Перекодируем originalname: latin1 -> Buffer -> UTF-8.
// ============================================================
const fixFilenameEncoding = (file) => {
    try {
        const original = file.originalname;
        // Проверяем, есть ли признаки неправильной кодировки:
        // если Buffer.from(str, 'latin1').toString('utf8') даёт валидный
        // результат — значит исходное имя было испорчено.
        const fixed = Buffer.from(original, 'latin1').toString('utf8');

        // Простая эвристика: если в исходной строке есть символы
        // с кодами > 127 (то есть не ASCII), и после перекодирования
        // получается более "читаемая" строка — используем её.
        if (/[^\x00-\x7F]/.test(original)) {
            // Проверяем, что результат не содержит "замещающих" символов
            if (!fixed.includes('\uFFFD')) {
                file.originalname = fixed;
            }
        }
    } catch (err) {
        // Если что-то пошло не так — оставляем как есть
    }
    return file;
};

// Возвращает middleware с динамическим лимитом
const buildUploadMiddleware = (maxSizeBytes) => {
    const upload = multer({
        storage,
        limits: { fileSize: maxSizeBytes },
    });

    // Оборачиваем, чтобы после загрузки пройтись по файлам и починить кодировку
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
    buildUploadMiddleware,
};