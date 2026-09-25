import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * Tailwind maps semantic names → CSS variables defined in app/globals.css.
 * The palette lives in ONE place (globals.css :root). Change it there;
 * every component follows. Components never hardcode hex values.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: 'var(--c-paper)',
        linen: 'var(--c-linen)',
        seam: 'var(--c-seam)',
        ink: 'var(--c-ink)',
        graphite: 'var(--c-graphite)',
        stone: 'var(--c-stone)',
        thread: 'var(--c-thread)',
        approve: 'var(--c-approve)',
        review: 'var(--c-review)',
        reject: 'var(--c-reject)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        label: '0.22em',      // tracked mono metadata
        display: '-0.03em',   // tight editorial kerning for big serif
      },
      maxWidth: {
        site: '1440px',
      },
    },
  },
  plugins: [
    // `photo-open:` styles an element while the search bar's photo drawer is open:
    // the [data-photo-area] wrapper itself, or anything inside it (app/search/page.tsx).
    plugin(({ addVariant }) => {
      addVariant('photo-open', ['&[data-photo-area]:has([data-photo-open])', '[data-photo-area]:has([data-photo-open]) &']);
    }),
  ],
};

export default config;
