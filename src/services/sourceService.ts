/**
 * 数据源配置服务
 * 从本地 JSON 配置文件加载视频源、IPTV 源和 EPG 源的定义
 */
import type { VideoSourceConfig, IPTVSourceConfig, VideoSourcesData, EPGSourceConfig } from '@/types/source';
import { getJSON } from './httpClient';

// 为向后兼容重新导出类型
export type { EPGSourceConfig } from '@/types/source';

const VIDEO_SOURCES_URL = '/data/video-sources.json';
const IPTV_SOURCES_URL = '/data/iptv-sources.json';
const EPG_SOURCES_URL = '/data/epg-sources.json';

// 内存缓存：避免同一会话内重复请求同一配置文件
let videoSourcesCache: VideoSourceConfig[] | null = null;
let iptvSourcesCache: IPTVSourceConfig[] | null = null;
let epgSourcesCache: EPGSourceConfig[] | null = null;

/** 从配置文件获取所有视频源列表 */
export async function getVideoSources(): Promise<VideoSourceConfig[]> {
  if (videoSourcesCache) return videoSourcesCache;
  try {
    const data = await getJSON<VideoSourcesData>(VIDEO_SOURCES_URL);
    videoSourcesCache = Object.entries(data.api_site).map(([id, site]) => ({ ...site, id }));
    return videoSourcesCache;
  } catch (error) {
    console.error('加载视频源失败:', error);
    return [];
  }
}

/** 从配置文件获取所有 IPTV 源列表 */
export async function getIPTVSources(): Promise<IPTVSourceConfig[]> {
  if (iptvSourcesCache) return iptvSourcesCache;
  try {
    iptvSourcesCache = await getJSON<IPTVSourceConfig[]>(IPTV_SOURCES_URL);
    return iptvSourcesCache;
  } catch (error) {
    console.error('加载 IPTV 源失败:', error);
    return [];
  }
}

/** 从配置文件获取所有 EPG 节目单源列表 */
export async function getEPGSources(): Promise<EPGSourceConfig[]> {
  if (epgSourcesCache) return epgSourcesCache;
  try {
    epgSourcesCache = await getJSON<EPGSourceConfig[]>(EPG_SOURCES_URL);
    return epgSourcesCache;
  } catch (error) {
    console.error('加载 EPG 源失败:', error);
    return [];
  }
}
