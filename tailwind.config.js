import typography from '@tailwindcss/typography';

/** Compiled at build time (was the Tailwind CDN): lets the site run under a strict Content Security Policy. */
export default {
  // Hover effects only on devices with a real pointer: on phones they used to stay stuck after a tap.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './pages/**/*.{ts,tsx}', './contexts/**/*.{ts,tsx}', './services/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm neutrals instead of Tailwind's cool grays: every gray-* class across the site follows.
        gray: {
          50: '#FAF9F6', 100: '#F3F2EE', 200: '#E7E5DF', 300: '#D6D3CB', 400: '#A9A69D',
          500: '#7F7C74', 600: '#625F58', 700: '#4A4842', 800: '#33322E', 900: '#22211E', 950: '#151412',
        },
        haven: {
          // Text: a deep, slightly blue near-black. Navy is kept for the brand moments (buttons, dark blocks, logo).
          ink: '#1B1E29',
          navy: '#0B245B',
          'navy-deep': '#081A42',
          red: '#9A073C',
          'red-deep': '#7E0631',
          cream: '#FBFAF6',
          // Brand palette: navy #0B245B, light gray #E1E0E0, off-white #F9FAF5, burgundy #9A073C.
          gray: '#E4E1DA',
          // Secondary text: a warm gray.
          stone: '#6B6962',
          // Tints derived from the palette, for backgrounds and soft accents.
          sand: '#F3F1EB',
          blush: '#F3E5EA',
        },
      },
      fontFamily: {
        // An editorial serif for titles, a plain sans for everything else: the contrast carries the character.
        heading: ['Newsreader Variable', 'Georgia', 'serif'],
        body: ['Manrope Variable', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Nearly flat: surfaces are told apart by their tone, not by shadows.
        soft: '0 1px 2px rgba(27, 30, 41, 0.04)',
        premium: '0 1px 2px rgba(27, 30, 41, 0.04), 0 8px 24px -16px rgba(27, 30, 41, 0.12)',
        lift: '0 1px 2px rgba(27, 30, 41, 0.05), 0 16px 40px -24px rgba(27, 30, 41, 0.22)',
      },
      // One motion curve everywhere: quick to start, long soft landing.
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [typography],
};
