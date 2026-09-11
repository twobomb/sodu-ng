const emitForceRefresh = (io) => {
    try {
        if (io && typeof io.emit === 'function') {
            io.emit('force_refresh');
        } else {
            console.warn('emitForceRefresh: io не инициализирован');
        }
    } catch (err) {
        console.error('Ошибка отправки force_refresh:', err.message);
    }
};

module.exports = { emitForceRefresh };