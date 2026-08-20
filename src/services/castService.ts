/**
 * 投屏（DLNA）服务 — UI + 状态机层
 *
 * 当前阶段仅提供「设备发现接口契约 + 状态机类型」：
 * - 原生 DLNA 模块（SSDP 设备发现 + SetAVTransportURI/Play/Pause/Seek 推送）后续作为
 *   独立任务接入，届时在 Android 端注入 `window.CastBridge` 实现即可无缝对接；
 * - Web / 未注入桥时 `discoverCastDevices()` 返回空数组 → 投屏弹窗展示「未发现设备」空态。
 *
 * E2E 测试可通过 `page.addInitScript` 注入 mock `window.CastBridge` 走完整流程。
 *
 * 注：Web Cast（Google Cast SDK）集成已在独立模块 `webCastSdk.ts`（按需加载，
 * 仅投屏弹窗打开时引用，避免打进播放器主 chunk）。
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

/** 投屏所需权限状态（原生桥 ensurePermission 返回值） */
export type CastPermissionStatus = 'granted' | 'denied';

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
  /** 检查/请求投屏所需权限（如 Android 13+「附近的设备」），必要时弹系统授权；缺失/未实现时由前端兜底 */
  ensurePermission?: () => Promise<CastPermissionStatus>;
  /** 打开系统应用设置页（权限被拒后引导用户手动授权） */
  openAppSettings?: () => Promise<void>;
}

/** 兼容 re-export：Web Cast 会话设备类型（定义于 webCastSdk.ts） */
export type { WebCastDevice } from './webCastSdk';

declare global {
  interface Window {
    /** 原生投屏桥（Android 原生模块注入；Web 端不存在） */
    CastBridge?: CastBridge;
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

/**
 * 检查/请求投屏所需权限（原生桥 ensurePermission）。
 * 返回 'granted' 表示可继续；'denied' 表示用户拒绝/未授权；'unsupported' 表示桥未实现
 *（老版本 App / 测试 mock 缺该方法）——此时前端按「无权限门槛」继续旧流程。
 */
export async function ensureCastPermission(): Promise<CastPermissionStatus | 'unsupported'> {
  const bridge = getCastBridge();
  if (!bridge?.ensurePermission) return 'unsupported';
  try {
    const status = await bridge.ensurePermission();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** 打开系统应用设置页（权限被拒后引导用户手动授权；桥未实现时静默） */
export async function openCastAppSettings(): Promise<void> {
  const bridge = getCastBridge();
  if (!bridge?.openAppSettings) return;
  try {
    await bridge.openAppSettings();
  } catch {
    // 静默
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