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
  /** CMS 直链搜索来源的源索引，存在时收藏页点击跳转到 /play/:id 而非 /detail/:id */
  sourceIndex?: number;
}

/** 观看历史记录，按视频+剧集维度记录播放进度 */
export interface HistoryRecord {
  id: string;
  videoId: string;
  progress: number;
  duration: number;
  updatedAt: number;
  title?: string;
  cover?: string;
  /** TMDB 横版背景图（16:9），用于历史页横版卡片展示 */
  backdrop?: string;
  /** CMS 源配置 ID（域名 key，如 "cj.lzcaiji.com"），用于匹配恢复 CMS 源 */
  cmsSourceId?: string;
  /** CMS 源配置名称（如 "量子资源"），用于历史页展示 */
  cmsSourceName?: string;
  /** 当前播放的集数标题（如 "第3集"），播放时写入 */
  episodeLabel?: string;
  /** CMS 源的 vod_id，用于匹配选季高亮和快速恢复 */
  vodId?: string;
  /** 当前播放的集的 URL，用于精确恢复选集 */
  episodeUrl?: string;
  /** 当前季的 vod_id，用于选季面板高亮 */
  currentSeasonId?: string;
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
