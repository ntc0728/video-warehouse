/**
 * 投屏（DLNA）服务 — UI + 状态机层
 *
 * 当前阶段仅提供「设备发现接口契约 + 状态机类型」：
 * - 原生 DLNA 模块（SSDP 设备发现 + SetAVTransportURI/Play/Pause/Seek 推送）后续作为
 *   独立任务接入，届时在 Android 端注入 `window.CastBridge` 实现即可无缝对接；
 * - Web / 未注入桥时 `discoverCastDevices()` 返回空数组 → 投屏弹窗展示「未发现设备」空态。
 *
 * E2E 测试可通过 `page.addInitScript` 注入 mock `window.CastBridge` 走完整流程。
 */

export interface CastDevice {
  /** 设备唯一 ID（如 SSDP USN） */
  id: string;
  /** 设备显示名（如「客厅电视」） */
  name: string;
  /** 设备地址（IP:PORT，可选） */
  address?: string;
}

/** 投屏连接状态机 */
export type CastConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** 投屏能力模式：原生桥（App 内 DLNA） / Web Cast SDK（Chromecast·Google TV） / 无 */
export type CastMode = 'native' | 'web' | 'none';

/** 原生桥接口（由 Android 原生模块实现并注入 window.CastBridge） */
export interface CastBridge {
  /** 发现局域网内 DLNA 设备（SSDP M-SEARCH） */
  discover: () => Promise<CastDevice[]>;
  /** 建立与设备的连接 */
  connect: (deviceId: string) => Promise<void>;
  /** 断开连接 */
  disconnect: () => Promise<void>;
  /** 推送当前播放 URL 至设备（SetAVTransportURI） */
  setSource?: (url: string, title?: string) => Promise<void>;
  play?: () => Promise<void>;
  pause?: () => Promise<void>;
  seek?: (time: number) => Promise<void>;
  setVolume?: (volume: number) => Promise<void>;
}

/** Web Cast（Google Cast SDK）会话设备信息 */
export interface WebCastDevice {
  id: string;
  name: string;
}

declare global {
  interface Window {
    /** 原生投屏桥（Android 原生模块注入；Web 端不存在） */
    CastBridge?: CastBridge;
    /** Cast SDK 就绪回调（cast_sender.js 加载完成后由 SDK 调用） */
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

/** 获取原生投屏桥；未注入时返回 null（Web 端） */
export function getCastBridge(): CastBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.CastBridge;
  return bridge && typeof bridge.discover === 'function' ? bridge : null;
}

/**
 * 判断 Web Cast SDK 是否可用。
 * Google Cast Web SDK 仅支持 Chromium 内核（Chrome/Edge）桌面与安卓，iOS Safari/WebKit 一律不支持；
 * 同一规则决定「iOS Web 端隐藏投屏按钮」。
 */
export function isWebCastSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return false; // iOS WebKit 不支持 Cast SDK
  return /Chrome|Chromium|Edg\//i.test(ua);
}

/**
 * 当前投屏能力模式（优先级：原生桥 > Web Cast SDK > 无）。
 * 原生桥仅存在于 Android App（window.CastBridge），Web 端先查是否 Chromium 内核。
 */
export function getCastMode(): CastMode {
  if (getCastBridge()) return 'native';
  if (isWebCastSupported()) return 'web';
  return 'none';
}

// ═══════════════════════════════════════════════════════════════
// Google Cast Web SDK 集成（Chromecast / Google TV 等 Cast 设备）
// 与原生 DLNA 桥不同：Cast SDK 无设备列表 API，由系统弹窗选择设备（requestSession）。
// ═══════════════════════════════════════════════════════════════

/** Cast SDK 官方脚本 */
const CAST_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';
/** 默认媒体接收器 App ID（Chromecast 内置接收器） */
const DEFAULT_RECEIVER_ID = 'CC1AD845';

let webCastInitPromise: Promise<boolean> | null = null;
let webCastContext: unknown = null;
let webCastPlayer: unknown = null;
let webCastController: unknown = null;

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

/**
 * 发现投屏设备。
 * 无原生桥（Web/桌面）或发现失败时返回空数组，由 UI 展示空态。
 */
export async function discoverCastDevices(): Promise<CastDevice[]> {
  const bridge = getCastBridge();
  if (!bridge) return [];
  try {
    const devices = await bridge.discover();
    return Array.isArray(devices) ? devices : [];
  } catch {
    return [];
  }
}

/** 连接设备（幂等：已连接同一设备时直接返回） */
export async function connectCastDevice(deviceId: string): Promise<void> {
  const bridge = getCastBridge();
  if (!bridge?.connect) return;
  await bridge.connect(deviceId);
}

/** 断开投屏 */
export async function disconnectCast(): Promise<void> {
  const bridge = getCastBridge();
  if (!bridge?.disconnect) return;
  await bridge.disconnect();
}