import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FitCoach',
  description: 'Персональные тренировки и аналитика в Telegram',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#4F46E5', // Indigo 600
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'FitCoach',
    description: 'Онлайн-платформа тренировок и прогресса',
    type: 'website',
    locale: 'ru_RU',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Telegram WebApp корректно рендерит страницу с mobile-friendly viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#4F46E5" />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}