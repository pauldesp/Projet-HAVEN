import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // This mDNS name is already authorized for Haven in Firebase Auth and
        // stays stable when the Mac's Wi-Fi address changes.
        allowedHosts: ['macbook-pro-de-desplanques.local'],
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: {
            // Libraries change rarely: separate files stay cached by browsers from one release to the next
            // and download in parallel with the application code.
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (/node_modules\/(@firebase|firebase|idb)\//.test(id)) return 'vendor-firebase';
              if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-react';
              return undefined;
            },
          },
        },
      },
      define: {
        'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
