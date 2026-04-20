import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      minHeight: {
        'btn-xl': '6rem',
      },
      fontSize: {
        xxl: ['1.75rem', '2.25rem'],
      },
    },
  },
  plugins: [],
};

export default config;
