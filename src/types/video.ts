/**
 * 视频相关类型定义
 * 定义视频、剧集、播放源、筛选条件等核心数据结构
 */

/** 视频类型：电影、剧集、综艺、动漫 */
export type VideoType = 'movie' | 'tv' | 'variety' | 'anime';

/** 播放源类型：MP4直链、HLS流、DASH流、网盘、FLV/裸TS流（mpegts.js 兜底） */
export type SourceType = 'mp4' | 'm3u8' | 'dash' | 'pan' | 'flv';

/** 视频播放源，表示一个可播放的视频地址 */
export interface VideoSource {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  quality?: string;
  isDefault?: boolean;
}

/** 剧集信息，每集可包含多个播放源 */
export interface Episode {
  id: string;
  /** 唯一标识：电影为线路的 vod_id，剧集为 CMS 返回的 vod_id */
  vodId: string;
  /** 播放链接 URL */
  url: string;
  title: string;
  number: number;
  cover?: string;
  sources: VideoSource[];
}

/** 视频实体，包含基本信息、播放源和剧集列表 */
export interface Video {
  id: string;
  title: string;
  cover: string;
  type: VideoType;
  year?: number;
  region?: string;
  tags: string[];
  description?: string;
  actors: string[];
  director?: string;
  duration?: number;
  sources: VideoSource[];
  episodes?: Episode[];
  createdAt: number;
  updatedAt: number;
}


