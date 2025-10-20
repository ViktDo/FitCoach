import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Публичная оферта · FitCoach',
  description: 'Публичная оферта сервиса FitCoach',
  openGraph: {
    title: 'Публичная оферта · FitCoach',
    description: 'Публичная оферта сервиса FitCoach (FitCoach Platform)',
    type: 'article',
  },
};

// Новый формат viewport (чтобы убрать все build warning)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4F46E5',
};

export const dynamic = 'force-static'; // безопасно для SSG и Docker build

export default function OfferDocPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-3xl bg-white shadow rounded-2xl m-4 p-6">
        <h1 className="text-2xl font-semibold mb-4 text-gray-900">
          Публичная оферта
        </h1>
        <iframe
          src="/docs/offer.html"
          className="w-full h-[80vh] border rounded-lg"
          title="Публичная оферта"
          loading="lazy"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}