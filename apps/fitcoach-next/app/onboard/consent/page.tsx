'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  API_BASE,
  cleanToken,
  getRole,
  hasPdn,
  normalizePhone,
} from '@/lib/client';

const PDN_VERSION = 'v1.0';

type ApiPayload = Record<string, any>;

// {}, [{…}], [{json:{…}}] → {…}
function normalizePayload(raw: any) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first && typeof first === 'object' && 'json' in first && first.json && typeof first.json === 'object') {
    return first.json;
  }
  return first || {};
}

export default function ConsentPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);

  const [msg, setMsg] = useState<string>('');
  const [msgKind, setMsgKind] = useState<'neutral'|'error'|'ok'>('neutral');
  const [submitting, setSubmitting] = useState(false);

  // валидность формы
  const isValid = useMemo(() => {
    const fn = fullName.trim();
    const ph = normalizePhone(phone);
    return Boolean(fn && ph && agree);
  }, [fullName, phone, agree]);

  // guard-редиректы и префилл
  useEffect(() => {
    try {
      const token = cleanToken(localStorage.getItem('session_token'));
      if (!token) { window.location.replace('/onboard/auth'); return; }
      const role = getRole();
      if (role === 'pending') { window.location.replace('/onboard/role'); return; }
      if (hasPdn()) { window.location.replace('/onboard/profile'); return; }

      // префилл (если вернулись на страницу)
      const ln = localStorage.getItem('full_name') || '';
      const lp = localStorage.getItem('phone') || '';
      if (ln) setFullName(ln);
      if (lp) setPhone(lp);
    } catch {
      // в самых редких случаях при SSR-клиентных гонках
      /* noop */
    }
  }, []);

  async function postJSON(url: string, payload: ApiPayload, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const raw = await r.json().catch(()=> ({}));
      const d = normalizePayload(raw);

      const code = d?.code || '';
      if (r.status === 401 || code === 'INVALID_SESSION') {
        localStorage.clear();
        window.location.replace('/onboard/auth');
        return new Promise<never>(() => {});
      }
      if (r.status === 409 || code === 'ROLE_PENDING') {
        window.location.replace('/onboard/role');
        return new Promise<never>(() => {});
      }
      if (!r.ok) {
        throw new Error(d?.message || code || 'Ошибка запроса');
      }
      return d;
    } finally {
      clearTimeout(timer);
    }
  }

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg('');
    setMsgKind('neutral');

    const token = cleanToken(localStorage.getItem('session_token'));
    const fn = fullName.trim();
    const ph = normalizePhone(phone);

    if (!fn) { setMsgKind('error'); setMsg('Укажите ФИО'); return; }
    if (!ph) { setMsgKind('error'); setMsg('Укажите номер телефона'); return; }
    if (!agree) { setMsgKind('error'); setMsg('Необходимо согласие на обработку ПДн'); return; }

    setSubmitting(true);
    try {
      const d = await postJSON(`${API_BASE}/api/consent`, {
        session_token: token,
        full_name: fn,
        phone: ph,
        accepted: true,
        version: PDN_VERSION,
      });

      // флаги и кэш для автоподстановки
      localStorage.setItem('pdn_ok', '1');
      localStorage.setItem('pdn_version', d?.version || PDN_VERSION);
      if (d?.ts) localStorage.setItem('pdn_ts', d.ts);
      localStorage.setItem('full_name', fn);
      localStorage.setItem('phone', ph);

      setMsgKind('ok');
      setMsg('Согласие сохранено. Переход к профилю…');
      setTimeout(() => window.location.replace('/onboard/profile'), 250);
    } catch (e: any) {
      setMsgKind('error');
      setMsg(e?.message || 'Не удалось сохранить согласие');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl bg-white shadow-lg rounded-2xl p-6"
      >
        <h1 className="text-2xl font-bold mb-2">Согласие на обработку ПДн</h1>
        <p className="text-gray-600 mb-4">
          Для продолжения необходимо согласие (ФЗ-152). Данные хранятся в РФ и используются только для работы сервиса.
          Полные тексты:{' '}
          <a className="text-indigo-600 underline" href="/onboard/docs/pdn-policy" target="_blank" rel="noreferrer">Политика ПДн</a>,{' '}
          <a className="text-indigo-600 underline" href="/onboard/docs/offer" target="_blank" rel="noreferrer">Публичная оферта</a>.
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="block mb-1 font-medium">ФИО</span>
            <input
              value={fullName}
              onChange={e=>setFullName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              autoComplete="name"
              placeholder="Иванов Иван Иванович"
            />
          </label>

          <label className="block">
            <span className="block mb-1 font-medium">Телефон</span>
            <input
              value={phone}
              onChange={e=>setPhone(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
            />
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={agree}
              onChange={e=>setAgree(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              Я даю согласие на обработку персональных данных и подтверждаю, что ознакомлен(а)
              с Политикой и Офертой.
            </span>
          </label>

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold disabled:opacity-60"
          >
            {submitting ? 'Сохраняем…' : 'Принять и продолжить'}
          </button>

          {!!msg && (
            <p
              className={
                'text-sm mt-2 ' +
                (msgKind === 'error' ? 'text-red-600' : msgKind === 'ok' ? 'text-green-600' : '')
              }
            >
              {msg}
            </p>
          )}
        </div>
      </form>
    </main>
  );
}