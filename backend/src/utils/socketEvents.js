/**
 * Отправляет событие force_refresh всем клиентам через Socket.IO
 * @param {object} io - экземпляр Socket.IO
 */
const emitForceRefresh = (io) => {
    if (io) {
        io.emit('force_refresh');
    }
};

module.exports = { emitForceRefresh };