import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Vores Kok', template: '%s · Vores Kok' },
  description: 'Familiens fælles digitale køkken — opskrifter, historier og minder.',
  applicationName: 'Vores Kok',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FAF6EF' }, { media: '(prefers-color-scheme: dark)', color: '#1C1714' }],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body className="antialiased">{children}</body>
    </html>
  );
}
