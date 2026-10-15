import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.femcare.app',
  appName: 'FemCare',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#fff5f7',
    webContentsDebuggingEnabled: false,
    initialFocus: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
