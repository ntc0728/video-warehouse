/**
 * IPTV 直播相关类型定义
 * 定义直播频道、频道分组、IPTV 设置和筛选条件等数据结构
 */

/** IPTV 源类型枚举 */
export enum PlaylistSourceType {
  SINGLE_STREAM = 'single',
  MULTI_CHANNEL = 'multi',
  UNKNOWN = 'unknown',
}

/** IPTV 直播频道 */
export interface IPTVChannel {
  id: string;
  name: string;
  logo?: string;
  url: string;
  group?: string;
  region?: string;
  language?: string;
  quality?: string;
  codec?: string;
  bitrate?: number;
  isFavorite?: boolean;
  lastPlayed?: number;
  tvgId?: string;
  sourceId?: string;
  noGuide?: boolean;
  supportTimeshift?: boolean;
  currentProgram?: {
    title: string;
    start: string;
    end: string;
  };
  nextProgram?: {
    title: string;
    start: string;
    end: string;
  };
}

/** 频道分组 */
export interface IPTVGroup {
  name: string;
  count: number;
  channels: IPTVChannel[];
}

/** IPTV 设置，包含聚合源地址、代理配置和自动刷新等 */
export interface IPTVSettings {
  aggregatorUrl: string;
  aggregatorUrls: string[];
  sourceNames?: string[];
  proxyUrl: string;
  proxyPattern: string;
  priorityKeywords: string[];
  autoRefresh: boolean;
  refreshIntervalHours: number;
  localPlaylistPath?: string;
}

/** IPTV 频道筛选条件 */
export interface IPTVFilter {
  group?: string;
  region?: string;
  keyword?: string;
  favoritesOnly?: boolean;
  sourceId?: string;
}

/** IPTV 播放记录 */
export interface IPTVPlayRecord {
  channelId: string;
  channelName: string;
  channelLogo?: string;
  channelGroup?: string;
  playedAt: number;
}
