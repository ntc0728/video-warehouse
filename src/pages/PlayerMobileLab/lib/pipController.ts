/**
 * 画中画控制器 —— 专门修 iOS「竖屏点画中画页面卡死」
 *
 * ── 现有实现的 4 个致命坑（src/components/UniversalPlayer/hooks/usePlayerCore.ts:658）──
 *
 * 坑 1：无超时地 await loadedmetadata
 *   if (video.readyState === 0) {
 *     await new Promise(resolve => video.addEventListener('loadedmetadata', ...));
 *   }
 *   readyState 为 0 且元数据永远不来（源挂了 / 切源中 / 页面被冻结）时，
 *   这个 Promise **永不 settle** → togglePiP 永久挂起 → 后续所有 PiP 请求排队堵死 → 卡死。
 *
 * 坑 2：iOS 上 document.pictureInPictureEnabled 为 true，但 iPhone 不允许从
 *   「内联竖屏」直接进入 PiP。必须**先让视频处于全屏态**再切 presentation mode，
 *   否则 requestPictureInPicture() 静默 reject 或把页面拖进无响应状态。
 *
 * 坑 3：只监听 enterpictureinpicture / leavepictureinpicture，
 *   **完全没监听 webkitpresentationmodechanged**。用户在 iOS 系统 UI 里关掉 PiP 时，
 *   store 的 isPiP 永远是 true，按钮状态再也对不上，看起来就是「点了没反应」。
 *
 * 坑 4：catch 只 console.error，不提示用户。失败了 UI 毫无反馈。
 *
 * ── 本文件的修法 ──
 *   · 所有等待一律带超时（METADATA_TIMEOUT_MS），超时直接放弃并给出可读错误
 *   · 整个 PiP 请求包一层总超时（REQUEST_TIMEOUT_MS）
 *   · iOS iPhone 走「先进全屏 → 再切 picture-in-picture」的串行路径
 *   · 标准 API 与 Safari presentation mode 双通道，状态用两套事件共同同步
 *   · 失败一律返回 { ok: false, message }，由上层 toast
 */

import type { PipCapability } from './deviceCaps';

const METADATA_TIMEOUT_MS = 1500;
const REQUEST_TIMEOUT_MS = 3000;

type WebkitVideo = HTMLVideoElement & {
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;
  webkitPresentationMode?: 'inline' | 'picture-in-picture' | 'fullscreen';
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitEnterFullscreen?: () => void;
};

export interface PipResult {
  ok: boolean;
  /** 成功时：本次进入还是退出 */
  action?: 'enter' | 'exit';
  /** 走的哪条通道（用于 demo 展示策略命中情况） */
  channel?: 'standard' | 'webkit' | 'fullscreen-first';
  /** 失败原因（可直接 toast） */
  message?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label}超时`)), ms)),
  ]);
}

/** 等元数据就绪；带超时，绝不允许无限期挂起 */
async function waitMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return;
  await withTimeout(
    new Promise<void>((resolve) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        // 出错也放行：让后续的 requestPictureInPicture 自己抛出可读错误，
        // 比在这里永久挂起强得多
        resolve();
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    }),
    METADATA_TIMEOUT_MS,
    '等待视频元数据',
  );
}

/** Safari presentation mode 是否支持画中画（按元素实测，不靠 UA） */
export function supportsWebkitPip(video: HTMLVideoElement | null): boolean {
  const v = video as WebkitVideo | null;
  if (!v || typeof v.webkitSupportsPresentationMode !== 'function') return false;
  try {
    return v.webkitSupportsPresentationMode('picture-in-picture') === true;
  } catch {
    return false;
  }
}

export function isCurrentlyPip(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const v = video as WebkitVideo;
  if (v.webkitPresentationMode === 'picture-in-picture') return true;
  return document.pictureInPictureElement === video;
}

/**
 * 进入/退出画中画。
 *
 * @param video    视频元素
 * @param cap      探测到的画中画能力档位
 * @param forceFullscreenFirst  是否强制走「先进全屏再切 PiP」（iOS iPhone）
 */
export async function togglePip(
  video: HTMLVideoElement | null,
  cap: PipCapability,
  forceFullscreenFirst: boolean,
): Promise<PipResult> {
  if (!video) return { ok: false, message: '视频未就绪' };
  if (cap === 'unsupported') {
    return { ok: false, message: '当前环境不支持画中画，已隐藏入口' };
  }

  const v = video as WebkitVideo;

  // ── 退出 ──
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

  // ── 进入：外层总超时，杜绝任何形式的永久挂起 ──
  try {
    return await withTimeout(doEnterPip(video, cap, forceFullscreenFirst), REQUEST_TIMEOUT_MS, '画中画请求');
  } catch (e) {
    return { ok: false, message: (e as Error).message || '画中画请求失败' };
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
  // 未在播放时 iOS 有较大概率拒绝；这里是软提示，不阻断
  const notPlaying = video.paused;

  // ── 通道 A：iOS iPhone —— 先进全屏，再切 picture-in-picture ──
  if (forceFullscreenFirst && typeof v.webkitSetPresentationMode === 'function') {
    // webkitEnterFullscreen 会把视频交给系统播放器；紧接着切 picture-in-picture，
    // 系统就会把这一路画面搬到 PiP 小窗。这就是 iPhone 上唯一的可靠路径。
    v.webkitEnterFullscreen?.();
    await new Promise((r) => setTimeout(r, 120));
    try {
      v.webkitSetPresentationMode('picture-in-picture');
      return {
        ok: true,
        action: 'enter',
        channel: 'fullscreen-first',
        ...(notPlaying ? { message: '已进入画中画（视频当前暂停）' } : {}),
      };
    } catch (e) {
      return { ok: false, message: `iOS 画中画失败：${(e as Error).message}` };
    }
  }

  // ── 通道 B：Safari presentation mode（iPad / macOS Safari，无标准 API 时） ──
  if (cap === 'webkit-presentation' && typeof v.webkitSetPresentationMode === 'function') {
    v.webkitSetPresentationMode('picture-in-picture');
    return { ok: true, action: 'enter', channel: 'webkit' };
  }

  // ── 通道 C：标准 Picture-in-Picture API ──
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
    // iOS 上最常见的失败：必须在全屏中调用 / 用户手势丢失
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
 * 订阅画中画状态变化。
 * 两套事件都订阅：iOS 系统 UI 触发的进出只会走 webkitpresentationmodechanged。
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
