/** @type {import('tailwindcss').Config} */

/**
 * ML Pro Suite — Design tokens
 * ------------------------------------------------------------------
 * Semantic colours read CSS variables (defined in src/index.css) so a
 * single `.dark` class on <html> re-skins the whole product without
 * duplicating a single utility class.
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Plus Jakarta Sans',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      colors: {
        /* ---- Semantic surfaces & text ---- */
        app: token('--app'),
        card: token('--card'),
        raised: token('--raised'),
        muted: token('--muted'),
        line: {
          DEFAULT: token('--line'),
          strong: token('--line-strong'),
        },
        ink: {
          DEFAULT: token('--ink'),
          muted: token('--ink-muted'),
          subtle: token('--ink-subtle'),
        },

        /* ---- Brand: Mercado Libre yellow ---- */
        brand: {
          DEFAULT: token('--brand'),
          strong: token('--brand-strong'),
          ink: token('--brand-ink'),
          soft: token('--brand-soft'),
          'soft-ink': token('--brand-soft-ink'),
          50: '#FFFDF0',
          100: '#FFF9D6',
          200: '#FFF2A8',
          300: '#FFE766',
          400: '#FFD600',
          500: '#F5C400',
          600: '#D9A600',
          700: '#A87C00',
          800: '#7A5A00',
          900: '#4D3900',
        },

        /* ---- Accent: Mercado Libre blue ---- */
        accent: {
          DEFAULT: token('--accent'),
          ink: token('--accent-ink'),
          soft: token('--accent-soft'),
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3483FA',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E3A8A',
          900: '#1E2A63',
        },

        /* ---- Feedback ---- */
        success: { DEFAULT: token('--success'), soft: token('--success-soft') },
        warning: { DEFAULT: token('--warning'), soft: token('--warning-soft') },
        danger: { DEFAULT: token('--danger'), soft: token('--danger-soft') },
        info: { DEFAULT: token('--info'), soft: token('--info-soft') },

        /* ---- Legacy ML aliases (kept so older markup keeps rendering) ---- */
        ml: {
          yellow: '#FFE600',
          yellowDark: '#E6CF00',
          blue: '#2D3277',
          blueLight: '#3483FA',
          gray: '#333333',
          bg: '#F5F5F5',
        },
      },

      borderRadius: {
        '4xl': '2rem',
      },

      boxShadow: {
        xs: '0 1px 2px 0 rgb(var(--shadow-color) / 0.06)',
        card: '0 1px 2px 0 rgb(var(--shadow-color) / 0.05), 0 8px 24px -12px rgb(var(--shadow-color) / 0.18)',
        'card-hover':
          '0 2px 4px 0 rgb(var(--shadow-color) / 0.06), 0 20px 36px -18px rgb(var(--shadow-color) / 0.28)',
        pop: '0 8px 16px -6px rgb(var(--shadow-color) / 0.16), 0 24px 48px -24px rgb(var(--shadow-color) / 0.32)',
        modal: '0 32px 64px -24px rgb(var(--shadow-color) / 0.45)',
        glow: '0 10px 26px -10px rgb(var(--brand) / 0.65)',
        'glow-accent': '0 10px 26px -10px rgb(var(--accent) / 0.55)',
        'ring-brand': '0 0 0 4px rgb(var(--brand) / 0.25)',
      },

      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #FFE566 0%, #FFD600 48%, #F0B800 100%)',
        'brand-sheen': 'linear-gradient(120deg, rgb(255 255 255 / 0.45), rgb(255 255 255 / 0) 62%)',
        'accent-gradient': 'linear-gradient(135deg, #4E9BFF 0%, #3483FA 55%, #1D4ED8 100%)',
        'ink-gradient': 'linear-gradient(160deg, #1B2340 0%, #0C1122 100%)',
        'grid-line':
          'linear-gradient(rgb(var(--line) / 0.75) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.75) 1px, transparent 1px)',
        'radial-brand': 'radial-gradient(70% 55% at 50% 0%, rgb(var(--brand) / 0.22), transparent 72%)',
        'radial-accent': 'radial-gradient(60% 60% at 100% 0%, rgb(var(--accent) / 0.22), transparent 70%)',
      },

      backgroundSize: {
        grid: '34px 34px',
      },

      ringColor: {
        DEFAULT: token('--accent'),
      },

      ringOffsetColor: {
        DEFAULT: token('--card'),
      },

      scale: {
        98: '0.98',
        102: '1.02',
      },

      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pop: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'none' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--success) / 0.5)' },
          '70%': { boxShadow: '0 0 0 8px rgb(var(--success) / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--success) / 0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },

      animation: {
        rise: 'rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fadeIn 0.25s ease-out both',
        pop: 'pop 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-down': 'slideDown 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s infinite',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};
