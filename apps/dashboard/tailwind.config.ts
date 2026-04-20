import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#1f7a66',
          foreground: '#ffffff',
          deep: '#10473b',
          soft: '#e3f4ec',
        },
        accent: {
          DEFAULT: '#8dc63f',
          foreground: '#1b3f10',
          soft: '#eef7db',
        },
        drop: '#f2edb5',
      },
      boxShadow: {
        premium: '0 20px 60px -20px rgba(16, 71, 59, 0.35)',
        card: '0 10px 30px -12px rgba(16, 71, 59, 0.18)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(120deg, #10473b 0%, #1f7a66 35%, #3d9175 65%, #8dc63f 100%)',
        'brand-gradient-soft':
          'linear-gradient(120deg, rgba(31,122,102,0.08) 0%, rgba(141,198,63,0.12) 100%)',
        'brand-radial':
          'radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)',
        'noise':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
