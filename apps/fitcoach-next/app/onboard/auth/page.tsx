'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import {
  API_BASE,
  cleanToken,
  toBoolean,
  postJSON,
} from '@/app/lib/client';

// Явное расширение глобального окна для TS
declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

// Добавлен простой компонент-спиннер
function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-gray-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [state, setState] = useState('Проверяем контекст Telegram WebApp…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        // ждём SDK из <Script>
        const tg = window?.Telegram?.WebApp;
        if (!tg || !tg.initData) {
          throw new Error('Эта страница должна открываться внутри Telegram как WebApp.');
        }

        tg.expand?.();
        tg.ready?.();

        const initData = tg.initData || '';
        const unsafe = tg.initDataUnsafe || {};
        const user = unsafe.user || null;

        if (!initData || !user?.id) {
          throw new Error('Не удалось получить данные из Telegram. Откройте страницу из Telegram.');
        }

        setState('Аутентификация…');

        const data = await postJSON(`${API_BASE}/api/auth/telegram`, {
          platform: 'telegram',
          platform_id: String(user.id),
          initData,
        });

        // Сессия
        const token = cleanToken((data as any)?.session_token);
        if (!token) throw new Error('Не удалось авторизоваться: отсутствует session_token');

        localStorage.setItem('session_token', token);
        const role = String((data as any)?.role || 'pending').toLowerCase();
        localStorage.setItem('user_role', role);

        // Флаг ПДн
        const pdnRequired = toBoolean((data as any)?.pdn_required);
        localStorage.setItem('pdn_required', String(pdnRequired));
        if (!pdnRequired) {
          localStorage.setItem('pdn_ok', '1');
          localStorage.setItem('pdn_version', String((data as any)?.pdn_version || '1'));
          localStorage.setItem('pdn_ts', new Date().toISOString());
        } else {
          localStorage.removeItem('pdn_ok');
        }

        // Роутинг: role → role | consent → consent | иначе → home
        setState('Готово, перенаправляем…');
        setTimeout(() => {
          if (role === 'pending') {
            router.replace('/onboard/role');
          } else if (!pdnRequired) {
            router.replace('/home');
          } else {
            router.replace('/onboard/consent');
          }
        }, 150);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Ошибка входа через Telegram');
        setState('');
      }
    }

    // небольшой delay, чтобы SDK точно загрузился
    const t = setTimeout(run, 50);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <>
      {/* Telegram WebApp SDK */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6">
          <h1 className="text-2xl font-bold mb-2">FitCoach</h1>
          <p className="text-gray-500 mb-6">Вход через Telegram…</p>

          {!error ? (
            <div className="flex items-center gap-3">
              <Spinner />
              <p className="text-sm text-gray-600" aria-live="polite">{state}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{error}</p>
              <p className="text-xs text-gray-500">
                Убедитесь, что открываете приложение внутри Telegram как WebApp.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}