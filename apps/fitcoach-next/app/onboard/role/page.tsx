'use client';

import { useEffect, useState } from 'react';
import { API_BASE, cleanToken, getRole, hasPdn, toBoolean } from '@/app/lib/client';

export default function RolePage() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = cleanToken(localStorage.getItem('session_token'));
    if (!token) { window.location.replace('/onboard/auth'); return; }
    const role = getRole();
    const pdnOk = hasPdn();
    if (role !== 'pending') {
      if (!pdnOk) window.location.replace('/onboard/consent');
      else window.location.replace('/onboard/profile');
    }
  }, []);

  async function choose(role: 'athlete'|'coach') {
    setMsg('Сохраняем роль…');
    const token = cleanToken(localStorage.getItem('session_token'));
    try {
      const r = await fetch(`${API_BASE}/api/auth/role`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ session_token: token, role })
      });
      const d = await r.json().catch(()=> ({}));
      if (r.status === 409 && d?.code === 'ROLE_LOCKED') {
        localStorage.setItem('user_role', role);
        const pdnRequired = toBoolean(d?.pdn_required);
        if (pdnRequired) window.location.replace('/onboard/consent');
        else window.location.replace('/onboard/profile');
        return;
      }
      if (!r.ok) throw new Error(d?.message || d?.code || 'Ошибка запроса');

      const serverRole = String(d?.role || role).toLowerCase() as 'athlete'|'coach';
      localStorage.setItem('user_role', serverRole);
      const pdnRequired = toBoolean(d?.pdn_required);
      if (!pdnRequired) localStorage.setItem('pdn_ok', '1'); else localStorage.removeItem('pdn_ok');

      setMsg('Роль сохранена. Продолжаем…');
      setTimeout(() => {
        if (pdnRequired) window.location.replace('/onboard/consent');
        else window.location.replace('/onboard/profile');
      }, 250);
    } catch (e:any) {
      setMsg(e?.message || 'Ошибка сохранения роли');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-1">Кто вы?</h1>
        <p className="text-gray-500 mb-6">Выберите роль — это влияет на интерфейс и доступы.</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button onClick={() => choose('athlete')} className="border rounded-xl p-4 hover:bg-indigo-50">
            <div className="text-lg font-semibold">Спортсмен</div>
            <div className="text-xs text-gray-500 mt-1">Планы, фиксация, прогресс</div>
          </button>
          <button onClick={() => choose('coach')} className="border rounded-xl p-4 hover:bg-indigo-50">
            <div className="text-lg font-semibold">Тренер</div>
            <div className="text-xs text-gray-500 mt-1">Назначения, отчёты</div>
          </button>
        </div>
        <p className="text-sm mt-2">{msg}</p>
      </div>
    </main>
  );
}