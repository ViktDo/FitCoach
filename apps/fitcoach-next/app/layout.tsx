import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'FitCoach',
  description: 'Персональные тренировки и аналитика в Telegram',
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

// Вынесено из metadata
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4F46E5', // Indigo 600
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}