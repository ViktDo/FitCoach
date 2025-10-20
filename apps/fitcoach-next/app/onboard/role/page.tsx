'use client';

import { useEffect, useState } from 'react';
import {
  API_BASE,
  cleanToken,
  getRole,
  hasPdn,
  toBoolean,
  apiPost,
} from '@/lib/client';

type Role = 'athlete' | 'coach' | 'pending';

export default function RolePage() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = cleanToken(localStorage.getItem('session_token'));
    if (!token) {
      window.location.replace('/onboard/auth');
      return;
    }
    const role = getRole();
    const pdnOk = hasPdn();
    if (role !== 'pending') {
      if (!pdnOk) window.location.replace('/onboard/consent');
      else window.location.replace('/onboard/profile');
    }
  }, []);

  async function choose(role: Exclude<Role, 'pending'>) {
    if (busy) return;
    setBusy(true);
    setMsg('Сохраняем роль…');

    const token = cleanToken(localStorage.getItem('session_token'));

    try {
      const d = await apiPost<any>(`${API_BASE}/api/auth/role`, {
        session_token: token,
        role,
      });

      // 200 OK
      const serverRole = String(d?.role || role).toLowerCase() as Exclude<Role, 'pending'>;
      localStorage.setItem('user_role', serverRole);

      const pdnRequired = toBoolean(d?.pdn_required);
      if (!pdnRequired) localStorage.setItem('pdn_ok', '1');
      else localStorage.removeItem('pdn_ok');

      setMsg('Роль сохранена. Продолжаем…');
      setTimeout(() => {
        if (pdnRequired) window.location.replace('/onboard/consent');
        else window.location.replace('/onboard/profile');
      }, 200);
    } catch (e: any) {
      // apiPost уже делает редиректы для 401/409 нужных типов.
      // Если сюда попали — это «другая» ошибка.
      setMsg(e?.message || 'Ошибка сохранения роли');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-1">Кто вы?</h1>
        <p className="text-gray-500 mb-6">Выберите роль — это влияет на интерфейс и доступы.</p>

        <div className="grid grid-cols-2 gap-4 mb-4" aria-busy={busy} aria-live="polite">
          <button
            onClick={() => choose('athlete')}
            disabled={busy}
            className="border rounded-xl p-4 hover:bg-indigo-50 disabled:opacity-60"
          >
            <div className="text-lg font-semibold">Спортсмен</div>
            <div className="text-xs text-gray-500 mt-1">Планы, фиксация, прогресс</div>
          </button>

          <button
            onClick={() => choose('coach')}
            disabled={busy}
            className="border rounded-xl p-4 hover:bg-indigo-50 disabled:opacity-60"
          >
            <div className="text-lg font-semibold">Тренер</div>
            <div className="text-xs text-gray-500 mt-1">Назначения, отчёты</div>
          </button>
        </div>

        <p className="text-sm mt-2">{msg}</p>
      </div>
    </main>
  );
}