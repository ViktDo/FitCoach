// apps/fitcoach-next/app/onboard/docs/layout.tsx
import type { ReactNode } from 'react';
import Link from 'next/link';

// ===== SEO по умолчанию для всего раздела /onboard/docs =====
export const metadata = {
  title: 'Документы · FitCoach',
  description:
    'Документы FitCoach: Политика обработки персональных данных и Публичная оферта. Данные обрабатываются в РФ и используются только для работы сервиса.',
  openGraph: {
    title: 'Документы · FitCoach',
    description:
      'Политика обработки персональных данных и Публичная оферта FitCoach.',
    type: 'website',
  },
};

function Logo() {
  return (
    <Link href="/home" className="group inline-flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center shadow-md group-hover:scale-[1.02] transition">
        <span className="font-bold">FC</span>
      </div>
      <span className="text-lg font-semibold text-gray-800">FitCoach</span>
    </Link>
  );
}

// Небольшая “крошка” с автогенерацией из pathname.
// Отдельный client-компонент, чтобы не переводить весь layout в client.
function Breadcrumbs() {
  'use client';
  const { usePathname } = require('next/navigation');
  const pathname: string = usePathname();
  const parts = pathname.split('/').filter(Boolean);

  // Читабельные лейблы для известных сегментов
  const labels: Record<string, string> = {
    onboard: 'Онбординг',
    docs: 'Документы',
    'pdn-policy': 'Политика ПДн',
    offer: 'Публичная оферта',
  };

  const items = parts.map((seg, idx) => {
    const href = '/' + parts.slice(0, idx + 1).join('/');
    const isLast = idx === parts.length - 1;
    const label = labels[seg] || seg;
    return (
      <span key={href} className="inline-flex items-center">
        {idx > 0 && <span className="mx-2 text-gray-400">/</span>}
        {isLast ? (
          <span className="text-gray-900">{label}</span>
        ) : (
          <Link href={href} className="text-indigo-600 hover:underline">
            {label}
          </Link>
        )}
      </span>
    );
  });

  return (
    <nav aria-label="Хлебные крошки" className="text-sm text-gray-500">
      <Link href="/home" className="text-indigo-600 hover:underline">
        Главная
      </Link>
      <span className="mx-2 text-gray-400">/</span>
      {items}
    </nav>
  );
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Top bar */}
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Logo />
            <p className="text-sm text-gray-500">
              Документы сервиса и юридическая информация
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/onboard/consent"
              className="rounded-xl border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              ← Назад к согласию
            </Link>
            <Link
              href="/home"
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
            >
              На главную
            </Link>
          </div>
        </header>

        {/* Breadcrumbs */}
        <div className="mb-4">
          <Breadcrumbs />
        </div>

        {/* Card container */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          {children}
        </section>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} FitCoach · Все права защищены
        </footer>
      </div>
    </main>
  );
}