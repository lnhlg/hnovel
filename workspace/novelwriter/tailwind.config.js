/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-accent-light)',
          100: 'var(--color-accent-light)',
          200: 'var(--color-accent-light)',
          300: 'var(--color-accent)',
          400: 'var(--color-accent)',
          500: 'var(--color-accent)',
          600: 'var(--color-accent-hover)',
          700: 'var(--color-accent-hover)',
          800: 'var(--color-accent-hover)',
          900: 'var(--color-accent-hover)'
        },
        gray: {
          50: 'var(--color-bg)',
          100: 'var(--color-border-light)',
          200: 'var(--color-border)',
          300: 'var(--color-border)',
          400: 'var(--color-text-muted)',
          500: 'var(--color-text-secondary)',
          600: 'var(--color-text)',
          700: 'var(--color-text)',
          800: 'var(--color-text)',
          900: 'var(--color-text)'
        },
        white: 'var(--color-surface)',
        black: 'var(--color-text)'
      },
      borderColor: {
        DEFAULT: 'var(--color-border)'
      },
      textColor: {
        DEFAULT: 'var(--color-text)'
      },
      backgroundColor: {
        DEFAULT: 'var(--color-bg)'
      }
    }
  },
  plugins: []
}
