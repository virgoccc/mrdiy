import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Black Han Sans"', 'sans-serif'],
        body: ['"Barlow Condensed"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        yellow: {
          DEFAULT: '#FFD600',
          hover: '#FFE033',
          dim: '#D4AF00',
          pale: '#FFFBEA',
        },
        brand: {
          bg: '#F7F6F2',
          bg2: '#EFEDE6',
          bg3: '#E5E2D8',
          card: '#FFFFFF',
          border: '#E2DFD3',
          border2: '#CCC9B5',
          txt: '#1A1A1A',
          txt2: '#3A3A38',
          muted: '#888880',
        },
      },
    },
  },
  plugins: [],
}
export default config
