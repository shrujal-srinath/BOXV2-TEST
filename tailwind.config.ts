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
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Oswald', 'Inter', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
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

        // ── Courtside light-mode token system ──
        cs: {
          'bg':              'var(--cs-bg-primary)',
          'surface':         'var(--cs-surface-primary)',
          'elevated':        'var(--cs-surface-elevated)',
          'overlay':         'var(--cs-surface-overlay)',
          'accent':          'var(--cs-accent-primary)',
          'accent-pressed':  'var(--cs-accent-pressed)',
          'accent-subtle':   'var(--cs-accent-subtle)',
          'text':            'var(--cs-text-primary)',
          'text-2':          'var(--cs-text-secondary)',
          'text-3':          'var(--cs-text-tertiary)',
          'on-accent':       'var(--cs-text-on-accent)',
          'border':          'var(--cs-border-subtle)',
          'border-strong':   'var(--cs-border-medium)',
          'success':         'var(--cs-success)',
          'warning':         'var(--cs-warning)',
          'error':           'var(--cs-error)',
          'info':            'var(--cs-info)',
        },
      },
      boxShadow: {
        'cs-card':     '0 4px 10px rgba(0,0,0,0.05)',
        'cs-elevated': '0 6px 16px rgba(0,0,0,0.08)',
        'cs-navbar':   '0 4px 20px rgba(0,0,0,0.07)',
        'cs-fab':      '0 4px 16px rgba(232,17,45,0.28)',
        'cs-search':   '0 1px 4px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        'pill': '9999px',
        'cs-card': '16px',
        'cs-md': '12px',
        'cs-sm': '8px',
        'cs-xl': '20px',
      },
      letterSpacing: {
        'label-m': '0.073em',  // ~0.8/11
        'label-s': '0.12em',   // 1.2/10
        'wordmark': '0.22em',
      },
    },
  },
  plugins: [],
}
