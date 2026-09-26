const srv = require('./src/services/callJournalExportService');
const fs = require('fs');
(async () => {
    try {
        const r = await srv.exportJournal({ date_from: '2026-09-17', date_to: '2026-09-23' });
        fs.writeFileSync('./_out.xlsx', r.buffer);
        console.log('ok', r.buffer.length);
    } catch (e) { console.error(e.message); process.exit(1); }
})();