import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tayba.pos',
  appName: 'طيبة POS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: false,
  },
}

export default config