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

/**
 * 附加源（custom，来自 useSourceManagerStore）
 * 消费方通过 getVideoSources() 拿到「内置源 + 附加源」合成数组，
 * 下标自然覆盖 custom 源，videoService 等按下标取源的逻辑无需改动。
 * 由 useSourceManagerStore 在 bootstraps/setEnabled 时更新。
 */
let attachedVideoSources: VideoSourceConfig[] = [];
let attachedIPTVSources: IPTVSourceConfig[] = [];
let attachedEPGSources: EPGSourceConfig[] = [];

/** 设置附加源（store 调用） */
export function setAttachedSources(kind: 'video' | 'iptv' | 'epg', sources: VideoSourceConfig[] | IPTVSourceConfig[] | EPGSourceConfig[]) {
  if (kind === 'video') attachedVideoSources = sources as VideoSourceConfig[];
  else if (kind === 'iptv') attachedIPTVSources = sources as IPTVSourceConfig[];
  else attachedEPGSources = sources as EPGSourceConfig[];
}

/** 从配置文件获取所有视频源列表（含附加 custom 源，合成数组） */
export async function getVideoSources(): Promise<VideoSourceConfig[]> {
  if (videoSourcesCache) return [...videoSourcesCache, ...attachedVideoSources];
  try {
    const data = await getJSON<VideoSourcesData>(VIDEO_SOURCES_URL);
    videoSourcesCache = Object.entries(data.api_site).map(([id, site]) => ({ ...site, id }));
    return [...videoSourcesCache, ...attachedVideoSources];
  } catch (error) {
    console.error('加载视频源失败:', error);
    return [...attachedVideoSources];
  }
}

/** 从配置文件获取所有 IPTV 源列表（含附加 custom 源） */
export async function getIPTVSources(): Promise<IPTVSourceConfig[]> {
  if (iptvSourcesCache) return [...iptvSourcesCache, ...attachedIPTVSources];
  try {
    iptvSourcesCache = await getJSON<IPTVSourceConfig[]>(IPTV_SOURCES_URL);
    return [...iptvSourcesCache, ...attachedIPTVSources];
  } catch (error) {
    console.error('加载 IPTV 源失败:', error);
    return [...attachedIPTVSources];
  }
}

/** 从配置文件获取所有 EPG 节目单源列表（含附加 custom 源） */
export async function getEPGSources(): Promise<EPGSourceConfig[]> {
  if (epgSourcesCache) return [...epgSourcesCache, ...attachedEPGSources];
  try {
    epgSourcesCache = await getJSON<EPGSourceConfig[]>(EPG_SOURCES_URL);
    return [...epgSourcesCache, ...attachedEPGSources];
  } catch (error) {
    console.error('加载 EPG 源失败:', error);
    return [...attachedEPGSources];
  }
}
