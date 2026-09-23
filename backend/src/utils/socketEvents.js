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

/**
 * Уведомляет пользователей о создании нового вызова (для звукового сигнала).
 * Событие получают только те, у кого есть доступ к вызову:
 *  - can_view_all / developer (комната 'depts:all') — видят все вызовы;
 *  - остальные — через комнаты своих подразделений 'dept:<id>',
 *    если вызов привязан к этим подразделениям.
 * Это ровно те пользователи, которые видят вызов в списке вызовов.
 */
const emitNewCall = (io, call) => {
    try {
        if (!io || typeof io.emit !== 'function') return;

        const payload = {
            id: call?.id,
            call_code: call?.call_code,
            type: call?.type,
            status: call?.status,
        };

        let target = io.to('depts:all');
        const deptIds = Array.isArray(call?.department_ids)
            ? call.department_ids
            : [];
        for (const deptId of deptIds) {
            target = target.to(`dept:${deptId}`);
        }
        target.emit('call:created', payload);
    } catch (err) {
        console.error('Ошибка отправки call:created:', err.message);
    }
};

module.exports = { emitForceRefresh, emitNewCall };