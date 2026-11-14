import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrotrack.app',
  appName: 'AgroTrack',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    loggingBehavior: 'none'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_agrotrack',
      iconColor: '#0d8a5c'
    }
  }
};

export default config;
