import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        navy: {
          50: '#eef2f8',
          100: '#d9e2f0',
          500: '#3d5a80',
          700: '#1e3a5f',
          800: '#152a47',
          900: '#0f1f35',
        },
      },
    },
  },
  plugins: [],
};
export default config;
