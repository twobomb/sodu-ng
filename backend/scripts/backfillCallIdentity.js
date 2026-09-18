const pool = require('../src/db/pool');
const { generateCallId, colorFor } = require('../src/utils/callIdentity');

(async () => {
    const r = await pool.query(
        `SELECT id, number FROM calls WHERE call_code IS NULL OR call_code = ''`
    );
    for (const c of r.rows) {
        const n = Number(c.number);
        await pool.query(
            `UPDATE calls SET call_code = $1, color = $2 WHERE id = $3`,
            [generateCallId(n), colorFor(n), c.id]
        );
    }
    console.log('updated', r.rows.length);
    await pool.end();
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});