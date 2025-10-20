'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
  onboard: 'Онбординг',
  docs: 'Документы',
  'pdn-policy': 'Политика ПДн',
  offer: 'Публичная оферта',
};

export default function Breadcrumbs() {
  const pathname = usePathname() || '/';
  const parts = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Хлебные крошки" className="text-sm text-gray-500">
      <Link href="/home" className="text-indigo-600 hover:underline">Главная</Link>
      {parts.map((seg, idx) => {
        const href = '/' + parts.slice(0, idx + 1).join('/');
        const isLast = idx === parts.length - 1;
        const label = LABELS[seg] || seg;
        return (
          <span key={href} className="inline-flex items-center">
            <span className="mx-2 text-gray-400">/</span>
            {isLast ? (
              <span className="text-gray-900">{label}</span>
            ) : (
              <Link href={href} className="text-indigo-600 hover:underline">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}