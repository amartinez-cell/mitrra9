/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4fa',
          100: '#d9e3f0',
          200: '#b3c7e0',
          300: '#8da8cd',
          400: '#5f82b4',
          500: '#3f6299',
          600: '#2f4d7d',
          700: '#253d64',
          800: '#1c2d4a',
          900: '#0f1d36',
          950: '#08122a',
        },
        accent: {
          amber: '#d97706',
          teal: '#0d9488',
          crimson: '#be123c',
        },
      },
      fontFamily: {
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgb(15 29 54 / 0.04), 0 2px 8px -2px rgb(15 29 54 / 0.06)',
        'card-hover': '0 2px 4px 0 rgb(15 29 54 / 0.06), 0 8px 24px -4px rgb(15 29 54 / 0.12)',
      },
    },
  },
  plugins: [],
}
