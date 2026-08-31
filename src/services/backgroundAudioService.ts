/**
 * 后台音频服务（P3） — Android 原生前台媒体服务契约层。
 *
 * 与投屏 castService.ts 同体系：本文件只定义「原生桥接口契约 + 状态类型 + 获取桥」，
 * 真正的原生实现（MediaService 前台服务 + MediaSession）由 Android 原生侧
 * `MediaBridgePlugin` 注入 window.MediaBridge 实现；未注入桥时（Web / iOS / 测试 mock）
 * 全部降级为 no-op，功能不影响，MediaSession（P1）仍是兜底。
 *
 * E2E 测试可通过 page.evaluate 注入 mock window.MediaBridge 走完整流程。
 */

/** 后台媒体状态 */
export type MediaPlaybackState = 'playing' | 'paused' | 'stopped';

/** 媒体元数据（与 useMediaSession 的 MediaSessionInfo 对齐） */
export interface NativeMediaMetadata {
  title: string;
  artist?: string;
  artwork?: string;
  /** 媒体流 URL（原生侧据此创建数据源） */
  url: string;
}

/** 原生媒体桥接口（由 Android MediaBridgePlugin 实现，注入 window.MediaBridge） */
export interface MediaBridge {
  /** 启动前台媒体服务并准备数据源（不自动播放） */
  start: (metadata: NativeMediaMetadata) => Promise<void>;
  /** 播放 */
  play: () => Promise<void>;
  /** 暂停 */
  pause: () => Promise<void>;
  /** 停止并停止前台服务 */
  stop: () => Promise<void>;
  /** seek 到指定位置（秒） */
  seek?: (time: number) => Promise<void>;
  /** 获取当前播放状态 */
  getState?: () => Promise<MediaPlaybackState>;
}

declare global {
  interface Window {
    /** 原生媒体桥（Android MediaBridgePlugin 注入；Web/iOS 不存在） */
    MediaBridge?: MediaBridge;
  }
}

/** 获取原生媒体桥；未注入时返回 null（Web / iOS / 测试） */
export function getMediaBridge(): MediaBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.MediaBridge;
  return bridge && typeof bridge.start === 'function' ? bridge : null;
}

/**
 * 是否为支持原生前台媒体服务的环境。
 * 仅 Android Capacitor（import.meta.env.CAPACITOR + data-device=app + Android UA）为真。
 */
export function isNativeMediaServiceSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor App 环境标记（vite define CAPACITOR）
  if (!import.meta.env.CAPACITOR) return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua);
}

/**
 * P2：iOS Safari 后台续播能力检测。
 * iOS 17+ 的 ManagedMediaSource 允许 video 在后台继续播放（HLSAdapter 已配
 * preferManagedMediaSource:true）；旧 iOS 切后台必停媒体，前端无法绕过。
 * 返回 'supported'（iOS17+，后台可续播）/ 'unsupported'（旧 iOS，后台必停）/
 * 'irrelevant'（非 iOS 或 Android App 端，不适用本检测）。
 */
export function getIOSBackgroundAudioCapability(): 'supported' | 'unsupported' | 'irrelevant' {
  if (typeof window === 'undefined') return 'irrelevant';
  const ua = navigator.userAgent || '';
  if (!/iPhone|iPad|iPod/i.test(ua)) return 'irrelevant';
  // Android App 端走原生服务（P3），不归本检测
  if (isNativeMediaServiceSupported()) return 'irrelevant';
  // ManagedMediaSource 可用 = iOS 17+
  return 'ManagedMediaSource' in window ? 'supported' : 'unsupported';
}
