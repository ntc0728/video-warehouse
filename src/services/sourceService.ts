/**
 * 数据源配置服务
 * 从本地 JSON 配置文件加载视频源和 IPTV 源的定义
 */
import type { VideoSourceConfig, IPTVSourceConfig, VideoSourcesData } from '@/types/source';
import { getJSON } from './httpClient';

const VIDEO_SOURCES_URL = '/data/video-sources.json';
const IPTV_SOURCES_URL = '/data/iptv-sources.json';

export async function getVideoSources(): Promise<VideoSourceConfig[]> {
  try {
    const data = await getJSON<VideoSourcesData>(VIDEO_SOURCES_URL, { cacheBust: true });
    return Object.values(data.api_site);
  } catch (error) {
    console.error('Failed to load video sources:', error);
    return [];
  }
}

export async function getIPTVSources(): Promise<IPTVSourceConfig[]> {
  try {
    return await getJSON<IPTVSourceConfig[]>(IPTV_SOURCES_URL, { cacheBust: true });
  } catch (error) {
    console.error('Failed to load IPTV sources:', error);
    return [];
  }
}
