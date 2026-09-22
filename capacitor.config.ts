import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.videowarehouse.app',
  appName: 'kinoTv',  version: '1.27.1',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      // 启动页兜底背景色（浅色）。真正的启动底图是预烘焙位图
      // res/drawable*/splash.png；androidScaleType CENTER_CROP + splashFullScreen
      // 让底图铺满全屏，故此值正常路径不可见，只在插件自身兜底层生效。
      // ✅ 2026-09-18 深色变体已落地：新增 res/drawable-night*/splash.png
      // （11 个变体 = drawable-night + land/port × 5 dpi；深底 #141414 与 Web 启动骨架
      //  / 暗色主题 --color-background 同值，蓝色 logo 原样保留）。
      //  Android 资源限定符按 UiMode 自动择图（xml/主题无需改动，
      //  AppTheme.NoActionBarLaunch 仍只引用 @drawable/splash）。
      //  ⚠️ 可复现性缺口（2026-09-18 核查）：这 11 张 night 位图**只存在于本地
      //  `android/app/src/main/res/`，仓库里没有任何源**（`android/` 被 gitignore；
      //  `scripts/android-res-patch/` 目前只放 values*/values-v31 三类 XML，
      //  浅色 splash 位图同样未入库）。即：换机器 / 重新 `cap add` 后会丢，
      //  下一轮 Android 构建不会自带深色启动图。要修就把两套位图都补进
      //  `scripts/android-res-patch/drawable*/`（构建脚本已整树拷贝）或加生成脚本。
      //  遗留观察（未改，属原生行为）：styles.xml 的 AppTheme.NoActionBarLaunch 未声明
      //  `postSplashScreenTheme`（androidx core-splashscreen 的推荐配置），
      //  Capacitor 模板历来如此、运行无异常，故不在本轮改动范围内。
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
  android: {    versionCode: 127010,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
