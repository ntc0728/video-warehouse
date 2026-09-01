/**
 * 画中画控制器 —— 修「竖屏点画中画页面卡死」（生产版，自 demo 收敛）
 *
 * 现有 usePlayerCore.togglePiP 的两个致命坑：
 *   1. 无超时地 await loadedmetadata → 元数据不来就永久挂起 → 后续 PiP 请求堵死 → 卡死。
 *   2. iOS iPhone 不允许从「内联竖屏」直接进入 PiP，必须先进全屏再切 presentation mode。
 *   3. 只订阅 enter/leavepictureinpicture，漏了 webkitpresentationmodechanged → 状态回不来。
 *
 * 本文件修法：
 *   · 等待元数据带 1.5s 超时，整个请求包 3s 总超时，永不无限挂起
 *   · iOS iPhone 走「先进全屏 → 再切 picture-in-picture」串行路径
 *   · 标准 API 与 Safari presentation mode 双通道，状态用两套事件共同同步
 *   · 失败返回可读 message，由上层 toast
 */
import type { PipCapability } from './deviceCaps';

const METADATA_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 4000;

type WebkitVideo = HTMLVideoElement & {
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;
  webkitPresentationMode?: 'inline' | 'picture-in-picture' | 'fullscreen';
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitEnterFullscreen?: () => void;
};

export interface PipResult {
  ok: boolean;
  action?: 'enter' | 'exit';
  channel?: 'standard' | 'webkit' | 'fullscreen-first';
  message?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label}超时`)), ms)),
  ]);
}

async function waitMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return;
  await withTimeout(
    new Promise<void>((resolve) => {
      const onLoaded = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); resolve(); };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    }),
    METADATA_TIMEOUT_MS,
    // 内部 label：超时后会由外层兜底翻译为「视频加载超时」给用户，不会直接外泄。
    'metadata',
  );
}

function detectPipCapability(): PipCapability {
  if (typeof document === 'undefined') return 'unsupported';
  const v = document.createElement('video') as HTMLVideoElement & {
    webkitSupportsPresentationMode?: (mode: string) => boolean;
  };
  const supportsWebkit = typeof v.webkitSupportsPresentationMode === 'function'
    ? v.webkitSupportsPresentationMode('picture-in-picture') === true
    : false;
  if (document.pictureInPictureEnabled === true) return 'standard';
  if (supportsWebkit) return 'webkit-presentation';
  return 'unsupported';
}

/** iOS iPhone 不允许从内联竖屏进 PiP，必须先进全屏 */
function pipRequiresFullscreenFirst(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iphone|ipod/i.test(ua) && detectPipCapability() !== 'unsupported';
}

export function isCurrentlyPip(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const v = video as WebkitVideo;
  if (v.webkitPresentationMode === 'picture-in-picture') return true;
  return document.pictureInPictureElement === video;
}

/**
 * 进入/退出画中画。
 * @param video 视频元素
 * @param opts.forceFullscreenFirst 强制「先进全屏再切 PiP」（iOS iPhone）
 */
export async function togglePip(
  video: HTMLVideoElement | null,
  opts?: { forceFullscreenFirst?: boolean },
): Promise<PipResult> {
  const cap = detectPipCapability();
  const forceFullscreenFirst = opts?.forceFullscreenFirst ?? pipRequiresFullscreenFirst();

  if (!video) return { ok: false, message: '视频未就绪' };
  if (cap === 'unsupported') {
    return { ok: false, message: '当前环境不支持画中画，已隐藏入口' };
  }

  const v = video as WebkitVideo;

  // 快速短路：媒体明确未加载且未在播放 → 不浪费 3s 等元数据，直接给可执行的提示
  // （CMS 源/代理慢、首帧没来时点 PiP 的常见场景）
  if (video.readyState === 0 && video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    return { ok: false, message: '视频源加载失败，请切换其他源' };
  }
  if (video.readyState === 0 && video.paused && !video.currentTime) {
    return { ok: false, message: '视频尚未加载，请先开始播放' };
  }

  // 退出
  if (isCurrentlyPip(video)) {
    try {
      if (v.webkitPresentationMode === 'picture-in-picture' && v.webkitSetPresentationMode) {
        v.webkitSetPresentationMode('inline');
        return { ok: true, action: 'exit', channel: 'webkit' };
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return { ok: true, action: 'exit', channel: 'standard' };
      }
    } catch (e) {
      return { ok: false, message: `退出画中画失败：${(e as Error).message}` };
    }
  }

  // 外层总超时，杜绝任何形式的永久挂起（这是「竖屏点 PiP 卡死」的根因）
  try {
    return await withTimeout(doEnterPip(video, cap, forceFullscreenFirst), REQUEST_TIMEOUT_MS, 'request');
  } catch (e) {
    // 兜底翻译：内部 timeout label（"metadata"/"request"）不直接外泄，统一为可读中文
    const msg = (e as Error).message || '';
    if (msg === 'metadata超时' || /metadata/.test(msg)) {
      return { ok: false, message: '视频加载超时，请稍后再试' };
    }
    if (msg === 'request超时' || /request/.test(msg)) {
      return { ok: false, message: '画中画请求超时，请重试' };
    }
    return { ok: false, message: msg || '画中画请求失败' };
  }
}

async function doEnterPip(
  video: HTMLVideoElement,
  cap: PipCapability,
  forceFullscreenFirst: boolean,
): Promise<PipResult> {
  const v = video as WebkitVideo;

  // iOS 系统会在 disablePictureInPicture=true 时直接拒绝，显式复位
  video.disablePictureInPicture = false;

  await waitMetadata(video);

  if (video.readyState === 0) {
    return { ok: false, message: '视频尚未加载，请稍后再试' };
  }

  // 通道 A：iOS iPhone —— 先进全屏，再切 picture-in-picture
  if (forceFullscreenFirst && typeof v.webkitSetPresentationMode === 'function') {
    v.webkitEnterFullscreen?.();
    await new Promise((r) => setTimeout(r, 120));
    try {
      v.webkitSetPresentationMode('picture-in-picture');
      return { ok: true, action: 'enter', channel: 'fullscreen-first' };
    } catch (e) {
      return { ok: false, message: `iOS 画中画失败：${(e as Error).message}` };
    }
  }

  // 通道 B：Safari presentation mode（iPad / macOS Safari）
  if (cap === 'webkit-presentation' && typeof v.webkitSetPresentationMode === 'function') {
    v.webkitSetPresentationMode('picture-in-picture');
    return { ok: true, action: 'enter', channel: 'webkit' };
  }

  // 通道 C：标准 Picture-in-Picture API
  if (!document.pictureInPictureEnabled) {
    return { ok: false, message: '浏览器未启用画中画' };
  }
  if (typeof video.requestPictureInPicture !== 'function') {
    return { ok: false, message: '浏览器不支持 requestPictureInPicture' };
  }
  try {
    await video.requestPictureInPicture();
    return { ok: true, action: 'enter', channel: 'standard' };
  } catch (e) {
    const err = e as Error & { name?: string };
    if (err.name === 'NotSupportedError') {
      return { ok: false, message: 'iPhone 需先全屏播放才能进入画中画' };
    }
    if (err.name === 'NotAllowedError') {
      return { ok: false, message: '画中画被拒绝：请直接点击按钮（勿在异步回调中触发）' };
    }
    return { ok: false, message: `画中画失败：${err.message}` };
  }
}

/**
 * 订阅画中画状态变化。两套事件都订阅：iOS 系统 UI 触发的进出只会走
 * webkitpresentationmodechanged。
 */
export function subscribePipChange(
  video: HTMLVideoElement | null,
  cb: (inPip: boolean) => void,
): () => void {
  if (!video) return () => {};
  const sync = () => cb(isCurrentlyPip(video));
  const onEnter = () => cb(true);
  const onLeave = () => cb(false);
  const onModeChange = () => sync();

  video.addEventListener('enterpictureinpicture', onEnter);
  video.addEventListener('leavepictureinpicture', onLeave);
  video.addEventListener('webkitpresentationmodechanged', onModeChange);

  return () => {
    video.removeEventListener('enterpictureinpicture', onEnter);
    video.removeEventListener('leavepictureinpicture', onLeave);
    video.removeEventListener('webkitpresentationmodechanged', onModeChange);
  };
}
