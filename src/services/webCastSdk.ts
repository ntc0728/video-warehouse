/**
 * Web Cast（Google Cast SDK）投屏集成 — 独立模块
 *
 * 与 castService.ts（轻量能力检测 + 原生 DLNA 桥封装）分离：
 * 本模块仅被投屏弹窗（CastSheet）懒加载时引用，避免把 Cast SDK 集成逻辑
 * 打进播放器主 chunk（按需加载打包，不一股脑全打包）。
 */

/** Web Cast（Google Cast SDK）会话设备信息 */
export interface WebCastDevice {
  id: string;
  name: string;
}

/** Cast SDK 官方脚本 */
const CAST_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';
/** 默认媒体接收器 App ID（Chromecast 内置接收器） */
const DEFAULT_RECEIVER_ID = 'CC1AD845';

let webCastInitPromise: Promise<boolean> | null = null;
let webCastContext: unknown = null;
let webCastPlayer: unknown = null;
let webCastController: unknown = null;

declare global {
  interface Window {
    /** Cast SDK 就绪回调（cast_sender.js 加载完成后由 SDK 调用） */
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

/**
 * 初始化 Cast SDK（幂等：已就绪/加载中复用同一 Promise）。
 * 返回 false 表示浏览器不支持或脚本加载失败。
 */
export function initWebCast(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const win = window as unknown as Record<string, unknown>;
  if ((win.cast as Record<string, unknown> | undefined)?.framework) return Promise.resolve(true);
  if (webCastInitPromise) return webCastInitPromise;
  webCastInitPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;
    const done = (ok: boolean) => {
      webCastInitPromise = null; // 失败不缓存，便于「重新选择」重试
      resolve(ok);
    };
    script.onerror = () => done(false);
    win.__onGCastApiAvailable = (available: boolean) => done(available === true);
    document.head.appendChild(script);
  });
  return webCastInitPromise;
}

/**
 * 发起 Web Cast 会话（弹出系统设备选择弹窗）。
 * 连接成功返回设备信息；用户取消/无设备/失败返回 null。
 */
export async function webCastRequestSession(): Promise<WebCastDevice | null> {
  const win = window as unknown as Record<string, unknown>;
  const cast = win.cast as Record<string, unknown> | undefined;
  const framework = cast?.framework as Record<string, unknown> | undefined;
  const CastContext = framework?.CastContext as
    | { getInstance?: () => { requestSession: () => Promise<unknown>; setOptions: (opts: unknown) => void } }
    | undefined;
  if (!CastContext?.getInstance) return null;
  const context = CastContext.getInstance();
  webCastContext = context;
  context.setOptions({ receiverApplicationId: DEFAULT_RECEIVER_ID });
  try {
    const session = (await context.requestSession()) as
      | { getCastDevice?: () => { id?: string; friendlyName?: string } }
      | undefined;
    const device = session?.getCastDevice?.();
    if (!device) return null;
    const RemotePlayer = framework?.RemotePlayer as (new () => unknown) | undefined;
    const RemotePlayerController = framework?.RemotePlayerController as
      | (new (player: unknown) => unknown) | undefined;
    if (RemotePlayer && RemotePlayerController) {
      webCastPlayer = new RemotePlayer();
      webCastController = new RemotePlayerController(webCastPlayer);
    }
    return { id: device.id ?? device.friendlyName ?? 'cast-device', name: device.friendlyName ?? '投屏设备' };
  } catch {
    return null; // 用户取消或系统弹窗失败
  }
}

/** 推送当前播放 URL 至 Cast 设备（电视侧独立解码播放） */
export async function webCastLoadMedia(url: string, title?: string): Promise<void> {
  const controller = webCastController as { load?: (req: unknown) => Promise<unknown> } | null;
  if (!controller?.load) return;
  const contentType = /\.m3u8/i.test(url)
    ? 'application/x-mpegURL'
    : /\.mpd/i.test(url)
      ? 'application/dash+xml'
      : 'video/mp4';
  const win = window as unknown as Record<string, unknown>;
  const chrome = win.chrome as Record<string, unknown> | undefined;
  const media = (chrome?.cast as Record<string, unknown> | undefined)?.media as
    | Record<string, unknown> | undefined;
  const MediaInfo = media?.MediaInfo as (new (url: string, type: string) => unknown) | undefined;
  let mediaInfo: unknown = { contentId: url, contentType };
  if (MediaInfo) {
    mediaInfo = new MediaInfo(url, contentType);
    if (title) {
      const metadata = new ((media?.GenericMediaMetadata as
        | (new () => unknown) | undefined) ?? class {})();
      (metadata as { title?: string }).title = title;
      (mediaInfo as { metadata?: unknown }).metadata = metadata;
    }
  }
  try {
    await controller.load({ mediaInfo, autoplay: true });
  } catch {
    // 媒体加载失败不阻断连接状态
  }
}

/** 播放/暂停切换（Web Cast 由 RemotePlayerController 统一切换） */
export async function webCastTogglePlay(): Promise<void> {
  const controller = webCastController as { playOrPause?: () => Promise<unknown> } | null;
  try {
    await controller?.playOrPause?.();
  } catch {
    // 静默
  }
}

/** 设置音量（0~1） */
export async function webCastSetVolume(volume: number): Promise<void> {
  const controller = webCastController as { setVolumeLevel?: (v: number) => unknown } | null;
  try {
    controller?.setVolumeLevel?.(volume);
  } catch {
    // 静默
  }
}

/** 结束 Web Cast 会话 */
export async function webCastEndSession(): Promise<void> {
  try {
    const context = webCastContext as { endCurrentSession?: (stopCasting: boolean) => unknown } | null;
    context?.endCurrentSession?.(true);
  } catch {
    // 静默
  }
  webCastContext = null;
  webCastPlayer = null;
  webCastController = null;
}