/**
 * 数据存储相关类型定义
 *
 * 定义 IndexedDB 中视频记录、收藏记录、观看历史等数据结构，
 * 用于本地持久化存储用户数据。
 */
import type { Video } from './video';

/** 视频记录，与 Video 类型一致，用于 IndexedDB 存储 */
export type VideoRecord = Video;

/**
 * 收藏记录
 *
 * 记录用户收藏的视频信息，用于收藏页展示和快速跳转。
 */
export interface CollectionRecord {
  /** 收藏记录唯一 ID（格式：col-{timestamp}-{random}） */
  id: string;
  /** TMDB 视频 ID（如 tmdb-movie-12345） */
  videoId: string;
  /** 收藏时间（Unix 时间戳，毫秒） */
  addedAt: number;
  /** 用户备注（可选） */
  note?: string;
  /** 视频标题（用于离线展示） */
  title?: string;
  /** 视频封面 URL（用于离线展示） */
  cover?: string;
  /** 视频类型（movie/tv） */
  type?: string;
  /** 视频年份 */
  year?: number;
  /** 用户评分（1-5） */
  rating?: number;
  /**
   * CMS 直链搜索来源的源索引
   * 存在时收藏页点击跳转到 /play/:id 而非 /detail/:id
   */
  sourceIndex?: number;
}

/**
 * 观看历史记录
 *
 * 按视频+剧集维度记录播放进度，用于历史页展示和播放进度恢复。
 * 同一集的记录会更新进度，不会重复创建。
 */
export interface HistoryRecord {
  /** 历史记录唯一 ID（格式：hist-{timestamp}-{random}） */
  id: string;
  /** TMDB 视频 ID（如 tmdb-movie-12345） */
  videoId: string;
  /** 当前播放进度（秒） */
  progress: number;
  /** 视频总时长（秒） */
  duration: number;
  /** 最后更新时间（Unix 时间戳，毫秒） */
  updatedAt: number;
  /** 视频标题（用于离线展示） */
  title?: string;
  /** 视频封面 URL（用于离线展示） */
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
  /** 当前播放的集的 URL（如 http://example.com/ep1.m3u8），用于精确恢复选集 */
  episodeUrl?: string;
  /** 当前播放的季号（如 2），播放剧集时一并写入，用于详情页进度展示「第X季 第Y集」 */
  seasonNumber?: number;
  /** 当前季的 vod_id，用于选季面板高亮 */
  currentSeasonId?: string;
}

/**
 * IndexedDB 数据库 Schema 定义
 *
 * 定义数据库的对象仓库和索引结构，使用 idb 库的类型安全 API。
 */
export interface VideoWarehouseDB {
  /** 视频记录仓库 */
  videos: {
    /** 主键：视频 ID */
    key: string;
    /** 值类型：视频记录 */
    value: VideoRecord;
    /** 索引定义 */
    indexes: {
      /** 按视频类型索引（movie/tv） */
      'by-type': string;
      /** 按年份索引 */
      'by-year': number;
      /** 按创建时间索引 */
      'by-created': number;
    };
  };
  /** 收藏记录仓库 */
  collections: {
    /** 主键：收藏记录 ID */
    key: string;
    /** 值类型：收藏记录 */
    value: CollectionRecord;
    /** 索引定义 */
    indexes: {
      /** 按视频 ID 索引 */
      'by-video': string;
    };
  };
  /** 观看历史记录仓库 */
  history: {
    /** 主键：历史记录 ID */
    key: string;
    /** 值类型：历史记录 */
    value: HistoryRecord;
    /** 索引定义 */
    indexes: {
      /** 按视频 ID 索引 */
      'by-video': string;
      /** 按更新时间索引（用于排序） */
      'by-updated': number;
    };
  };
  /** 设置仓库 */
  settings: {
    /** 主键：设置项 key */
    key: string;
    /** 值类型：任意 */
    value: unknown;
  };
}
