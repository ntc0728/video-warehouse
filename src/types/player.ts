/**
 * 播放器类型定义
 *
 * 定义播放器的核心类型：
 * - 播放器模式（视频/IPTV/直播）
 * - 平台类型（电视/移动端/桌面端）
 * - 解码模式（原生/WASM）
 * - 清晰度级别
 * - 适配器接口
 * - 播放器组件 Props
 */
import type React from 'react';
import type { SourceType } from '@/types/video';
import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

/** 播放器模式 */
export type PlayerMode = 'video' | 'iptv' | 'live';

/** 平台类型 */
export type PlatformType = 'tv' | 'mobile' | 'desktop';

/** 解码模式：native = 浏览器原生，wasm = WebAssembly 解码器 */
export type DecoderMode = 'native' | 'wasm';

/** 循环播放模式 */
export type LoopMode = 'none' | 'single' | 'list';

/** 清晰度级别 */
export interface PlayerLevel {
  /** 视频宽度（像素） */
  width: number;
  /** 视频高度（像素） */
  height: number;
  /** 视频码率（bps） */
  bitrate: number;
  /** 清晰度名称（如 "1080p"） */
  name?: string;
}

/**
 * 播放器适配器接口
 *
 * 定义播放器适配器必须实现的方法，
 * 支持 HLS/DASH/Native 等不同播放引擎的统一调用。
 */
export interface PlayerAdapter {
  /** 将适配器绑定到 video 元素 */
  attach(video: HTMLVideoElement): void;
  /** 从 video 元素解绑 */
  detach(): void;
  /** 开始播放 */
  play(): Promise<void>;
  /** 暂停播放 */
  pause(): void;
  /** 跳转到指定时间（秒） */
  seek(time: number): void;
  /** 设置音量（0-1） */
  setVolume(volume: number): void;
  /** 获取视频总时长（秒） */
  getDuration(): number;
  /** 获取当前播放时间（秒） */
  getCurrentTime(): number;
  /** 设置播放倍速 */
  setPlaybackRate(rate: number): void;
  /** 获取当前播放倍速 */
  getPlaybackRate(): number;
  /** 获取可用的清晰度级别列表 */
  getLevels(): PlayerLevel[];
  /** 设置清晰度级别（-1 = 自动） */
  setCurrentLevel(level: number): void;
  /** 获取当前清晰度级别 */
  getCurrentLevel(): number;
  /** 销毁适配器，释放资源 */
  destroy(): void;
}

/** 播放器适配器构造函数接口 */
export interface PlayerAdapterConstructor {
  new (url: string, options?: Record<string, unknown>): PlayerAdapter;
}

/** 控制栏项 */
export interface ControlBarItem {
  /** 唯一标识 */
  id: string;
  /** 显示文本 */
  label: string;
  /** 图标 */
  icon?: React.ReactNode;
  /** 点击回调 */
  onClick?: () => void;
  /** 自定义内容 */
  content?: React.ReactNode;
  /** 是否可见 */
  visible?: boolean;
}

/**
 * 通用播放器组件 Props
 *
 * 支持视频播放、IPTV 直播、直播流三种模式，
 * 提供统一的播放控制和事件回调接口。
 */
export interface UniversalPlayerProps {
  /** 视频源 URL */
  url: string;
  /** 视频源类型（m3u8/mp4/mpd 等） */
  type: SourceType;
  /** 播放器模式（video/iptv/live） */
  mode?: PlayerMode;
  /** 平台类型（tv/mobile/desktop） */
  platform?: PlatformType;
  /** 视频标题（用于显示） */
  title?: string;
  /** TMDB 视频 ID（用于历史记录和收藏） */
  videoId?: string;
  /** CMS 源的 vod_id（用于历史记录匹配） */
  vodId?: string;
  /** 当前播放集的 URL（用于历史记录精确匹配） */
  episodeUrl?: string;
  /** CMS 源配置 ID（用于历史记录匹配） */
  cmsSourceId?: string;
  /** 是否跳过历史记录恢复（用于"从头播放"场景） */
  skipHistory?: boolean;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** IPTV 频道名称 */
  channelName?: string;
  /** IPTV 频道列表 */
  channels?: IPTVChannel[];
  /** IPTV 频道分组列表 */
  groups?: IPTVGroup[];
  /** 播放进度回调（currentTime, duration） */
  onProgress?: (progress: number, duration: number) => void;
  /** 播放结束回调 */
  onEnded?: () => void;
  /** 开始播放回调 */
  onPlay?: () => void;
  /** 暂停播放回调 */
  onPause?: () => void;
  /** 播放错误回调 */
  onError?: (error: Error) => void;
  /** 返回按钮回调 */
  onBack?: () => void;
  /** 刷新按钮回调 */
  onRefresh?: () => void;
  /** IPTV 频道切换回调 */
  onChannelChange?: (channel: IPTVChannel) => void;
  /** 跳过片头回调 */
  onSkipIntro?: () => void;
  /** 跳过片尾回调 */
  onSkipOutro?: () => void;
  /** 控制栏插槽（左/中/右） */
  controlBarSlots?: {
    /** 左侧插槽 */
    left?: React.ReactNode;
    /** 中间插槽 */
    center?: React.ReactNode;
    /** 右侧插槽 */
    right?: React.ReactNode;
  };
  /** 当前集的标签（如 "第3集"） */
  episodeLabel?: string;
  /** 当前季号（剧集播放时有值），用于进度恢复按「内容身份」精确匹配 */
  seasonNumber?: number;
  /** 是否有上一集（显示上一集按钮） */
  hasPrevEpisode?: boolean;
  /** 是否有下一集（显示下一集按钮） */
  hasNextEpisode?: boolean;
  /** 上一集回调 */
  onPrevEpisode?: () => void;
  /** 下一集回调 */
  onNextEpisode?: () => void;
}
