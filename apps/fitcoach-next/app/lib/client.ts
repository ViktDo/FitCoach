'use client';

/**
 * Базовый URL API (прокидывается из окружения на билде; на клиенте — как литерал).
 */
export const API_BASE: string = process.env.NEXT_PUBLIC_API_BASE || '';

/** Чистит токен от лишних кавычек/знаков '=' */
export function cleanToken(t: unknown): string {
  return String(t ?? '').trim().replace(/^=+|=+$/g, '').replace(/^"+|"+$/g, '');
}

/** Срезает ведущие '=' у строк из n8n и т.п. */
export function stripEq<T extends unknown>(v: T): T extends string ? string : T {
  // @ts-expect-error — на выходе тип строки сохраняем условно
  return typeof v === 'string' ? (v.replace(/^=+/, '') as any) : v;
}

/** Нормализация телефона к виду с ведущим '+' и цифрами; пустое → null */
export function normalizePhone(p: unknown): string | null {
  const s = String(p ?? '').trim();
  if (!s) return null;
  // оставляем только '+' в начале и цифры
  const norm = s.replace(/(?!^\+)[^\d]/g, '').replace(/(?!^\+)[+]/g, '');
  return !norm || norm === '+' ? null : norm;
}

/** Универсальный парсер «булева» от API (строки/числа/пусто) */
export function toBoolean(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', 'yes', 'y'].includes(s)) return true;
  if (['false', 'no', 'n', ''].includes(s)) return false;
  // безопасный дефолт (например, требовать согласие)
  return true;
}

/** {}, [{...}], [{json:{...}}] → {…} */
export function normalizePayload<T = any>(raw: any): T {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (
    first &&
    typeof first === 'object' &&
    'json' in first &&
    (first as any).json &&
    typeof (first as any).json === 'object'
  ) {
    return (first as any).json as T;
  }
  return ((first as unknown) || {}) as T;
}

/** Геттер токена с локального хранилища (клиент) */
export function getSessionToken(): string {
  return cleanToken(localStorage.getItem('session_token'));
}

/** Роль пользователя из localStorage */
export function getRole(): 'pending' | 'athlete' | 'coach' {
  return (localStorage.getItem('user_role') || 'pending').toLowerCase() as any;
}

/** Флаг согласия ПДн */
export function hasPdn(): boolean {
  return localStorage.getItem('pdn_ok') === '1';
}

/** Мягкий переход на /home (несколько попыток для надёжности) */
export function goHome(): void {
  try {
    window.location.assign('/home');
  } catch {}
  try {
    window.location.replace('/home');
  } catch {}
  setTimeout(() => {
    try {
      window.location.href = '/home';
    } catch {}
  }, 150);
}

/** Общий обработчик ошибок API: редиректы и сообщение */
function handleApiError(r: Response, data: any): never {
  const code = data?.code || '';
  if (r.status === 401 || code === 'INVALID_SESSION') {
    localStorage.clear();
    window.location.replace('/onboard/auth');
    // останавливаем дальнейшее выполнение промиса
    throw new Error('INVALID_SESSION');
  }
  if (r.status === 409 || code === 'ROLE_PENDING') {
    window.location.replace('/onboard/role');
    throw new Error('ROLE_PENDING');
  }
  throw new Error(data?.message || code || 'Ошибка запроса');
}

/** GET-запрос с нормализацией ответа и авто-редиректами по кодам */
export async function apiGet<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  const raw = await r.json().catch(() => ({}));
  const d = normalizePayload<T>(raw);
  if (!r.ok) handleApiError(r, d);
  return d;
}

/** POST-запрос с нормализацией ответа и авто-редиректами по кодам */
export async function apiPost<T = any>(url: string, payload: any): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await r.json().catch(() => ({}));
  const d = normalizePayload<T>(raw);
  if (!r.ok) handleApiError(r, d);
  return d;
}

/* ───────────────────── Соц-ссылки (для UX на профиле тренера) ───────────────────── */

export function ensureHttps(u: string): string {
  const s = (u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

export function toInstagramUrl(v: string): string {
  const s = (v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/^www\./i, '');
  return `https://instagram.com/${handle}`;
}

export function toTgUserUrl(v: string): string {
  const s = (v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@/, '').replace(/^t\.me\//i, '');
  return `https://t.me/${handle}`;
}

/** Для поля «TG-канал»: разрешаем как @handle/текст, так и полную ссылку */
export function toTgChannelVal(v: string): string {
  const s = (v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s; // полная ссылка допустима
  return s; // иначе оставляем как есть (@handle или текст)
}