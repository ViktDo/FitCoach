'use client';

import Link from 'next/link';

export default function OfferPage() {
  return (
    <main className="bg-gray-50 min-h-screen text-gray-800">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl p-6 mt-8 mb-12">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">Публичная оферта</h1>
          <Link
            href="/onboard/consent"
            className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            ← Назад
          </Link>
        </div>

        <p className="text-gray-600 mt-4 mb-6">
          Настоящий документ является черновой версией публичной оферты платформы{' '}
          <strong>FitCoach</strong>. Текст предназначен исключительно для тестирования фронтенда и
          не имеет юридической силы.
        </p>

        <section className="space-y-4">
          <p>
            1. Данный текст предназначен для проверки отображения длинных разделов и навигации
            внутри WebApp.
          </p>
          <p>
            2. В финальной версии здесь будет изложен порядок предоставления услуг, права и
            обязанности сторон, условия оплаты и иные юридически значимые положения.
          </p>
          <p>3. Настоящая страница не содержит персональных данных и не требует согласия пользователя.</p>
        </section>

        <p className="mt-8 text-sm text-gray-400">Черновик v0.1</p>
      </div>
    </main>
  );
}