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
        const ext = path.extname(file.originalname).slice(0, 10); // .jpg, .tar.gz и т.п.
        const name = `${uuidv4()}${ext}`;
        cb(null, name);
    },
});

// Возвращает middleware с динамическим лимитом
const buildUploadMiddleware = (maxSizeBytes) => {
    const upload = multer({
        storage,
        limits: { fileSize: maxSizeBytes },
    });
    return upload.array('files', 10); // до 10 файлов за раз
};

module.exports = {
    UPLOAD_DIR,
    buildUploadMiddleware,
};