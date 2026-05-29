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
      },
    },
  },
  plugins: [],
}

export default config
