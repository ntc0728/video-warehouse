import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.videowarehouse.app',
  appName: 'kinoTv',
  version: '1.31.0',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      // 启动页兜底背景色（浅色）。真正的启动底图是预烘焙位图
      // res/drawable*/splash.png（深色变体 res/drawable-night*/splash.png，
      // 共 11 个变体 = drawable-night + land/port × 5 dpi，深底 #141414）；
      // androidScaleType CENTER_CROP + splashFullScreen 让底图铺满全屏，
      // 故此值正常路径不可见，只在插件自身兜底层生效。
      // 注意：这些位图只存在于本地 android/app/src/main/res/（android/ 被
      // gitignore，未入库），换机器 / 重新 `cap add` 后需重新生成或补进
      // scripts/android-res-patch/drawable*/（构建脚本会整树拷贝）。
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
  android: {
    versionCode: 131000,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
