import apiClient from './client';
export const getMyChatProfile = () => apiClient.get('/chat/profile');
export const updateMyChatProfile = (data) => apiClient.put('/chat/profile', data);
// Загрузка аватара — использует общий upload-эндпоинт чата
export const uploadChatAvatar = (conversationId, file) => {
    const formData = new FormData();
    formData.append('files', file);
    return apiClient.post(
        `/chat/conversations/${conversationId}/upload?purpose=avatar`,
        formData
    );
};
export const transferAdmin = (conversationId, userId) =>
    apiClient.post(`/chat/conversations/${conversationId}/transfer-admin`, {
        userId,
    });
export const leaveConversation = (id) =>
    apiClient.post(`/chat/conversations/${id}/leave`);
export const getInvitableUsers = (id, q = '') =>
    apiClient.get(`/chat/conversations/${id}/invitable`, { params: { q } });
// ----- Разговоры -----
export const getConversations = (filter = 'all') =>
    apiClient.get('/chat/conversations', { params: { filter } });
export const getChattableUsers = (q = '') =>
    apiClient.get('/chat/users', { params: { q } });
export const getConversation = (id) =>
    apiClient.get(`/chat/conversations/${id}`);

export const createChannel = (data) =>
    apiClient.post('/chat/conversations', data);

export const updateChannel = (id, data) =>
    apiClient.put(`/chat/conversations/${id}`, data);

export const deleteChannel = (id) =>
    apiClient.delete(`/chat/conversations/${id}`);

export const pinConversation = (id, pinned) =>
    apiClient.post(`/chat/conversations/${id}/pin`, { pinned });

export const markAsRead = (id, messageId = null) =>
    apiClient.post(`/chat/conversations/${id}/read`, { messageId });

export const searchConversations = (q) =>
    apiClient.get('/chat/search', { params: { q } });

export const createDirect = (userId) =>
    apiClient.post(`/chat/direct/${userId}`);

// ----- Участники -----
export const getMembers = (id) =>
    apiClient.get(`/chat/conversations/${id}/members`);

export const addMember = (id, userId, role = 'member') =>
    apiClient.post(`/chat/conversations/${id}/members`, { userId, role });

export const removeMember = (id, memberId) =>
    apiClient.delete(`/chat/conversations/${id}/members/${memberId}`);

// ----- Сообщения -----
export const getMessages = (id, { before, before_id, limit = 30 } = {}) => {
    const params = { limit };
    if (before) params.before = before;
    if (before_id) params.before_id = before_id;
    return apiClient.get(`/chat/conversations/${id}/messages`, { params });
};

export const sendMessage = (id, data) =>
    apiClient.post(`/chat/conversations/${id}/messages`, data);

export const editMessage = (messageId, content) =>
    apiClient.put(`/chat/messages/${messageId}`, { content });

export const deleteMessage = (messageId) =>
    apiClient.delete(`/chat/messages/${messageId}`);

export const getMessageReaders = (messageId) =>
    apiClient.get(`/chat/messages/${messageId}/readers`);

// ----- Файлы -----
export const uploadFiles = (conversationId, files) => {
    const formData = new FormData();
    for (const f of files) {
        formData.append('files', f);
    }
    return apiClient.post(
        `/chat/conversations/${conversationId}/upload`,
        formData
        // Без headers — axios сам выставит multipart/form-data с boundary
    );
};

export const getDownloadUrl = (attachmentId) =>
    `${apiClient.defaults.baseURL}/chat/attachments/${attachmentId}/download`;

export const getPreviewUrl = (attachmentId) =>
    `${apiClient.defaults.baseURL}/chat/attachments/${attachmentId}/preview`;