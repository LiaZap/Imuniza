import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Clínica Imuniza',
    short_name: 'Imuniza',
    description:
      'Plataforma de atendimento humanizado via WhatsApp — IA, fila humana e métricas em tempo real.',
    lang: 'pt-BR',
    start_url: '/queue',
    scope: '/',
    display: 'standalone',
    background_color: '#10473b',
    theme_color: '#1f7a66',
    orientation: 'portrait',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    categories: ['health', 'medical', 'business'],
  };
}
