/**
 * 数据源配置类型定义
 * 定义视频采集站 API 配置和 IPTV 播放列表源配置
 */

/** 视频采集站 API 配置 */
export interface VideoSourceConfig {
  name: string;
  api: string;
  detail: string;
}

/** 视频源配置数据格式（对应 video-sources.json） */
export interface VideoSourcesData {
  cache_time: number;
  api_site: Record<string, VideoSourceConfig>;
}

/** IPTV 播放列表源配置 */
export interface IPTVSourceConfig {
  name: string;
  url: string;
}

/** EPG 源配置 */
export interface EPGSourceConfig {
  name: string;
  url: string;
}
