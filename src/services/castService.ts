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