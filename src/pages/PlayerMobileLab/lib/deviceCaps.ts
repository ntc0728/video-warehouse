/**
 * 移动端播放器「能力探测」——全屏 / 画中画 / 内核兼容性
 *
 * 背景：同一个 /play 页要跑在 5 类完全不同的环境里，而它们对
 * <video> 的全屏与画中画支持毫无一致性：
 *
 *   1. 安卓 App（Capacitor WebView）   —— Chromium，Fullscreen API + 标准 PiP 可用
 *   2. 安卓 Web（Chrome / 三星 / 小米 / 华为 / OPPO / vivo 浏览器）
 *                                      —— 多为 Chromium，个别 OEM 内核会劫持 video
 *   3. iOS Web（Safari / 微信 / QQ）    —— **不支持** Element.requestFullscreen
 *   4. PC Web（Chrome / Edge）          —— 全能力
 *   5. PC 调试安卓（DevTools 设备模拟） —— UA 是安卓，宿主是桌面 Chrome，能力按桌面算
 *
 * 所以「能不能全屏」「能不能画中画」「全屏后还有没有自定义控制栏」，
 * 必须运行时探测，不能靠 UA 猜，也不能靠屏幕宽度猜。
 *
 * 能力矩阵（来源：腾讯云点播 Web 播放器全屏文档 / 西瓜播放器 xgplayer 移动端文档 /
 * MDN Fullscreen API & Picture-in-Picture 兼容性数据）：
 *
 * ┌──────────────────────────┬──────────────┬──────────────┬────────────────────────┐
 * │ 环境                      │ Fullscreen   │ webkitEnter  │ 全屏后控制栏            │
 * │                          │ API(元素级)   │ Fullscreen   │                        │
 * ├──────────────────────────┼──────────────┼──────────────┼────────────────────────┤
 * │ Android Chrome           │ ✅           │ ✅           │ 保留自定义 UI           │
 * │ Android X5（微信/QQ）     │ ❌           │ ✅           │ X5 原生（可同层保 DOM） │
 * │ iOS iPhone Safari/微信    │ ❌           │ ✅           │ ❌ 变 iOS 系统原生 UI   │
 * │ iOS iPad Safari          │ ✅           │ ✅           │ 保留自定义 UI           │
 * │ 桌面现代浏览器            │ ✅           │ ❌           │ 保留自定义 UI           │
 * │ 桌面微信内置浏览器        │ ❌           │ ❌           │ 只能网页伪全屏(CSS)     │
 * └──────────────────────────┴──────────────┴──────────────┴────────────────────────┘
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
  /** 标准 requestPictureInPicture() */
  | 'standard'
  /** Safari 专属 webkitSetPresentationMode('picture-in-picture') */
  | 'webkit-presentation'
  | 'unsupported';

/** App 内置 WebView 类型（会劫持 video 播放的内核） */
export type WebViewKind =
  | 'browser'      // 独立浏览器（Chrome / Safari / 三星 / 小米…）
  | 'wechat'       // 微信（Android=X5 内核）
  | 'qq'           // 手机 QQ / QQ 浏览器（X5 内核）
  | 'weibo'
  | 'uc'           // UC 浏览器 / 夸克（U4 内核）
  | 'douyin'
  | 'other-app';

export interface DeviceCaps {
  // ── 设备/系统 ──
  ua: string;
  isIOS: boolean;
  /** iPhone / iPod（不含 iPad）——iOS 全限制最苛刻的一档 */
  isIOSPhone: boolean;
  /** iPad（含 iPadOS 13+ 伪装成 MacIntel 的桌面模式） */
  isIPad: boolean;
  isAndroid: boolean;
  isCapacitor: boolean;
  nativePlatform: 'android' | 'ios' | 'web';

  // ── 内核 / 容器 ──
  webView: WebViewKind;
  /** X5 内核（腾讯 TBS：微信 / 手机QQ / QQ浏览器，仅 Android） */
  isX5: boolean;
  /** 任意 App 内置 WebView（非独立浏览器） */
  isInAppWebView: boolean;

  // ── 能力 ──
  /** 元素级 Fullscreen API 是否可用 */
  supportsElementFullscreen: boolean;
  /** video.webkitEnterFullscreen 是否可用 */
  supportsVideoWebkitFullscreen: boolean;
  /** 画中画能力档位 */
  pip: PipCapability;
  /** Safari presentation mode 是否支持 picture-in-picture */
  supportsWebkitPresentationMode: boolean;
  /** 是否支持 Screen Orientation API */
  supportsOrientationLock: boolean;

  // ── 策略结论 ──
  /** 推荐全屏档位 */
  fullscreenStrategy: FullscreenCapability;
  /** 全屏后能否保住自定义控制栏 */
  keepsCustomControlsInFullscreen: boolean;
  /** 画中画是否需要「先进全屏再切 PiP」（iOS iPhone 的坑） */
  pipRequiresFullscreenFirst: boolean;
  /** 是否需要给 video 打 X5 同层播放属性 */
  needsX5SameLayerAttrs: boolean;
  /** 一句话结论 */
  summary: string;
  /** 需要额外注意的点 */
  caveats: string[];
}

function detectWebView(ua: string): WebViewKind {
  if (/micromessenger/i.test(ua)) return 'wechat';
  if (/mqqbrowser|qqbrowser|\bqq\//i.test(ua)) return 'qq';
  if (/weibo/i.test(ua)) return 'weibo';
  if (/ucbrowser|quark|ubrowser/i.test(ua)) return 'uc';
  if (/aweme|douyin|musical_ly/i.test(ua)) return 'douyin';
  // Android WebView 典型特征：UA 里有 "; wv)" 或 Version/4.0
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

/** 探测元素级 Fullscreen API（含各前缀） */
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

/** 探测 video 级 webkitEnterFullscreen */
function detectVideoWebkitFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video') as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitSupportsFullscreen?: boolean;
  };
  return typeof v.webkitEnterFullscreen === 'function' || v.webkitSupportsFullscreen === true;
}

/** 探测 Safari presentation mode 是否支持画中画 */
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

  // iPadOS 13+ 在 UA 里伪装成 Macintosh，靠 platform=MacIntel + 多点触控识破
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

  // ScreenOrientation.lock 尚未进入标准 lib.dom 类型，需显式放宽
  const orientation = typeof screen !== 'undefined' ? screen.orientation : undefined;
  const supportsOrientationLock =
    !!orientation && typeof (orientation as ScreenOrientation & { lock?: unknown }).lock === 'function';

  // ── 全屏策略判定 ──
  // 核心取舍：全屏后还想不想要自定义控制栏？
  //   · 想要 → 必须避开 webkitEnterFullscreen（iOS 系统播放器会吞掉一切 DOM 覆盖层）
  //   · 不想要 / 无法避免 → 退回 webkitEnterFullscreen，接受系统原生 UI
  let fullscreenStrategy: FullscreenCapability;
  if (supportsElementFullscreen) {
    fullscreenStrategy = 'fullscreen-api';
  } else if (isIOS) {
    // iOS iPhone 不支持元素级全屏，只有两条路：
    //   a) webkitEnterFullscreen → 系统原生播放器（控制栏、倍速、字幕、投屏全丢）
    //   b) CSS 伪全屏          → 保留全部自定义 UI（这是 KinoTV / LibreTV / MoonTV 的做法）
    // 业务要求「全屏时控制栏可调 UI」，故默认选 b。
    fullscreenStrategy = 'css-pseudo';
  } else if (supportsVideoWebkitFullscreen) {
    fullscreenStrategy = 'webkit-video';
  } else {
    fullscreenStrategy = 'css-pseudo';
  }

  const keepsCustomControlsInFullscreen = fullscreenStrategy !== 'webkit-video';

  // iOS iPhone：PiP 只能从「正在全屏的视频」发起，内联竖屏直接调会静默失败/卡住
  const pipRequiresFullscreenFirst = isIOSPhone && pip !== 'unsupported';

  // X5 内核默认劫持 <video> 弹出自家全屏播放器，需靠同层属性把 DOM 覆盖层保住
  const needsX5SameLayerAttrs = isX5;

  const caveats: string[] = [];
  if (isIOSPhone) {
    caveats.push('iPhone Safari 不支持 Element.requestFullscreen，普通 DOM 元素无法全屏。');
    caveats.push('webPlayer 走 webkitEnterFullscreen 会被 iOS 系统播放器接管，自定义控制栏全部不可见。');
    caveats.push('画中画必须从「正在全屏的视频」发起，竖屏内联直接调用会静默失败甚至卡住 UI。');
  }
  if (isIPad && !isIOSPhone) {
    caveats.push('iPad Safari 支持元素级 Fullscreen API，可保留自定义控制栏。');
  }
  if (isX5) {
    caveats.push('X5 内核会劫持 <video> 全屏播放并插入自家 UI，需加 x5-video-player-type="h5-page" 走同层播放。');
    caveats.push('同层播放会触发视口 resize，需监听 resize 重算视频尺寸。');
  }
  if (isInAppWebView && !isX5) {
    caveats.push('App 内置 WebView 可能劫持视频播放，playsinline 不一定生效。');
  }
  if (isCapacitor && nativePlatform === 'android') {
    caveats.push('Capacitor Android WebView 需在原生侧确认 allowsInlineMediaPlayback / 硬件加速已开启。');
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
    // X5 同层播放：让 video 不再被劫持弹全屏，HTML 覆盖层可以压在视频上
    attrs['x5-video-player-type'] = 'h5-page';
    attrs['x5-video-player-fullscreen'] = 'true';
    attrs['x5-playsinline'] = 'true';
  }
  return attrs;
}

/** 当前横竖屏 */
export function isLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  // 优先用视觉视口，避免 iOS 地址栏伸缩导致误判
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  return w > h;
}
