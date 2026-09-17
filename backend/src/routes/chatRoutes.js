const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissionGuard');
const {
    getConversations,
    getConversation,
    createChannel,
    updateChannel,
    deleteChannel,
    pinConversation,
    getMembers,
    addMember,
    removeMember,
    createDirect,
    searchConversations,
    markAsRead,
    markAllRead,
    getMyProfile,
    updateMyProfile,
    getChattableUsers,
    getMessageReaders,
    getInvitableUsers,
    transferAdmin,
    leaveConversation,
} = require('../controllers/chatController');

// Все требуют авторизации и права chat.use
router.use(authenticate);
router.use(requirePermission('chat.use'));

// Список и поиск
router.get('/conversations', getConversations);
router.get('/search', searchConversations);

// Личные чаты
router.post('/direct/:userId', createDirect);

// CRUD каналов
router.post('/conversations', createChannel);
router.post('/conversations/:id/transfer-admin', transferAdmin);
router.get('/conversations/:id', getConversation);
router.put('/conversations/:id', updateChannel);
router.delete('/conversations/:id', deleteChannel);
router.post('/conversations/:id/leave', leaveConversation);


// Закрепление и прочтение
router.post('/conversations/:id/pin', pinConversation);
router.post('/conversations/:id/read', markAsRead);
router.post('/read-all', markAllRead);

// Участники
router.get('/users', getChattableUsers);
router.get('/conversations/:id/members', getMembers);
router.post('/conversations/:id/members', addMember);
router.delete('/conversations/:id/members/:memberId', removeMember);
router.get('/conversations/:id/invitable', getInvitableUsers);

router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);
router.get('/messages/:messageId/readers', getMessageReaders);

module.exports = router;