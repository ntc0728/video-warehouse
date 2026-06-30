/**
 * 数据存储相关类型定义
 * 定义 IndexedDB 中视频记录、收藏记录、观看历史等数据结构
 */
import type { Video } from './video';

/** 视频记录，与 Video 类型一致，用于 IndexedDB 存储 */
export type VideoRecord = Video;

/** 收藏记录 */
export interface CollectionRecord {
  id: string;
  videoId: string;
  addedAt: number;
  note?: string;
  title?: string;
  cover?: string;
  type?: string;
  year?: number;
  rating?: number;
}

/** 观看历史记录，按视频+剧集维度记录播放进度 */
export interface HistoryRecord {
  id: string;
  videoId: string;
  episodeId?: string;
  progress: number;
  duration: number;
  updatedAt: number;
  title?: string;
  cover?: string;
  /** TMDB 横版背景图（16:9），用于历史页横版卡片展示 */
  backdrop?: string;
  /** 当前使用的播放线路名（来自 vod_play_from，如 "ikm3u8"），用于恢复上次播放的线路 */
  sourceName?: string;
  /** CMS 源配置名称（如 "量子资源"），用于历史页展示 */
  cmsSourceName?: string;
  /** 当前播放的集数标题（如 "第3集"），播放时写入 */
  episodeLabel?: string;
}

/** IndexedDB 数据库 Schema 定义 */
export interface VideoWarehouseDB {
  videos: {
    key: string;
    value: VideoRecord;
    indexes: {
      'by-type': string;
      'by-year': number;
      'by-created': number;
    };
  };
  collections: {
    key: string;
    value: CollectionRecord;
    indexes: {
      'by-video': string;
    };
  };
  history: {
    key: string;
    value: HistoryRecord;
    indexes: {
      'by-video': string;
      'by-updated': number;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
}
