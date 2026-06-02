import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#B33A2A',
          cream: '#F2E8CF',
          ink: '#2A1F1A',
        },
        gold: '#C9A961',
        shop: {
          bg:      'var(--shop-bg)',
          surface: 'var(--shop-surface)',
          card:    'var(--shop-card)',
          border:  'var(--shop-border)',
          muted:   'var(--shop-muted)',
          fg:      'var(--shop-fg)',
        },
      },
    },
  },
  plugins: [],
}

export default config
