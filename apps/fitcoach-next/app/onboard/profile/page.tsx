'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  API_BASE,
  cleanToken,
  getRole,
  hasPdn,
  normalizePhone,
  apiGet,
  apiPost,
  stripEq,
  goHome,
} from '@/app/lib/client';

type Role = 'athlete' | 'coach' | 'pending';

function isOk(resp: any): boolean {
  const v = resp?.ok ?? resp?.profile_saved ?? resp?.saved ?? resp?.success;
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === '=true';
}

export default function ProfilePage() {
  const [role, setRole] = useState<Role>('pending');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // общие
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // athlete
  const [aHeight, setAHeight] = useState<string>('');
  const [aWeight, setAWeight] = useState<string>('');
  const [aGoal, setAGoal] = useState('');
  const [aNotes, setANotes] = useState('');

  // coach
  const [cBio, setCBio] = useState('');
  const [cExp, setCExp] = useState<string>('');
  const [cInst, setCInst] = useState(''); // url/handle
  const [cTgCh, setCTgCh] = useState(''); // @handle | url
  const [cTgLink, setCTgLink] = useState(''); // url/@handle

  const token = useMemo(() => cleanToken(typeof window !== 'undefined' ? localStorage.getItem('session_token') : ''), []);

  useEffect(() => {
    if (!token) {
      window.location.replace('/onboard/auth');
      return;
    }
    const r = getRole();
    if (r === 'pending') {
      window.location.replace('/onboard/role');
      return;
    }
    if (!hasPdn()) {
      window.location.replace('/onboard/consent');
      return;
    }
    setRole(r);

    (async () => {
      try {
        const res = await apiGet<any>(`${API_BASE}/api/profile?session_token=${encodeURIComponent(token)}`);
        const roleServer = String(stripEq(res?.role) || r).toLowerCase() as Role;
        setRole(roleServer);

        const p = res?.profile || {};
        const ln = (typeof window !== 'undefined' && localStorage.getItem('full_name')) || '';
        const lp = (typeof window !== 'undefined' && localStorage.getItem('phone')) || '';

        setFullName(String(stripEq(p.full_name) || ln || ''));
        setPhone(String(stripEq(p.phone) || lp || ''));

        if (roleServer === 'athlete') {
          if (p.height_cm != null) setAHeight(String(p.height_cm));
          if (p.weight_kg != null) setAWeight(String(p.weight_kg));
          if (p.goal) setAGoal(String(stripEq(p.goal)));
          if (p.notes) setANotes(String(stripEq(p.notes)));
        }
        if (roleServer === 'coach') {
          if (p.bio) setCBio(String(stripEq(p.bio)));
          if (p.experience_years != null) setCExp(String(p.experience_years));
          if (p.instagram) setCInst(String(stripEq(p.instagram)));
          if (p.telegram_channel) setCTgCh(String(stripEq(p.telegram_channel)));
          if (p.telegram_link) setCTgLink(String(stripEq(p.telegram_link)));
        }

        if (typeof window !== 'undefined') {
          localStorage.removeItem('full_name');
          localStorage.removeItem('phone');
        }
      } catch (e: any) {
        setMsg(e?.message || 'Не удалось загрузить профиль');
      }
    })();
  }, [token]);

  // ── нормализация соцсетей (UX) ──────────────────────────────
  function ensureHttps(u: string) {
    const s = (u || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s.replace(/^\/+/, '')}`;
  }
  function toInstagramUrl(v: string) {
    const s = (v || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    const handle = s.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/^www\./i, '');
    return `https://instagram.com/${handle}`;
  }
  function toTgUserUrl(v: string) {
    const s = (v || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    const handle = s.replace(/^@/, '').replace(/^t\.me\//i, '');
    return `https://t.me/${handle}`;
  }
  function toTgChannelVal(v: string) {
    const s = (v || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s; // полная ссылка ок
    return s; // допустим @handle или my_channel
  }

  // ── submit ──────────────────────────────────────────────────
  async function saveAthlete() {
    setMsg('');
    setBusy(true);
    try {
      const payload = {
        session_token: token,
        profile: {
          full_name: fullName.trim() || null,
          phone: normalizePhone(phone),
          height_cm: aHeight === '' ? null : Number(aHeight),
          weight_kg: aWeight === '' ? null : Number(aWeight),
          goal: aGoal.trim() || null,
          notes: aNotes.trim() || null,
        },
      };
      const resp = await apiPost<any>(`${API_BASE}/api/profile`, payload);
      if (isOk(resp)) return goHome();
      setMsg('Профиль сохранён. Переходим на главную…');
      setTimeout(goHome, 200);
    } catch (e: any) {
      setMsg(e?.message || 'Не удалось сохранить профиль');
    } finally {
      setBusy(false);
    }
  }

  async function saveCoach() {
    setMsg('');
    setBusy(true);
    try {
      const payload = {
        session_token: token,
        profile: {
          full_name: fullName.trim() || null,
          phone: normalizePhone(phone),
          bio: cBio.trim() || null,
          experience_years: cExp === '' ? 0 : Number(cExp),
          instagram: cInst.trim() ? toInstagramUrl(cInst) : null,
          telegram_channel: cTgCh.trim() ? toTgChannelVal(cTgCh) : null,
          telegram_link: cTgLink.trim() ? toTgUserUrl(cTgLink) : null,
        },
      };
      const resp = await apiPost<any>(`${API_BASE}/api/profile`, payload);
      if (isOk(resp)) return goHome();
      setMsg('Профиль сохранён. Переходим на главную…');
      setTimeout(goHome, 200);
    } catch (e: any) {
      setMsg(e?.message || 'Не удалось сохранить профиль');
    } finally {
      setBusy(false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-2xl p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">Профиль</h1>
            <p className="text-gray-500">Заполните базовые данные. Это можно изменить позже.</p>
          </div>
          <button
            type="button"
            onClick={goHome}
            className="ml-4 shrink-0 px-3 py-2 rounded-xl border text-sm hover:bg-gray-50"
          >
            ← Назад
          </button>
        </div>

        {/* Общие ПДн */}
        <div className="space-y-4 mb-6">
          <div className="text-lg font-semibold">Персональные данные</div>
          <label className="block">
            <span className="block mb-1 font-medium">ФИО</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Иванов Иван Иванович"
            />
          </label>
          <label className="block">
            <span className="block mb-1 font-medium">Телефон</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="+7 999 123-45-67"
            />
          </label>
          <p className="text-xs text-gray-500">
            Данные используются только для работы сервиса (уведомления, связь с тренером).
          </p>
        </div>

        {/* ATHLETE */}
        {role === 'athlete' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void saveAthlete();
            }}
            className="space-y-4"
          >
            <div className="text-lg font-semibold mb-2">Спортсмен</div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="block mb-1 font-medium">Рост (см)</span>
                <input
                  value={aHeight}
                  onChange={(e) => setAHeight(e.target.value)}
                  type="number"
                  min={100}
                  max={250}
                  className="w-full border rounded-xl px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="block mb-1 font-medium">Вес (кг)</span>
                <input
                  value={aWeight}
                  onChange={(e) => setAWeight(e.target.value)}
                  type="number"
                  step="0.1"
                  min={30}
                  max={300}
                  className="w-full border rounded-xl px-3 py-2"
                />
              </label>
            </div>
            <label className="block">
              <span className="block mb-1 font-medium">Цель</span>
              <input
                value={aGoal}
                onChange={(e) => setAGoal(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="Напр. «Набор мышечной массы»"
              />
            </label>
            <label className="block">
              <span className="block mb-1 font-medium">Заметки</span>
              <textarea
                value={aNotes}
                onChange={(e) => setANotes(e.target.value)}
                rows={3}
                className="w-full border rounded-xl px-3 py-2"
              />
            </label>
            <div className="flex gap-3">
              <button
                disabled={busy}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl py-2 font-semibold"
              >
                {busy ? 'Сохраняем…' : 'Сохранить профиль спортсмена'}
              </button>
              <button
                type="button"
                onClick={goHome}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50"
              >
                Назад
              </button>
            </div>
          </form>
        )}

        {/* COACH */}
        {role === 'coach' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void saveCoach();
            }}
            className="space-y-4"
          >
            <div className="text-lg font-semibold mb-2">Тренер</div>
            <label className="block">
              <span className="block mb-1 font-medium">О себе</span>
              <textarea
                value={cBio}
                onChange={(e) => setCBio(e.target.value)}
                rows={3}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="Краткое био, специализация"
              />
            </label>
            <label className="block">
              <span className="block mb-1 font-medium">Опыт, лет</span>
              <input
                value={cExp}
                onChange={(e) => setCExp(e.target.value)}
                type="number"
                min={0}
                max={60}
                className="w-full border rounded-xl px-3 py-2"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="block mb-1 font-medium">Instagram</span>
                <input
                  value={cInst}
                  onChange={(e) => setCInst(e.target.value)}
                  onBlur={() => setCInst((prev) => (prev ? ensureHttps(toInstagramUrl(prev)) : ''))}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="ваш @ник или ссылка"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Можно указать @ник — ссылка сформируется автоматически.
                </p>
              </label>
              <label className="block">
                <span className="block mb-1 font-medium">TG-канал</span>
                <input
                  value={cTgCh}
                  onChange={(e) => setCTgCh(e.target.value)}
                  onBlur={() => setCTgCh((prev) => (prev?.startsWith('http') ? ensureHttps(prev) : prev))}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="@my_channel или полная ссылка"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Можно @handle или полную ссылку (https://t.me/…)
                </p>
              </label>
            </div>

            <label className="block">
              <span className="block mb-1 font-medium">TG-ссылка (личный)</span>
              <input
                value={cTgLink}
                onChange={(e) => setCTgLink(e.target.value)}
                onBlur={() => setCTgLink((prev) => (prev ? ensureHttps(toTgUserUrl(prev)) : ''))}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="@username или https://t.me/username"
              />
              <p className="text-xs text-gray-500 mt-1">
                Можно указать @ник — ссылка t.me сформируется сама.
              </p>
            </label>

            <div className="flex gap-3">
              <button
                disabled={busy}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl py-2 font-semibold"
              >
                {busy ? 'Сохраняем…' : 'Сохранить профиль тренера'}
              </button>
              <button
                type="button"
                onClick={goHome}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50"
              >
                Назад
              </button>
            </div>
          </form>
        )}

        <p className="text-sm mt-4">{msg}</p>
      </div>
    </main>
  );
}