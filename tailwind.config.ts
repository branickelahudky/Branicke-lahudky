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
          bg:      '#0a0a0a',
          surface: '#141414',
          card:    '#1c1c1c',
          border:  '#2a2a2a',
          muted:   '#6b6b6b',
        },
      },
    },
  },
  plugins: [],
}

export default config
