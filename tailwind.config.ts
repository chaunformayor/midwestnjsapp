import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D1B2A',
          light: '#1A2F45',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E2C97A',
          dark: '#A88830',
        },
        'off-white': '#FAF9F6',
      },
      fontFamily: {
        head: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '12px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,.08)',
        DEFAULT: '0 4px 16px rgba(0,0,0,.10)',
        lg: '0 12px 40px rgba(0,0,0,.15)',
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#1F2937',
            a: { color: '#A88830', '&:hover': { color: '#C9A84C' } },
            h1: { fontFamily: 'Playfair Display, Georgia, serif', color: '#0D1B2A' },
            h2: { fontFamily: 'Playfair Display, Georgia, serif', color: '#0D1B2A' },
            h3: { fontFamily: 'Playfair Display, Georgia, serif', color: '#0D1B2A' },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
