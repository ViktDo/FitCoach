import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import crypto from 'crypto';
import uid from 'uid-safe';

// ───────────────────── env ─────────────────────
const {
  PORT = 3000,
  NODE_ENV = 'production',

  // внешний Postgres — ты их уже прокидываешь через docker-compose:
  EXT_PG_HOST,
  EXT_PG_PORT,
  EXT_PG_DB,
  EXT_PG_USER,
  EXT_PG_PASSWORD,
  TELEGRAM_BOT_TOKEN, // опционально (для верификации initData)
  CORS_ORIGIN = '*',  // либо укажи точный https://app.bot-fitness.ru
} = process.env;

// ───────────────────── pg pool ─────────────────
const pool = new Pool({
  host: EXT_PG_HOST,
  port: Number(EXT_PG_PORT || 5432),
  database: EXT_PG_DB,
  user: EXT_PG_USER,
  password: EXT_PG_PASSWORD,
  ssl: false
});

// ───────────────────── utils ───────────────────
function nowPlusHours(h) {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

function cleanToken(t) {
  return String(t ?? '').trim().replace(/^=+|=+$/g, '').replace(/^"+|"+$/g, '');
}

function toBoolean(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (['true','yes','y'].includes(s)) return true;
  if (['false','no','n',''].includes(s)) return false;
  return true;
}

function normalizePhone(p) {
  const s = String(p ?? '').trim();
  if (!s) return null;
  const norm = s.replace(/(?!^\+)[^\d]/g, '').replace(/(?!^\+)[+]/g, '');
  return (!norm || norm === '+') ? null : norm;
}

// Telegram WebApp initData verification (optional but recommended)
function verifyTelegramInitData(initData, botToken) {
  try {
    if (!botToken) return true; // allow if not configured
    // https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.keys())
      .sort()
      .map((k) => `${k}=${urlParams.get(k)}`)
      .join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calc = crypto.createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
  } catch {
    return false;
  }
}

// ───────────────────── app ─────────────────────
const app = express();
const logger = pino({ level: NODE_ENV === 'production' ? 'info' : 'debug' });

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '1mb' }));

// мягкий лимит на мутирующие ручки
const mutateLimiter = rateLimit({
  windowMs: 60_000,
  max: 60, // 60 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/api/consent', '/api/profile', '/api/auth/role', '/api/auth/telegram'], mutateLimiter);

// ───────────────────── auth middleware ─────────
async function authRequired(req, res, next) {
  try {
    const token = cleanToken(
      req.body?.session_token ||
      req.query?.session_token ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    );
    if (!token) {
      return res.status(401).json({ code: 'INVALID_SESSION', message: 'Missing token' });
    }

    const { rows } = await pool.query(
      `select s.user_id, u.role, u.pdn_required
       from sessions s
       join users u on u.id = s.user_id
       where s.token = $1 and s.expires_at > now()`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(401).json({ code: 'INVALID_SESSION', message: 'Session expired or not found' });
    }
    req.user = { id: rows[0].user_id, role: rows[0].role, pdn_required: rows[0].pdn_required };
    req.sessionToken = token;
    next();
  } catch (e) {
    req.log.error(e, 'authRequired failed');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
}

// ───────────────────── routes ──────────────────

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Auth via Telegram WebApp
app.post('/api/auth/telegram', async (req, res) => {
  try {
    const { platform, platform_id, initData } = req.body || {};
    if (platform !== 'telegram') {
      return res.status(400).json({ code: 'BAD_PLATFORM' });
    }
    if (!platform_id || !initData) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'platform_id and initData are required' });
    }

    const ok = verifyTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!ok) {
      return res.status(401).json({ code: 'INVALID_SESSION', message: 'Bad initData' });
    }

    // upsert user
    const u = await pool.query(
      `insert into users (platform, platform_id)
       values ($1, $2)
       on conflict (platform, platform_id) do update set platform=excluded.platform
       returning id, role, pdn_required`,
      [platform, String(platform_id)]
    );
    const user = u.rows[0];

    // create session (2 weeks)
    const token = await uid(24); // ~32 base64 chars
    const exp = nowPlusHours(24 * 14);
    await pool.query(
      `insert into sessions (token, user_id, expires_at) values ($1, $2, $3)`,
      [token, user.id, exp]
    );

    res.json({
      session_token: token,
      role: user.role,
      pdn_required: user.pdn_required,
      pdn_version: 'v1.0'
    });
  } catch (e) {
    req.log.error(e, 'auth/telegram');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// Choose role
app.post('/api/auth/role', authRequired, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!['athlete','coach'].includes(role)) {
      return res.status(400).json({ code: 'BAD_ROLE' });
    }
    // запрет второй смены роли
    const { rows } = await pool.query(`select role, pdn_required from users where id=$1`, [req.user.id]);
    const current = rows[0]?.role || 'pending';
    if (current !== 'pending' && current !== role) {
      return res.status(409).json({ code: 'ROLE_LOCKED', pdn_required: rows[0].pdn_required });
    }

    const upd = await pool.query(
      `update users set role=$1 where id=$2 returning role, pdn_required`,
      [role, req.user.id]
    );
    res.json({ role: upd.rows[0].role, pdn_required: upd.rows[0].pdn_required });
  } catch (e) {
    req.log.error(e, 'auth/role');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// Get profile
app.get('/api/profile', authRequired, async (req, res) => {
  try {
    const u = await pool.query(`select role, pdn_required from users where id=$1`, [req.user.id]);
    const p = await pool.query(`select * from user_profiles where user_id=$1`, [req.user.id]);
    res.json({
      role: u.rows[0]?.role || 'pending',
      pdn_required: u.rows[0]?.pdn_required ?? true,
      profile: p.rows[0] || {}
    });
  } catch (e) {
    req.log.error(e, 'get profile');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// Save profile
app.post('/api/profile', authRequired, async (req, res) => {
  try {
    const {
      profile = {}
    } = req.body || {};

    const full_name = profile.full_name?.trim() || null;
    const phone = normalizePhone(profile.phone);

    const base = {
      full_name,
      phone,
      height_cm: profile.height_cm ?? null,
      weight_kg: profile.weight_kg ?? null,
      goal: profile.goal?.trim() || null,
      notes: profile.notes?.trim() || null,
      bio: profile.bio?.trim() || null,
      experience_years: profile.experience_years ?? null,
      instagram: profile.instagram?.trim() || null,
      telegram_channel: profile.telegram_channel?.trim() || null,
      telegram_link: profile.telegram_link?.trim() || null
    };

    await pool.query(
      `insert into user_profiles (user_id, full_name, phone, height_cm, weight_kg, goal, notes, bio, experience_years, instagram, telegram_channel, telegram_link, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
       on conflict (user_id) do update set
         full_name = excluded.full_name,
         phone = excluded.phone,
         height_cm = excluded.height_cm,
         weight_kg = excluded.weight_kg,
         goal = excluded.goal,
         notes = excluded.notes,
         bio = excluded.bio,
         experience_years = excluded.experience_years,
         instagram = excluded.instagram,
         telegram_channel = excluded.telegram_channel,
         telegram_link = excluded.telegram_link,
         updated_at = now()`,
      [
        req.user.id,
        base.full_name, base.phone,
        base.height_cm, base.weight_kg,
        base.goal, base.notes,
        base.bio, base.experience_years,
        base.instagram, base.telegram_channel, base.telegram_link
      ]
    );

    res.json({ ok: true });
  } catch (e) {
    req.log.error(e, 'post profile');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// Consent
app.post('/api/consent', authRequired, async (req, res) => {
  try {
    const { version = 'v1.0', accepted } = req.body || {};
    const acc = toBoolean(accepted);
    await pool.query(
      `insert into consents (user_id, version, accepted) values ($1,$2,$3)`,
      [req.user.id, String(version), acc]
    );
    // снимаем необходимость ПДн
    await pool.query(`update users set pdn_required=false where id=$1`, [req.user.id]);

    res.json({ ok: true, version: String(version), ts: new Date().toISOString() });
  } catch (e) {
    req.log.error(e, 'post consent');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// ───────────────────── start ───────────────────
app.listen(PORT, () => {
  logger.info({ PORT }, 'fitcoach-api up');
});