const pool = require('../src/db/pool');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();

const SALT_ROUNDS = 10;

const createAdmin = async () => {
    const username = 'admin';
    const password = 'admin';  // смени при первом входе
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, role, can_view_all)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, role`,
            [username, hashed, 'admin', true]
        );

        if (result.rows.length) {
            console.log(`✅ Admin user created: ${username} (password: ${password})`);
        } else {
            console.log(`ℹ️ Admin user already exists`);
        }
    } catch (err) {
        console.error('Error creating admin:', err.message);
    } finally {
        pool.end();
    }
};

createAdmin();