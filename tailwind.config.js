import typography from '@tailwindcss/typography';

/** Compiled at build time (was the Tailwind CDN): lets the site run under a strict Content Security Policy. */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './pages/**/*.{ts,tsx}', './contexts/**/*.{ts,tsx}', './services/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        haven: {
          navy: '#1E293B',
          red: '#A34343',
          cream: '#FDFCFB',
          gray: '#F1F5F9',
          stone: '#78716C',
        },
      },
      fontFamily: {
        heading: ['DM Sans Variable', 'DM Sans', 'system-ui', 'sans-serif'],
        body: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        premium: '0 20px 50px -12px rgba(30, 41, 59, 0.1)',
      },
    },
  },
  plugins: [typography],
};
