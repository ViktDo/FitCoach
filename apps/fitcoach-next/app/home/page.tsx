'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">FitCoach · Home</h1>
        <p className="text-gray-600">FitCoach is up ✅</p>

        <div className="border rounded-xl p-4 space-y-3">
          <div className="font-semibold">Навигация</div>
          <div className="grid grid-cols-1 gap-2">
            <Link href="/onboard/profile" className="px-4 py-2 border rounded-xl hover:bg-gray-50">Профиль</Link>
            <Link href="/onboard/role" className="px-4 py-2 border rounded-xl hover:bg-gray-50">Выбор роли</Link>
            <Link href="/onboard/consent" className="px-4 py-2 border rounded-xl hover:bg-gray-50">Согласие ПДн</Link>
          </div>
        </div>
      </div>
    </main>
  );
}