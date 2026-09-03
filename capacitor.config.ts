import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.haven.app',
  appName: 'HAVEN',
  webDir: 'dist',
  backgroundColor: '#FDFCFB',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#FDFCFB',
  },
};

export default config;
