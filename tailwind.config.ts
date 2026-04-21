/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      colors: {
        'box-surface':       'var(--surface)',
        'box-card':          'var(--surface-card)',
        'box-raised':        'var(--surface-raised)',
        'box-text':          'var(--text-primary)',
        'box-secondary':     'var(--text-secondary)',
        'box-muted':         'var(--text-muted)',
        'box-border':        'var(--border)',
        'box-border-subtle': 'var(--border-subtle)',
      },
    },
  },
  plugins: [],
}