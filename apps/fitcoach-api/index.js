import express from 'express';
import fetch from 'node-fetch';
import pg from 'pg';

const app = express();
app.use(express.json());

// health
app.get('/health', (_, res) => res.send('ok'));

// (пример) версия БД — проверим подключение по твоим EXT_PG_* из .env
const pool = new pg.Pool({
    host: process.env.EXT_PG_HOST,
    port: Number(process.env.EXT_PG_PORT || 5432),
    database: process.env.EXT_PG_DB,
    user: process.env.EXT_PG_USER,
    password: process.env.EXT_PG_PASSWORD,
    ssl: false
});
app.get('/v1/db-version', async (_, res) => {
    try {
        const r = await pool.query('SELECT version()');
        res.json({ ok: true, version: r.rows?.[0]?.version });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

// (пример) прокси к n8n (пока без токена)
app.get('/v1/today', async (req, res) => {
    try {
        const r = await fetch(process.env.N8N_BASE_URL + '/webhook/today');
        const data = await r.json().catch(() => ({}));
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

app.listen(3000, () => console.log('API up on :3000'));