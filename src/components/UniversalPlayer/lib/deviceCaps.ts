/**
 * 播放器「能力探测」——全屏 / 画中画 / 内核兼容性（生产版，自 demo 收敛）
 *
 * 同一个播放器要跑在 5 类完全不同的环境里，它们对 <video> 的全屏与画中画支持毫无一致性：
 *   1. 安卓 App（Capacitor WebView）   —— Chromium，Fullscreen API + 标准 PiP 可用
 *   2. 安卓 Web（Chrome / 三星 / 小米 / 华为 / OPPO / vivo 浏览器）
 *   3. iOS Web（Safari / 微信 / QQ）    —— **不支持** Element.requestFullscreen
 *   4. PC Web（Chrome / Edge）          —— 全能力
 *   5. PC 调试安卓（DevTools 设备模拟） —— UA 是安卓，宿主是桌面 Chrome，能力按桌面算
 *
 * 「能不能全屏」「能不能画中画」「全屏后还有没有自定义控制栏」必须运行时探测，
 * 不能靠 UA 猜，也不能靠屏幕宽度猜。
 */

/** 全屏能力档位（优先级从高到低） */
export type FullscreenCapability =
  /** 元素级 Fullscreen API：全屏后 DOM/CSS 控制栏完整保留 */
  | 'fullscreen-api'
  /** video.webkitEnterFullscreen()：系统原生播放器接管，自定义控制栏全部丢失 */
  | 'webkit-video'
  /** CSS 网页伪全屏：Fixed 铺满视口，控制栏完整保留，但浏览器地址栏还在 */
  | 'css-pseudo';

/** 画中画能力档位 */
export type PipCapability =
  | 'standard'
  | 'webkit-presentation'
  | 'unsupported';

/** App 内置 WebView 类型（会劫持 video 播放的内核） */
export type WebViewKind =
  | 'browser'
  | 'wechat'
  | 'qq'
  | 'weibo'
  | 'uc'
  | 'douyin'
  | 'other-app';

export interface DeviceCaps {
  ua: string;
  isIOS: boolean;
  isIOSPhone: boolean;
  isIPad: boolean;
  isAndroid: boolean;
  isCapacitor: boolean;
  nativePlatform: 'android' | 'ios' | 'web';
  webView: WebViewKind;
  isX5: boolean;
  isInAppWebView: boolean;
  supportsElementFullscreen: boolean;
  supportsVideoWebkitFullscreen: boolean;
  pip: PipCapability;
  supportsWebkitPresentationMode: boolean;
  supportsOrientationLock: boolean;
  fullscreenStrategy: FullscreenCapability;
  keepsCustomControlsInFullscreen: boolean;
  pipRequiresFullscreenFirst: boolean;
  needsX5SameLayerAttrs: boolean;
  summary: string;
  caveats: string[];
}

function detectWebView(ua: string): WebViewKind {
  if (/micromessenger/i.test(ua)) return 'wechat';
  if (/mqqbrowser|qqbrowser|\bqq\//i.test(ua)) return 'qq';
  if (/weibo/i.test(ua)) return 'weibo';
  if (/ucbrowser|quark|ubrowser/i.test(ua)) return 'uc';
  if (/aweme|douyin|musical_ly/i.test(ua)) return 'douyin';
  if (/; wv\)|version\/4\.0.*mobile.*safari/i.test(ua)) return 'other-app';
  return 'browser';
}

function isCapacitorRuntime(): boolean {
  try {
    return !!(window as unknown as Record<string, unknown>).Capacitor;
  } catch {
    return false;
  }
}

function getNativePlatform(): 'android' | 'ios' | 'web' {
  if (!isCapacitorRuntime()) return 'web';
  try {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const p = cap?.getPlatform?.() ?? 'web';
    return p === 'android' ? 'android' : p === 'ios' ? 'ios' : 'web';
  } catch {
    return 'web';
  }
}

function detectElementFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => unknown;
    msRequestFullscreen?: () => unknown;
  };
  return (
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function' ||
    typeof el.msRequestFullscreen === 'function'
  );
}

function detectVideoWebkitFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video') as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitSupportsFullscreen?: boolean;
  };
  return typeof v.webkitEnterFullscreen === 'function' || v.webkitSupportsFullscreen === true;
}

function detectWebkitPresentationMode(): boolean {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video') as HTMLVideoElement & {
    webkitSupportsPresentationMode?: (mode: string) => boolean;
  };
  if (typeof v.webkitSupportsPresentationMode !== 'function') return false;
  try {
    return v.webkitSupportsPresentationMode('picture-in-picture') === true;
  } catch {
    return false;
  }
}

function detectStandardPip(): boolean {
  if (typeof document === 'undefined') return false;
  return document.pictureInPictureEnabled === true;
}

export function detectDeviceCaps(): DeviceCaps {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;

  const isIPad = /ipad/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const isIOS = /iphone|ipod|ipad/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const isIOSPhone = /iphone|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  const isCapacitor = isCapacitorRuntime();
  const nativePlatform = getNativePlatform();
  const webView = detectWebView(ua);
  const isX5 = (webView === 'wechat' || webView === 'qq') && isAndroid;
  const isInAppWebView = webView !== 'browser';

  const supportsElementFullscreen = detectElementFullscreen();
  const supportsVideoWebkitFullscreen = detectVideoWebkitFullscreen();
  const supportsWebkitPresentationMode = detectWebkitPresentationMode();
  const supportsStandardPip = detectStandardPip();

  const pip: PipCapability = supportsStandardPip
    ? 'standard'
    : supportsWebkitPresentationMode
      ? 'webkit-presentation'
      : 'unsupported';

  const orientation = typeof screen !== 'undefined' ? screen.orientation : undefined;
  const supportsOrientationLock =
    !!orientation && typeof (orientation as ScreenOrientation & { lock?: unknown }).lock === 'function';

  let fullscreenStrategy: FullscreenCapability;
  if (supportsElementFullscreen) {
    fullscreenStrategy = 'fullscreen-api';
  } else if (isIOS) {
    // iOS iPhone 不支持元素级全屏，全屏后想保住自定义控制栏只能走 CSS 伪全屏。
    fullscreenStrategy = 'css-pseudo';
  } else if (supportsVideoWebkitFullscreen) {
    fullscreenStrategy = 'webkit-video';
  } else {
    fullscreenStrategy = 'css-pseudo';
  }

  const keepsCustomControlsInFullscreen = fullscreenStrategy !== 'webkit-video';
  const pipRequiresFullscreenFirst = isIOSPhone && pip !== 'unsupported';
  const needsX5SameLayerAttrs = isX5;

  const caveats: string[] = [];
  if (isIOSPhone) {
    caveats.push('iPhone Safari 不支持 Element.requestFullscreen，普通 DOM 元素无法全屏。');
    caveats.push('webkitEnterFullscreen 会被 iOS 系统播放器接管，自定义控制栏全部不可见。');
    caveats.push('画中画必须从「正在全屏的视频」发起，竖屏内联直接调用会静默失败甚至卡住 UI。');
  }
  if (isIPad && !isIOSPhone) {
    caveats.push('iPad Safari 支持元素级 Fullscreen API，可保留自定义控制栏。');
  }
  if (isX5) {
    caveats.push('X5 内核会劫持 <video> 全屏播放并插入自家 UI，需加 x5-video-player-type="h5-page" 走同层播放。');
  }
  if (isInAppWebView && !isX5) {
    caveats.push('App 内置 WebView 可能劫持视频播放，playsinline 不一定生效。');
  }
  if (isCapacitor && nativePlatform === 'android') {
    caveats.push('Capacitor Android WebView 需确认 allowsInlineMediaPlayback / 硬件加速已开启。');
  }
  if (!supportsOrientationLock) {
    caveats.push('不支持 Screen Orientation Lock，横屏需依赖用户手动旋转设备。');
  }
  if (pip === 'unsupported') {
    caveats.push('当前环境不支持画中画，应隐藏画中画入口而不是点了没反应。');
  }

  const summary = buildSummary({
    isIOSPhone, isIPad, isAndroid, isCapacitor, nativePlatform, webView,
    fullscreenStrategy, pip, keepsCustomControlsInFullscreen,
  });

  return {
    ua,
    isIOS,
    isIOSPhone,
    isIPad,
    isAndroid,
    isCapacitor,
    nativePlatform,
    webView,
    isX5,
    isInAppWebView,
    supportsElementFullscreen,
    supportsVideoWebkitFullscreen,
    pip,
    supportsWebkitPresentationMode,
    supportsOrientationLock,
    fullscreenStrategy,
    keepsCustomControlsInFullscreen,
    pipRequiresFullscreenFirst,
    needsX5SameLayerAttrs,
    summary,
    caveats,
  };
}

function buildSummary(c: {
  isIOSPhone: boolean; isIPad: boolean; isAndroid: boolean; isCapacitor: boolean;
  nativePlatform: 'android' | 'ios' | 'web';
  webView: WebViewKind;
  fullscreenStrategy: FullscreenCapability; pip: PipCapability;
  keepsCustomControlsInFullscreen: boolean;
}): string {
  const env = c.isCapacitor
    ? `Capacitor App（${c.nativePlatform}）`
    : c.isIOSPhone ? 'iOS iPhone Web'
      : c.isIPad ? 'iPad Web'
        : c.isAndroid ? `Android Web（${c.webView}）`
          : 'PC Web';
  const fs = c.fullscreenStrategy === 'fullscreen-api'
    ? '元素级 Fullscreen API'
    : c.fullscreenStrategy === 'webkit-video' ? 'video.webkitEnterFullscreen（系统原生 UI）'
      : 'CSS 网页伪全屏';
  const keep = c.keepsCustomControlsInFullscreen ? '控制栏可用' : '自定义控制栏丢失';
  const pipText = c.pip === 'standard' ? '标准 PiP' : c.pip === 'webkit-presentation' ? 'Safari Presentation Mode' : '不支持 PiP';
  return `${env}：全屏走 ${fs}（${keep}），画中画 ${pipText}。`;
}

/**
 * 给 <video> 打的兼容属性集。
 * 注意：iOS Safari 只认**首帧渲染时就存在**的属性，运行时 setAttribute 补
 * webkit-playsinline 无效，所以必须由 JSX 静态写出。
 */
export function getVideoCompatAttrs(caps: DeviceCaps): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    playsInline: true,
    'webkit-playsinline': 'true',
    'x-webkit-airplay': 'allow',
  };
  if (caps.needsX5SameLayerAttrs) {
    attrs['x5-video-player-type'] = 'h5-page';
    attrs['x5-video-player-fullscreen'] = 'true';
    attrs['x5-playsinline'] = 'true';
  }
  return attrs;
}

/** 当前横竖屏 */
export function isLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  return w > h;
}
