'use client';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function cleanToken(t: unknown) {
  return String(t ?? '').trim().replace(/^=+|=+$/g, '').replace(/^"+|"+$/g, '');
}

export function stripEq(v: unknown) {
  return typeof v === 'string' ? v.replace(/^=+/, '') : v;
}

export function normalizePhone(p: unknown): string | null {
  const s = String(p ?? '').trim();
  if (!s) return null;
  const norm = s.replace(/(?!^\+)[^\d]/g, '').replace(/(?!^\+)[+]/g, '');
  return (!norm || norm === '+') ? null : norm;
}

export function toBoolean(v: unknown) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (['true','yes','y'].includes(s)) return true;
  if (['false','no','n',''].includes(s)) return false;
  return true; // дефолт — требовать согласие
}

// {}, [{...}], [{json:{...}}] → {…}
export function normalizePayload<T=any>(raw: any): T {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first && typeof first === 'object' && 'json' in first && first.json && typeof first.json === 'object') {
    return first.json as T;
  }
  return (first || {}) as T;
}

export async function apiGet<T=any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  const raw = await r.json().catch(() => ({}));
  const d = normalizePayload<T>(raw);
  if (!r.ok) {
    const code = (d as any)?.code || '';
    if (r.status === 401 || code === 'INVALID_SESSION') {
      localStorage.clear();
      window.location.replace('/onboard/auth');
      await new Promise(() => {});
    }
    if (r.status === 409 || code === 'ROLE_PENDING') {
      window.location.replace('/onboard/role');
      await new Promise(() => {});
    }
    throw new Error((d as any)?.message || code || 'Ошибка запроса');
  }
  return d;
}

export async function apiPost<T=any>(url: string, payload: any): Promise<T> {
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  const raw = await r.json().catch(() => ({}));
  const d = normalizePayload<T>(raw);
  if (!r.ok) {
    const code = (d as any)?.code || '';
    if (r.status === 401 || code === 'INVALID_SESSION') {
      localStorage.clear();
      window.location.replace('/onboard/auth');
      await new Promise(() => {});
    }
    if (r.status === 409 || code === 'ROLE_PENDING') {
      window.location.replace('/onboard/role');
      await new Promise(() => {});
    }
    throw new Error((d as any)?.message || code || 'Ошибка запроса');
  }
  return d;
}

export function goHome() {
  try { window.location.assign('/home'); } catch {}
  try { window.location.replace('/home'); } catch {}
  setTimeout(() => { try { window.location.href = '/home'; } catch {} }, 150);
}

export function getSessionToken(): string {
  return cleanToken(localStorage.getItem('session_token'));
}
export function getRole(): 'pending'|'athlete'|'coach' {
  return (localStorage.getItem('user_role') || 'pending').toLowerCase() as any;
}
export function hasPdn(): boolean {
  return localStorage.getItem('pdn_ok') === '1';
}