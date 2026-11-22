import typography from '@tailwindcss/typography';

/** Compiled at build time (was the Tailwind CDN): lets the site run under a strict Content Security Policy. */
export default {
  // Hover effects only on devices with a real pointer: on phones they used to stay stuck after a tap.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './pages/**/*.{ts,tsx}', './contexts/**/*.{ts,tsx}', './services/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        haven: {
          navy: '#0B245B',
          'navy-deep': '#081A42',
          red: '#9A073C',
          'red-deep': '#7E0631',
          cream: '#F9FAF5',
          // Brand palette: navy #0B245B, light gray #E1E0E0, off-white #F9FAF5, burgundy #9A073C.
          gray: '#E1E0E0',
          // Secondary text: a cool gray that goes with the navy.
          stone: '#626878',
          // Tints derived from the palette, for backgrounds and soft accents.
          sand: '#EFEEEA',
          blush: '#F3E5EA',
        },
      },
      fontFamily: {
        heading: ['DM Sans Variable', 'DM Sans', 'system-ui', 'sans-serif'],
        body: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        premium: '0 20px 50px -12px rgba(11, 36, 91, 0.1)',
        lift: '0 24px 60px -20px rgba(11, 36, 91, 0.28)',
      },
    },
  },
  plugins: [typography],
};
