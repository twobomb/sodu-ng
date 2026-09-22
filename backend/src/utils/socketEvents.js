const emitForceRefresh = (io, domains = 'all') => {
    try {
        if (io && typeof io.emit === 'function') {
            // Если передан список доменов — клиенты инвалидируют только эти ветки
            // кеша и не перезапрашивают ВСЁ (основная оптимизация глобального
            // broadcast-обновления). Без доменов — грубая очистка всех кешей.
            if (domains && domains !== 'all') {
                const list =
                    Array.isArray(domains) ? domains : [domains];
                io.emit('force_refresh', { domains: list });
            } else {
                io.emit('force_refresh');
            }
        } else {
            console.warn('emitForceRefresh: io не инициализирован');
        }
    } catch (err) {
        console.error('Ошибка отправки force_refresh:', err.message);
    }
};

module.exports = { emitForceRefresh };