import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.videowarehouse.app',
  appName: 'kinoTv',  version: '1.4.0',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      // 启动页背景跟随设备主题（白/黑）：主题色交给 res 的 drawable-night 变体，
      // 此值仅作插件兜底背景，统一为浅色（splash.png 自带覆盖背景）。
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1890ff',
    },
  },
  android: {    versionCode: 104000,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
