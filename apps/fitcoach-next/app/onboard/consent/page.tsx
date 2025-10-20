'use client';

import { useEffect, useState } from 'react';
import { API_BASE, cleanToken, getRole, hasPdn, normalizePhone } from '@/app/lib/client';

const PDN_VERSION = 'v1.0';

export default function ConsentPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = cleanToken(localStorage.getItem('session_token'));
    if (!token) { window.location.replace('/onboard/auth'); return; }
    const role = getRole();
    if (role === 'pending') { window.location.replace('/onboard/role'); return; }
    if (hasPdn()) { window.location.replace('/onboard/profile'); return; }
  }, []);

  async function onSubmit() {
    setMsg('');
    const token = cleanToken(localStorage.getItem('session_token'));
    const fn = fullName.trim();
    const ph = normalizePhone(phone);

    if (!fn) { setMsg('Укажите ФИО'); return; }
    if (!ph) { setMsg('Укажите номер телефона'); return; }
    if (!agree) { setMsg('Необходимо согласие на обработку ПДн'); return; }

    try {
      const r = await fetch(`${API_BASE}/api/consent`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ session_token: token, full_name: fn, phone: ph, accepted: true, version: PDN_VERSION })
      });
      const d = await r.json().catch(()=> ({}));
      if (!r.ok) throw new Error(d?.message || d?.code || 'Не удалось сохранить согласие');

      localStorage.setItem('pdn_ok','1');
      localStorage.setItem('pdn_version', d?.version || PDN_VERSION);
      if (d?.ts) localStorage.setItem('pdn_ts', d.ts);
      // Сохраним для автоподстановки в профиле
      localStorage.setItem('full_name', fn);
      localStorage.setItem('phone', ph);

      setMsg('Согласие сохранено. Переход к профилю…');
      setTimeout(() => window.location.replace('/onboard/profile'), 250);
    } catch (e:any) {
      setMsg(e?.message || 'Не удалось сохранить согласие');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-xl bg-white shadow-lg rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-2">Согласие на обработку ПДн</h1>
        <p className="text-gray-600 mb-4">
          Для продолжения необходимо согласие (ФЗ-152). Данные хранятся в РФ и используются только для работы сервиса.
          Полные тексты: <a className="text-indigo-600 underline" href="/onboard/docs/pdn-policy">Политика ПДн</a>,{' '}
          <a className="text-indigo-600 underline" href="/onboard/docs/offer">Публичная оферта</a>.
        </p>
        <div className="space-y-4">
          <label className="block">
            <span className="block mb-1 font-medium">ФИО</span>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
          </label>
          <label className="block">
            <span className="block mb-1 font-medium">Телефон</span>
            <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="+7 999 123-45-67" />
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} className="mt-1" />
            <span className="text-sm text-gray-700">Я даю согласие и подтверждаю, что ознакомлен(а) с документами.</span>
          </label>
          <button onClick={onSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold">
            Принять и продолжить
          </button>
          <p className="text-sm mt-2">{msg}</p>
        </div>
      </div>
    </main>
  );
}