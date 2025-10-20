'use client';

import Link from 'next/link';

export default function PdnPolicyPage() {
  return (
    <main className="bg-gray-50 min-h-screen text-gray-800">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl p-6 mt-8 mb-12">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">Политика обработки персональных данных</h1>
          <Link
            href="/onboard/consent"
            className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            ← Назад
          </Link>
        </div>

        <p className="text-gray-600 mt-4 mb-6">
          Настоящая страница создана в качестве заглушки для тестирования интерфейса{' '}
          <strong>FitCoach</strong>. Текст политики будет размещён позже.
        </p>

        <section className="space-y-4">
          <p>1. Здесь будет указано, какие данные собираются, на каком основании и с какой целью.</p>
          <p>2. Описание мер по защите данных, сроков хранения и прав пользователя.</p>
          <p>
            3. В финальной версии документ будет утверждён и опубликован с указанием реквизитов
            оператора ПДн.
          </p>
        </section>

        <p className="mt-8 text-sm text-gray-400">Черновик v0.1</p>
      </div>
    </main>
  );
}