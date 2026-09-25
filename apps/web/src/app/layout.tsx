import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading request headers makes every page dynamic, which is required for the
  // per-request CSP nonce set in proxy.ts (Next applies it to its own scripts).
  await headers();
  return (
    <html lang="da">
      <body className="antialiased">{children}</body>
    </html>
  );
}
