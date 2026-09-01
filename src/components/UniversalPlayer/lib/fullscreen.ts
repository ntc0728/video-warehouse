/**
 * 全屏策略控制器（生产版，自 demo 收敛）
 *
 * 行业通行做法（腾讯云点播 Web 播放器 / 西瓜播放器 xgplayer / DPlayer 一致）：
 *   全屏优先级 = 元素级 Fullscreen API > video.webkitEnterFullscreen > CSS 网页伪全屏
 *
 *   · fullscreen-api —— container.requestFullscreen()：全屏后自定义控制栏/弹窗/字幕全保留。
 *   · webkit-video  —— video.webkitEnterFullscreen()：系统原生播放器接管，HTML 覆盖层全丢。
 *   · css-pseudo    —— 容器 position:fixed; inset:0 铺满视口：地址栏还在，但自定义 UI 完整保留。
 *
 * ⚠️ iOS iPhone 上绝不能把「全屏」映射成 webkitEnterFullscreen，否则用户全屏后看到的是
 *    系统播放器，业务要求的自定义控制栏/抽屉/字幕渲染不出来。故 iPhone 默认走 CSS 伪全屏。
 *
 * 新增：可订阅的全屏状态管理器，合并「元素级 fullscreenchange / iOS webkitbegin-endfullscreen /
 * CSS 伪全屏」三种来源，让上层 UI（右上角操作组、右侧抽屉、桌面态控制栏）能可靠地感知全屏。
 */
import type { FullscreenCapability } from './deviceCaps';
import { detectDeviceCaps } from './deviceCaps';

/**
 * 开发/冒烟测试逃生口：在 dev 环境且 URL 带 `__smoke_fullscreen=1` 时，
 * 忽略 hasError 以允许全屏进入，方便在无有效视频源时验证全屏 UI。
 * 生产构建中 import.meta.env.DEV 为 false，不会生效。
 */
function isSmokeFullscreen(): boolean {
  return (
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('__smoke_fullscreen')
  );
}

export type FullscreenMode = 'none' | 'element' | 'css-pseudo' | 'ios-video';

/* ───────── 能力（模块级只探测一次）───────── */
const CAPS = detectDeviceCaps();

export function getFullscreenStrategy(): FullscreenCapability {
  return CAPS.fullscreenStrategy;
}

/* ───────── 可订阅状态管理器 ───────── */
let currentMode: FullscreenMode = 'none';
const listeners = new Set<(isFs: boolean, mode: FullscreenMode) => void>();

function emit() {
  const isFs = currentMode !== 'none';
  listeners.forEach((l) => l(isFs, currentMode));
}

export function subscribeFullscreen(
  cb: (isFs: boolean, mode: FullscreenMode) => void,
): () => void {
  listeners.add(cb);
  cb(currentMode !== 'none', currentMode);
  return () => { listeners.delete(cb); };
}

function setMode(mode: FullscreenMode) {
  currentMode = mode;
  emit();
}

export function getFullscreenMode(): FullscreenMode {
  return currentMode;
}

export function isFullscreenActive(): boolean {
  return currentMode !== 'none';
}

/* ───────── 底层 API ───────── */
export function getFullscreenElement(): Element | null {
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return document.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement || null;
}

/** 元素级全屏 */
export async function requestElementFullscreen(el: HTMLElement): Promise<boolean> {
  const target = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
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
    /* 用户手势丢失 / 权限被拒 → 交给上层降级 */
  }
  return false;
}

/** video 级全屏（iOS 系统播放器 / X5 原生播放器） */
export function requestVideoFullscreen(video?: HTMLVideoElement | null): boolean {
  const v = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
  if (v?.webkitEnterFullscreen) {
    v.webkitEnterFullscreen();
    return true;
  }
  return false;
}

/** CSS 网页伪全屏：容器 fixed 铺满视口，自定义 UI 完整保留 */
export function requestCssPseudoFullscreen(el: HTMLElement): void {
  el.classList.add('up-fs-css-pseudo');
  setMode('css-pseudo');
}

export function exitCssPseudoFullscreen(el: HTMLElement | null): void {
  el?.classList.remove('up-fs-css-pseudo');
  if (currentMode === 'css-pseudo') setMode('none');
}

export async function exitFullscreen(video?: HTMLVideoElement | null): Promise<void> {
  const d = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  const v = video as (HTMLVideoElement & { webkitExitFullscreen?: () => void }) | null;

  if (currentMode === 'css-pseudo') {
    exitCssPseudoFullscreen(video?.closest<HTMLElement>('.up-universal-player') ?? null);
    unlockOrientation();
    return;
  }
  if (currentMode === 'ios-video') {
    v?.webkitExitFullscreen?.();
    unlockOrientation();
    return;
  }
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    else if (d.msExitFullscreen) await d.msExitFullscreen();
  } catch {
    /* 无全屏时调用会 reject */
  }
  unlockOrientation();
}

/** 屏幕方向锁定（仅真·全屏下浏览器允许，伪全屏/非全屏会 reject → 静默） */
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

/* ───────── 统一入口（FullscreenButton / F 键 / 双击 共用）───────── */
export async function toggleFullscreen(
  container: HTMLElement | null | undefined,
  videoElement?: HTMLVideoElement | null,
  hasError?: boolean,
): Promise<void> {
  if (hasError && !isSmokeFullscreen()) return;
  if (!container) return;

  // 已进入任意全屏 → 退出
  if (currentMode !== 'none') {
    await exitFullscreen(videoElement);
    return;
  }

  const mode: FullscreenCapability = getFullscreenStrategy();

  if (mode === 'fullscreen-api') {
    const ok = await requestElementFullscreen(container);
    if (ok) {
      setMode('element');
      await lockLandscape();
      return;
    }
    // 降级 CSS 伪全屏
    requestCssPseudoFullscreen(container);
    await lockLandscape();
    return;
  }

  if (mode === 'webkit-video') {
    const ok = requestVideoFullscreen(videoElement);
    if (ok) {
      setMode('ios-video');
      await lockLandscape();
      return;
    }
    requestCssPseudoFullscreen(container);
    await lockLandscape();
    return;
  }

  // css-pseudo（含 iOS iPhone 默认档）
  requestCssPseudoFullscreen(container);
  await lockLandscape();
}

/* ───────── 事件订阅：让管理器感知「非本函数发起」的退出 ───────── */
if (typeof document !== 'undefined') {
  const syncElement = () => {
    if (currentMode === 'element' && !getFullscreenElement()) setMode('none');
  };
  document.addEventListener('fullscreenchange', syncElement);
  document.addEventListener('webkitfullscreenchange', syncElement);
  document.addEventListener('msfullscreenchange', syncElement);

  const onBegin = () => { if (currentMode !== 'ios-video') setMode('ios-video'); };
  const onEnd = () => { if (currentMode === 'ios-video') setMode('none'); };
  document.addEventListener('webkitbeginfullscreen', onBegin as EventListener);
  document.addEventListener('webkitendfullscreen', onEnd as EventListener);
}

export type { FullscreenCapability };

/** 向后兼容：旧调用方（IPTVPlayer 等）使用的元素级全屏入口别名 */
export const requestFullscreen = requestElementFullscreen;
