const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getMessages,
    createMessage,
    editMessage,
    deleteMessage,
    getMessageReaders,
} = require('../controllers/messageController');
const {
    uploadMiddleware,
    uploadFiles,
    downloadAttachment,
    previewAttachment,
} = require('../controllers/attachmentController');

router.use(authenticate);
router.use(requirePermission('chat.use'));

// ----- Сообщения -----
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', createMessage);
router.put('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);
router.get('/messages/:messageId/readers', getMessageReaders);

// ----- Файлы -----
router.post('/conversations/:id/upload', uploadMiddleware, uploadFiles);
router.get('/attachments/:id/download', downloadAttachment);
router.get('/attachments/:id/preview', previewAttachment);

module.exports = router;