/**
 * 全屏策略控制器
 *
 * 行业通行做法（腾讯云点播 Web 播放器 / 西瓜播放器 xgplayer / DPlayer 一致）：
 *   全屏优先级 = 元素级 Fullscreen API > video.webkitEnterFullscreen > CSS 网页伪全屏
 *
 * 三档的取舍：
 *
 *   1. fullscreen-api —— container.requestFullscreen()
 *      全屏后 DOM/CSS 构成的播放器界面完整保留，自定义控制栏、弹窗、字幕全部可用。
 *      适用：Android Chrome / iPad Safari / 桌面现代浏览器 / Capacitor WebView。
 *
 *   2. webkit-video —— video.webkitEnterFullscreen()
 *      **只能作用于 video 标签本身**，全屏后播放器界面变成系统原生界面，
 *      页面上所有 HTML 覆盖层（控制栏/弹窗/字幕）通通不可见。
 *      适用：iPhone 上「愿意放弃自定义控制栏」的场景；Android X5 内核的唯一全屏路径。
 *
 *   3. css-pseudo —— 给容器加 position:fixed; inset:0 撑满视口
 *      又称「网页全屏 / 伪全屏」，浏览器地址栏还在，但**自定义 UI 完整保留**。
 *      是 iOS iPhone 上唯一能保住自定义控制栏的方案，
 *      KinoTV / LibreTV / MoonTV 这类 Web 影视站走的就是这条路。
 *
 * ⚠️ 关键：iOS 上绝不能把「全屏」直接映射到 webkitEnterFullscreen，
 *    否则用户全屏后会看到 iOS 系统播放器——而业务要求全屏时控制栏可交互，
 *    那套 UI 在系统播放器里根本渲染不出来。
 */

import type { FullscreenCapability } from './deviceCaps';

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void> | void;
};

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

export function getFullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement || null;
}

/** 元素级全屏 */
export async function requestElementFullscreen(el: HTMLElement): Promise<boolean> {
  const target = el as FsElement;
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
      return true;
    }
    if (target.msRequestFullscreen) {
      await target.msRequestFullscreen();
      return true;
    }
  } catch {
    // 用户手势丢失 / 权限被拒 → 交给上层降级
  }
  return false;
}

/** video 级全屏（iOS 系统播放器 / X5 原生播放器） */
export function requestVideoFullscreen(video: HTMLVideoElement | null): boolean {
  const v = video as WebkitVideo | null;
  if (v?.webkitEnterFullscreen) {
    v.webkitEnterFullscreen();
    return true;
  }
  return false;
}

export async function exitFullscreen(video?: HTMLVideoElement | null): Promise<void> {
  const d = document as FsDocument;
  const v = video as WebkitVideo | null;
  // iOS video 全屏必须先走 webkitExitFullscreen，document.exitFullscreen 管不到它
  if (v?.webkitExitFullscreen && !(d.fullscreenElement || d.webkitFullscreenElement)) {
    v.webkitExitFullscreen();
    return;
  }
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    else if (d.msExitFullscreen) await d.msExitFullscreen();
  } catch {
    /* 忽略：无全屏时调用会 reject */
  }
}

/**
 * 屏幕方向锁定。
 * 只在「真·全屏」下才被浏览器允许（Android Chrome），伪全屏/非全屏会 reject —— 一律静默吞掉。
 */
export async function lockLandscape(): Promise<boolean> {
  try {
    const o = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    if (!o?.lock) return false;
    await o.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

/**
 * 订阅全屏状态变化。
 * 事件源要全量覆盖，否则 iOS / 老 WebKit 上会漏：
 *   - fullscreenchange        标准
 *   - webkitfullscreenchange  老 WebKit / Safari
 *   - webkitbeginfullscreen   iOS video 进入全屏（**元素级全屏不会触发**）
 *   - webkitendfullscreen     iOS video 退出全屏
 */
export function subscribeFullscreenChange(cb: (isFs: boolean) => void): () => void {
  const emit = () => cb(Boolean(getFullscreenElement()));
  const onBegin = () => cb(true);
  const onEnd = () => cb(false);

  document.addEventListener('fullscreenchange', emit);
  document.addEventListener('webkitfullscreenchange', emit);
  document.addEventListener('webkitbeginfullscreen', onBegin);
  document.addEventListener('webkitendfullscreen', onEnd);
  return () => {
    document.removeEventListener('fullscreenchange', emit);
    document.removeEventListener('webkitfullscreenchange', emit);
    document.removeEventListener('webkitbeginfullscreen', onBegin);
    document.removeEventListener('webkitendfullscreen', onEnd);
  };
}

/** video 元素是否正处于 iOS 系统全屏（无任何 DOM 标志，只能靠事件记账） */
export function createIOSVideoFullscreenTracker(video: HTMLVideoElement | null) {
  let active = false;
  const v = video as WebkitVideo | null;
  if (!v) return { get: () => false, dispose: () => {} };
  const onBegin = () => { active = true; };
  const onEnd = () => { active = false; };
  v.addEventListener('webkitbeginfullscreen', onBegin);
  v.addEventListener('webkitendfullscreen', onEnd);
  return {
    get: () => active,
    dispose: () => {
      v.removeEventListener('webkitbeginfullscreen', onBegin);
      v.removeEventListener('webkitendfullscreen', onEnd);
    },
  };
}

export type { FullscreenCapability };
