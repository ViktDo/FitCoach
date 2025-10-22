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

/* ===================== ENV ===================== */
const {
  PORT = 3000,
  NODE_ENV = 'production',

  EXT_PG_HOST,
  EXT_PG_PORT,
  EXT_PG_DB,
  EXT_PG_USER,
  EXT_PG_PASSWORD,

  TELEGRAM_BOT_TOKEN,
  CORS_ORIGIN = '*',

  DB_SCHEMA = 'public',

  // явные имена таблиц (опционально)
  TBL_USERS,
  TBL_SESSIONS,
  TBL_PROFILES,
  TBL_CONSENTS,

  // явные имена колонок (опционально)
  COL_USERS_ID,
  COL_USERS_PLATFORM,
  COL_USERS_PLATFORM_ID,
  COL_USERS_ROLE,
  COL_USERS_PDN_REQUIRED,

  COL_SESSIONS_TOKEN,
  COL_SESSIONS_USER_ID,
  COL_SESSIONS_EXPIRES_AT,

  COL_PROFILES_USER_ID,
  COL_PROFILES_FULL_NAME,
  COL_PROFILES_PHONE,
  COL_PROFILES_HEIGHT_CM,
  COL_PROFILES_WEIGHT_KG,
  COL_PROFILES_GOAL,
  COL_PROFILES_NOTES,
  COL_PROFILES_BIO,
  COL_PROFILES_EXPERIENCE_YEARS,
  COL_PROFILES_INSTAGRAM,
  COL_PROFILES_TG_CHANNEL,
  COL_PROFILES_TG_LINK,

  COL_CONSENTS_USER_ID,
  COL_CONSENTS_VERSION,
  COL_CONSENTS_ACCEPTED,
} = process.env;

/* ===================== PG ===================== */
const pool = new Pool({
  host: EXT_PG_HOST,
  port: Number(EXT_PG_PORT || 5432),
  database: EXT_PG_DB,
  user: EXT_PG_USER,
  password: EXT_PG_PASSWORD,
  ssl: false,
});

/* ===================== UTILS ===================== */
const logger = pino({ level: NODE_ENV === 'production' ? 'info' : 'debug' });
const app = express();

function nowPlusHours(h) { const d = new Date(); d.setHours(d.getHours() + h); return d; }
function cleanToken(t) { return String(t ?? '').trim().replace(/^=+|=+$/g, '').replace(/^"+|"+$/g, ''); }
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
  return !norm || norm === '+' ? null : norm;
}
// Telegram initData verification (optional)
function verifyTelegramInitData(initData, botToken) {
  try {
    if (!botToken) return true;
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.keys())
      .sort()
      .map((k) => `${k}=${urlParams.get(k)}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken).digest();
    const calc = crypto.createHmac('sha256', secret)
      .update(dataCheckString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
  } catch { return false; }
}

// безопасное «кавычение» идентификаторов (наши из information_schema)
const qid = (id) => `"${String(id).replace(/"/g, '""')}"`;

/* ===================== SCHEMA DETECTOR ===================== */
async function detectSchema(client) {
  // Если всё явно задано в ENV — сразу возвращаем
  const envTable = (k, fallback) => (process.env[k] && process.env[k].trim()) || fallback;
  const envCol   = (k, fallback) => (process.env[k] && process.env[k].trim()) || fallback;

  // Подтягиваем перечень таблиц/колонок
  const tables = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = $1
        and table_type = 'BASE TABLE'`,
    [DB_SCHEMA]
  );

  const lowerTables = tables.rows.map(r => r.table_name.toLowerCase());

  // Хелпер: найти таблицу по синонимам
  function pickTable(candidates) {
    if (!candidates?.length) return null;
    const name = candidates.find(n => lowerTables.includes(n));
    return name || null;
  }

  // Хелпер: получить список колонок для таблицы
  async function getColumns(table) {
    const { rows } = await client.query(
      `select column_name::text
         from information_schema.columns
        where table_schema=$1 and table_name=$2`,
      [DB_SCHEMA, table]
    );
    return rows.map(r => r.column_name.toLowerCase());
  }

  // Хелпер: выбрать колонку по списку синонимов
  function pickCol(cols, synonyms, fallback=null) {
    for (const s of synonyms) if (cols.includes(s)) return s;
    return fallback;
  }

  // 1) USERS
  let usersTable = envTable('TBL_USERS', pickTable([
    'users','app_users','fc_users','account','accounts','user'
  ]));
  if (!usersTable) throw new Error('Не найдена таблица пользователей (users / app_users / …). Переопредели TBL_USERS.');
  let usersCols = await getColumns(usersTable);

  const colUsersId       = envCol('COL_USERS_ID',           pickCol(usersCols, ['id','user_id','uid','pk']));
  const colUsersRole     = envCol('COL_USERS_ROLE',         pickCol(usersCols, ['role','user_role','type']));
  // pdn / consent required flag
  const colUsersPdnReq   = envCol('COL_USERS_PDN_REQUIRED', pickCol(usersCols, ['pdn_required','consent_required','need_consent','pdn']));
  // платформа / айди
  let colUsersPlatform   = envCol('COL_USERS_PLATFORM',     pickCol(usersCols, ['platform','provider']));
  let colUsersPlatformId = envCol('COL_USERS_PLATFORM_ID',  pickCol(usersCols, ['platform_id','provider_id','external_id']));
  // отдельные полня под телеграм, если нет platform*
  const colUsersTelegramId = pickCol(usersCols, ['telegram_id','tg_id','telegram_user_id','chat_id'], null);

  if (!colUsersId)   throw new Error('Не найдена колонка id в users. COL_USERS_ID?');
  if (!colUsersRole) logger.warn('В users не найдена колонка role — будет проставляться "pending" по умолчанию.');
  if (!colUsersPdnReq) logger.warn('В users не найдена колонка pdn_required — считаем, что требуется (true) пока не будет consent.');

  // 2) SESSIONS
  let sessionsTable = envTable('TBL_SESSIONS', pickTable(['sessions','user_sessions','auth_sessions']));
  if (!sessionsTable) throw new Error('Не найдена таблица сессий (sessions / user_sessions / …). Переопредели TBL_SESSIONS.');
  let sessionsCols = await getColumns(sessionsTable);
  const colSessToken   = envCol('COL_SESSIONS_TOKEN',     pickCol(sessionsCols, ['token','session_token','sid']));
  const colSessUserId  = envCol('COL_SESSIONS_USER_ID',   pickCol(sessionsCols, ['user_id','uid']));
  const colSessExpires = envCol('COL_SESSIONS_EXPIRES_AT',pickCol(sessionsCols, ['expires_at','expires','exp','valid_till']));
  if (!colSessToken || !colSessUserId || !colSessExpires) {
    throw new Error('В таблице сессий не найдены нужные колонки token/user_id/expires_at. Переопредели COL_SESSIONS_*.');
  }

  // 3) PROFILES (опционально, но крайне желательно)
  let profilesTable = envTable('TBL_PROFILES', pickTable(['user_profiles','profiles','users_profiles','profile']));
  let profileCols = [];
  if (profilesTable) profileCols = await getColumns(profilesTable);
  const colProfUserId  = envCol('COL_PROFILES_USER_ID', pickCol(profileCols, ['user_id','uid']));
  const colProfFull    = envCol('COL_PROFILES_FULL_NAME', pickCol(profileCols, ['full_name','fio','name']));
  const colProfPhone   = envCol('COL_PROFILES_PHONE',    pickCol(profileCols, ['phone','phone_number','tel']));
  const colProfHeight  = envCol('COL_PROFILES_HEIGHT_CM',pickCol(profileCols, ['height_cm','height']));
  const colProfWeight  = envCol('COL_PROFILES_WEIGHT_KG',pickCol(profileCols, ['weight_kg','weight']));
  const colProfGoal    = envCol('COL_PROFILES_GOAL',     pickCol(profileCols, ['goal','target']));
  const colProfNotes   = envCol('COL_PROFILES_NOTES',    pickCol(profileCols, ['notes','comment','comments']));
  const colProfBio     = envCol('COL_PROFILES_BIO',      pickCol(profileCols, ['bio','about']));
  const colProfExp     = envCol('COL_PROFILES_EXPERIENCE_YEARS', pickCol(profileCols, ['experience_years','exp_years','years']));
  const colProfInst    = envCol('COL_PROFILES_INSTAGRAM',pickCol(profileCols, ['instagram','insta']));
  const colProfTgCh    = envCol('COL_PROFILES_TG_CHANNEL',pickCol(profileCols, ['telegram_channel','tg_channel']));
  const colProfTgLink  = envCol('COL_PROFILES_TG_LINK',  pickCol(profileCols, ['telegram_link','tg_link','telegram']));

  if (!profilesTable) {
    logger.warn('Таблица профилей не найдена — /api/profile будет возвращать/принимать минимум full_name/phone через users (если найдём).');
  }

  // 4) CONSENTS (опционально)
  let consentsTable = envTable('TBL_CONSENTS', pickTable(['consents','user_consents','pnd_consents','pdn_consents']));
  let consentCols = [];
  if (consentsTable) consentCols = await getColumns(consentsTable);
  const colConsUserId = envCol('COL_CONSENTS_USER_ID',  pickCol(consentCols, ['user_id','uid']));
  const colConsVer    = envCol('COL_CONSENTS_VERSION',  pickCol(consentCols, ['version','ver']));
  const colConsAcc    = envCol('COL_CONSENTS_ACCEPTED', pickCol(consentCols, ['accepted','agree','consent','is_accepted']));

  const mapping = {
    schema: DB_SCHEMA,
    users: {
      table: usersTable,
      id: colUsersId,
      role: colUsersRole || null,
      pdn_required: colUsersPdnReq || null,
      platform: colUsersPlatform || null,
      platform_id: colUsersPlatformId || null,
      telegram_id: colUsersTelegramId || null, // если есть
    },
    sessions: {
      table: sessionsTable,
      token: colSessToken,
      user_id: colSessUserId,
      expires_at: colSessExpires,
    },
    profiles: profilesTable ? {
      table: profilesTable,
      user_id: colProfUserId,
      full_name: colProfFull || null,
      phone: colProfPhone || null,
      height_cm: colProfHeight || null,
      weight_kg: colProfWeight || null,
      goal: colProfGoal || null,
      notes: colProfNotes || null,
      bio: colProfBio || null,
      experience_years: colProfExp || null,
      instagram: colProfInst || null,
      telegram_channel: colProfTgCh || null,
      telegram_link: colProfTgLink || null,
    } : null,
    consents: consentsTable ? {
      table: consentsTable,
      user_id: colConsUserId || null,
      version: colConsVer || null,
      accepted: colConsAcc || null,
    } : null,
  };

  return mapping;
}

/* ===================== APP MIDDLEWARE ===================== */
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '1mb' }));

const mutateLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use(['/api/consent','/api/profile','/api/auth/role','/api/auth/telegram'], mutateLimiter);

/* ===================== STARTUP (detect schema) ===================== */
let MAP = null;
async function ready() {
  if (MAP) return MAP;
  const client = await pool.connect();
  try {
    MAP = await detectSchema(client);
    client.release();
    app.set('mapping', MAP);
    logger.info({ mapping: MAP }, 'DB mapping resolved');
    return MAP;
  } catch (e) {
    client.release();
    logger.error(e, 'Schema detection failed');
    throw e;
  }
}

/* ===================== AUTH MIDDLEWARE ===================== */
async function authRequired(req, res, next) {
  try {
    await ready();
    const m = app.get('mapping');

    const token = cleanToken(
      req.body?.session_token ||
      req.query?.session_token ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    );
    if (!token) return res.status(401).json({ code: 'INVALID_SESSION', message: 'Missing token' });

    // select user_id by session token
    const q = `
      select s.${qid(m.sessions.user_id)} as uid
        from ${qid(m.schema)}.${qid(m.sessions.table)} s
       where s.${qid(m.sessions.token)} = $1
         and s.${qid(m.sessions.expires_at)} > now()
      limit 1
    `;
    const { rows } = await pool.query(q, [token]);
    if (rows.length === 0) {
      return res.status(401).json({ code: 'INVALID_SESSION', message: 'Session expired or not found' });
    }
    const userId = rows[0].uid;

    // fetch role & pdn_required (если есть такие поля)
    let role = 'pending';
    let pdn_required = true;
    if (m.users.role || m.users.pdn_required) {
      const qu = `
        select ${m.users.role ? qid(m.users.role) : `'pending' as role`},
               ${m.users.pdn_required ? qid(m.users.pdn_required) : `true as pdn_required`}
          from ${qid(m.schema)}.${qid(m.users.table)}
         where ${qid(m.users.id)} = $1
         limit 1
      `;
      const u = await pool.query(qu, [userId]);
      if (u.rows[0]) {
        if (m.users.role) role = String(u.rows[0][m.users.role]).toLowerCase();
        if (m.users.pdn_required != null) pdn_required = toBoolean(u.rows[0][m.users.pdn_required]);
      }
    }

    req.user = { id: userId, role, pdn_required };
    req.sessionToken = token;
    next();
  } catch (e) {
    req.log.error(e, 'authRequired failed');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
}

/* ===================== ROUTES ===================== */

// health
app.get('/api/health', async (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// debug: увидеть, как сопоставилась схема
app.get('/api/debug/schema', async (req, res) => {
  try {
    await ready();
    res.json(app.get('mapping'));
  } catch (e) {
    res.status(500).json({ error: 'schema detection failed', details: String(e?.message || e) });
  }
});

// auth via Telegram WebApp
app.post('/api/auth/telegram', async (req, res) => {
  const client = await pool.connect();
  try {
    await ready();
    const m = app.get('mapping');

    const { platform, platform_id, initData } = req.body || {};
    if (platform !== 'telegram') return res.status(400).json({ code: 'BAD_PLATFORM' });
    if (!platform_id || !initData) return res.status(400).json({ code: 'BAD_REQUEST', message: 'platform_id and initData are required' });

    const ok = verifyTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!ok) return res.status(401).json({ code: 'INVALID_SESSION', message: 'Bad initData' });

    await client.query('BEGIN');

    // Найти пользователя:
    let userId = null;
    if (m.users.platform && m.users.platform_id) {
      const sel = `
        select ${qid(m.users.id)} as id
          from ${qid(m.schema)}.${qid(m.users.table)}
         where ${qid(m.users.platform)} = $1
           and ${qid(m.users.platform_id)} = $2
         limit 1
      `;
      const r = await client.query(sel, ['telegram', String(platform_id)]);
      if (r.rows[0]) userId = r.rows[0].id;
      else {
        // вставка
        const insCols = [m.users.platform, m.users.platform_id];
        const insVals = ['$1', '$2'];
        if (m.users.role) { insCols.push(m.users.role); insVals.push(`'pending'`); }
        if (m.users.pdn_required) { insCols.push(m.users.pdn_required); insVals.push(`true`); }

        const ins = `
          insert into ${qid(m.schema)}.${qid(m.users.table)} (${insCols.map(qid).join(',')})
          values (${insVals.join(',')})
          returning ${qid(m.users.id)} as id
        `;
        const ir = await client.query(ins, ['telegram', String(platform_id)]);
        userId = ir.rows[0].id;
      }
    } else if (m.users.telegram_id) {
      // схема, где у users есть telegram_id
      const sel = `
        select ${qid(m.users.id)} as id
          from ${qid(m.schema)}.${qid(m.users.table)}
         where ${qid(m.users.telegram_id)} = $1
         limit 1
      `;
      const r = await client.query(sel, [String(platform_id)]);
      if (r.rows[0]) userId = r.rows[0].id;
      else {
        const cols = [m.users.telegram_id];
        const vals = ['$1'];
        if (m.users.role) { cols.push(m.users.role); vals.push(`'pending'`); }
        if (m.users.pdn_required) { cols.push(m.users.pdn_required); vals.push(`true`); }

        const ins = `
          insert into ${qid(m.schema)}.${qid(m.users.table)} (${cols.map(qid).join(',')})
          values (${vals.join(',')})
          returning ${qid(m.users.id)} as id
        `;
        const ir = await client.query(ins, [String(platform_id)]);
        userId = ir.rows[0].id;
      }
    } else {
      throw new Error('В users нет ни (platform, platform_id), ни telegram_id — укажи переменные окружения для явного маппинга.');
    }

    // создать сессию
    const token = await uid(24);
    const exp = nowPlusHours(24 * 14);
    const insSess = `
      insert into ${qid(m.schema)}.${qid(m.sessions.table)}
                  (${qid(m.sessions.token)}, ${qid(m.sessions.user_id)}, ${qid(m.sessions.expires_at)})
      values ($1,$2,$3)
    `;
    await client.query(insSess, [token, userId, exp]);

    // получить role/pdn_required, если поля существуют
    let role = 'pending';
    let pdn_required = true;

    if (m.users.role || m.users.pdn_required) {
      const u = await client.query(
        `select ${m.users.role ? qid(m.users.role) : `'pending' as role`},
                ${m.users.pdn_required ? qid(m.users.pdn_required) : `true as pdn_required`}
           from ${qid(m.schema)}.${qid(m.users.table)}
          where ${qid(m.users.id)} = $1
          limit 1`, [userId]
      );
      if (u.rows[0]) {
        role = (m.users.role ? String(u.rows[0][m.users.role]).toLowerCase() : 'pending');
        pdn_required = (m.users.pdn_required != null ? toBoolean(u.rows[0][m.users.pdn_required]) : true);
      }
    }

    await client.query('COMMIT');
    res.json({ session_token: token, role, pdn_required, pdn_version: 'v1.0' });
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    logger.error(e, 'auth/telegram failed');
    res.status(500).json({ code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// choose role
app.post('/api/auth/role', authRequired, async (req, res) => {
  try {
    await ready();
    const m = app.get('mapping');
    const { role } = req.body || {};
    if (!['athlete','coach'].includes(String(role))) {
      return res.status(400).json({ code: 'BAD_ROLE' });
    }
    if (!m.users.role) { // если у users нет поля role — просто «принимаем», но не сохраняем
      return res.json({ role: String(role), pdn_required: req.user.pdn_required });
    }

    // запрет смены ранее выбранной роли
    const cur = await pool.query(
      `select ${qid(m.users.role)} as role, ${m.users.pdn_required ? qid(m.users.pdn_required) : 'true as pdn_required'}
         from ${qid(m.schema)}.${qid(m.users.table)}
        where ${qid(m.users.id)} = $1
        limit 1`, [req.user.id]
    );
    const currentRole = (cur.rows[0]?.role && String(cur.rows[0].role).toLowerCase()) || 'pending';
    const pdn_required = m.users.pdn_required != null ? toBoolean(cur.rows[0]?.[m.users.pdn_required]) : true;

    if (currentRole !== 'pending' && currentRole !== role) {
      return res.status(409).json({ code: 'ROLE_LOCKED', pdn_required });
    }

    await pool.query(
      `update ${qid(m.schema)}.${qid(m.users.table)}
          set ${qid(m.users.role)} = $1
        where ${qid(m.users.id)} = $2`, [String(role), req.user.id]
    );

    res.json({ role: String(role), pdn_required });
  } catch (e) {
    logger.error(e, 'auth/role');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// get profile
app.get('/api/profile', authRequired, async (req, res) => {
  try {
    await ready();
    const m = app.get('mapping');

    // роль/пдн
    let role = 'pending';
    let pdn_required = true;
    if (m.users.role || m.users.pdn_required) {
      const u = await pool.query(
        `select ${m.users.role ? qid(m.users.role) : `'pending' as role`},
                ${m.users.pdn_required ? qid(m.users.pdn_required) : `true as pdn_required`}
           from ${qid(m.schema)}.${qid(m.users.table)}
          where ${qid(m.users.id)} = $1
          limit 1`, [req.user.id]
      );
      if (u.rows[0]) {
        if (m.users.role) role = String(u.rows[0][m.users.role]).toLowerCase();
        if (m.users.pdn_required != null) pdn_required = toBoolean(u.rows[0][m.users.pdn_required]);
      }
    }

    // профиль (если таблица есть)
    let profile = {};
    if (m.profiles) {
      const pr = await pool.query(
        `select *
           from ${qid(m.schema)}.${qid(m.profiles.table)}
          where ${qid(m.profiles.user_id)} = $1
          limit 1`, [req.user.id]
      );
      profile = pr.rows[0] || {};
    }
    res.json({ role, pdn_required, profile });
  } catch (e) {
    logger.error(e, 'get profile');
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});

// save profile
app.post('/api/profile', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await ready();
    const m = app.get('mapping');

    const { profile = {} } = req.body || {};

    // Если нет таблицы профилей — пытаемся обновить минимум в users (full_name/phone), если есть такие поля
    if (!m.profiles) {
      const updates = [];
      const params = [];
      let idx = 1;

      // Поищем такие поля прямо в users
      const ucolsRes = await client.query(
        `select column_name::text
           from information_schema.columns
          where table_schema=$1 and table_name=$2`,
        [m.schema, m.users.table]
      );
      const ucols = ucolsRes.rows.map(r => r.column_name.toLowerCase());

      const candidates = [
        ['full_name', profile.full_name?.trim() || null],
        ['phone', normalizePhone(profile.phone)],
      ];
      for (const [k, v] of candidates) {
        if (ucols.includes(k) && v !== undefined) {
          updates.push(`${qid(k)} = $${idx++}`);
          params.push(v);
        }
      }

      if (updates.length) {
        params.push(req.user.id);
        const q = `
          update ${qid(m.schema)}.${qid(m.users.table)}
             set ${updates.join(', ')}
           where ${qid(m.users.id)} = $${idx}
        `;
        await client.query(q, params);
      }
      return res.json({ ok: true, note: 'profiles table is absent; updated users minimally' });
    }

    // есть таблица профилей — классический upsert
    const norm = {
      full_name: profile.full_name?.trim() || null,
      phone: normalizePhone(profile.phone),
      height_cm: profile.height_cm ?? null,
      weight_kg: profile.weight_kg ?? null,
      goal: profile.goal?.trim() || null,
      notes: profile.notes?.trim() || null,
      bio: profile.bio?.trim() || null,
      experience_years: profile.experience_years ?? null,
      instagram: profile.instagram?.trim() || null,
      telegram_channel: profile.telegram_channel?.trim() || null,
      telegram_link: profile.telegram_link?.trim() || null,
    };

    // Собираем список реально существующих колонок в profiles
    const prColsRes = await client.query(
      `select column_name::text
         from information_schema.columns
        where table_schema=$1 and table_name=$2`,
      [m.schema, m.profiles.table]
    );
    const prCols = new Set(prColsRes.rows.map(r => r.column_name.toLowerCase()));

    const cols = [m.profiles.user_id];
    const vals = ['$1'];
    const upds = [];

    const mappingPairs = [
      ['full_name', 'full_name'],
      ['phone', 'phone'],
      ['height_cm', 'height_cm'],
      ['weight_kg', 'weight_kg'],
      ['goal', 'goal'],
      ['notes', 'notes'],
      ['bio', 'bio'],
      ['experience_years', 'experience_years'],
      ['instagram', 'instagram'],
      ['telegram_channel', 'telegram_channel'],
      ['telegram_link', 'telegram_link'],
    ];

    let pIndex = 2;
    const params = [req.user.id];

    for (const [key, logicalKey] of mappingPairs) {
      const col = m.profiles[key];
      if (!col) continue;                // не смэплена
      if (!prCols.has(col)) continue;    // колонки реально нет
      cols.push(col);
      vals.push(`$${pIndex++}`);
      params.push(norm[logicalKey]);
      upds.push(`${qid(col)} = EXCLUDED.${qid(col)}`);
    }

    if (cols.length === 1) {
      // нет ни одной из колонок профиля — ничего не делаем
      return res.json({ ok: true, note: 'no profile columns matched' });
    }

    const sql = `
      insert into ${qid(m.schema)}.${qid(m.profiles.table)}
        (${cols.map(qid).join(', ')})
      values (${vals.join(', ')})
      on conflict (${qid(m.profiles.user_id)}) do update
        set ${upds.join(', ')}
    `;
    await client.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e, 'post profile');
    res.status(500).json({ code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// consent
app.post('/api/consent', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await ready();
    const m = app.get('mapping');

    const { version = 'v1.0', accepted } = req.body || {};
    const acc = toBoolean(accepted);

    // если таблицы consents нет — просто снимем флаг на users (если есть)
    if (!m.consents) {
      if (m.users.pdn_required) {
        await client.query(
          `update ${qid(m.schema)}.${qid(m.users.table)}
              set ${qid(m.users.pdn_required)} = false
            where ${qid(m.users.id)} = $1`,
          [req.user.id]
        );
      }
      return res.json({ ok: true, version: String(version), ts: new Date().toISOString() });
    }

    // consents есть → пишем запись
    const consColsRes = await client.query(
      `select column_name::text
         from information_schema.columns
        where table_schema=$1 and table_name=$2`,
      [m.schema, m.consents.table]
    );
    const cset = new Set(consColsRes.rows.map(r => r.column_name.toLowerCase()));

    const cols = [];
    const vals = [];
    const params = [];
    let idx = 1;

    if (m.consents.user_id && cset.has(m.consents.user_id)) { cols.push(m.consents.user_id); vals.push(`$${idx++}`); params.push(req.user.id); }
    if (m.consents.version && cset.has(m.consents.version)) { cols.push(m.consents.version); vals.push(`$${idx++}`); params.push(String(version)); }
    if (m.consents.accepted && cset.has(m.consents.accepted)) { cols.push(m.consents.accepted); vals.push(`$${idx++}`); params.push(acc); }

    if (cols.length) {
      const ins = `
        insert into ${qid(m.schema)}.${qid(m.consents.table)}
          (${cols.map(qid).join(', ')})
        values (${vals.join(', ')})
      `;
      await client.query(ins, params);
    }

    // снимаем флаг pdn_required, если он есть
    if (m.users.pdn_required) {
      await client.query(
        `update ${qid(m.schema)}.${qid(m.users.table)}
            set ${qid(m.users.pdn_required)} = false
          where ${qid(m.users.id)} = $1`,
        [req.user.id]
      );
    }

    res.json({ ok: true, version: String(version), ts: new Date().toISOString() });
  } catch (e) {
    logger.error(e, 'post consent');
    res.status(500).json({ code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

/* ===================== START ===================== */
(async () => {
  await ready(); // чтобы упасть сразу, если схема не распознана
  app.listen(PORT, () => logger.info({ PORT }, 'fitcoach-api up (adaptive schema)'));
})();