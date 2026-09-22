import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FACC15', // VOLTSTAR yellow
          dark: '#111111',
        },
      },
    },
  },
  plugins: [],
};

export default config;
