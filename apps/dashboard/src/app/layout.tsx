import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaInstaller } from '@/components/pwa-installer';

export const metadata: Metadata = {
  title: 'Clínica Imuniza — Dashboard',
  description: 'Plataforma de atendimento humanizado via WhatsApp — IA, fila humana e métricas em tempo real.',
  applicationName: 'Imuniza',
  appleWebApp: {
    capable: true,
    title: 'Imuniza',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/logo.png', type: 'image/png', sizes: '192x192' },
      { url: '/logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/logo.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/logo.png',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1f7a66' },
    { media: '(prefers-color-scheme: dark)', color: '#10473b' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <PwaInstaller />
      </body>
    </html>
  );
}
