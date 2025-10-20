// apps/fitcoach-next/app/onboard/docs/pdn-policy/page.tsx
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Политика ПДн · FitCoach',
  description: 'Политика обработки персональных данных FitCoach',
  openGraph: {
    title: 'Политика ПДн · FitCoach',
    description: 'Политика обработки персональных данных FitCoach.',
    type: 'article',
  },
};

// Новый формат viewport для Next 14 (убирает warnings)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4F46E5',
};

export const dynamic = 'force-static'; // совместимо с SSG и Docker build

export default function PdnPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-3xl bg-white shadow rounded-2xl m-4 p-6">
        <h1 className="text-2xl font-semibold mb-4 text-gray-900">
          Политика ПДн
        </h1>
        <iframe
          src="/docs/pdn-policy.html"
          className="w-full h-[80vh] border rounded-lg"
          title="Политика обработки персональных данных"
          loading="lazy"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}