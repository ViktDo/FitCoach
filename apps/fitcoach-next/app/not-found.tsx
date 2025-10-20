export const metadata = {
  title: 'Страница не найдена · FitCoach',
  description: 'Ошибка 404 — страница не найдена',
};

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-6">
      <h1 className="text-4xl font-bold text-indigo-600 mb-3">404</h1>
      <p className="text-gray-700 mb-6">Страница не найдена или была удалена.</p>
      <a
        href="/"
        className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2 font-semibold transition"
      >
        На главную
      </a>
    </main>
  );
}