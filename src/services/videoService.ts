/**
 * 视频数据服务
 * 负责从多个视频源（CMS 采集站 API）获取视频列表和详情
 * 通过统一 httpClient（axios）统一处理 缓存 / 超时 / 重试
 */
import type { Video, VideoType } from '@/types/video';
import { getVideoSources, getIPTVSources } from './sourceService';
import { getJSON } from './httpClient';

export { getVideoSources };

interface SourceStatus {
  index: number;
  name: string;
  available: boolean;
  error?: string;
}

/**
 * CMS 视频源返回的单条记录原始结构（不同 CMS 字段命名略有差异，全部用可选 + 容错处理）
 */
interface CMSVideoItem {
  vod_id: string | number;
  vod_name?: string;
  vod_pic?: string;
  vod_type?: string | number;
  vod_year?: string;
  vod_area?: string;
  vod_content?: string;
  vod_class?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_duration?: string;
  vod_url?: string;
  vod_play_from?: string;
  vod_play_url?: string;
}

/**
 * CMS 视频源列表/详情接口的顶层响应结构
 */
interface CMSListResponse {
  list?: CMSVideoItem[];
  page?: number;
  total?: number;
}

const VOD_TYPE_MAP: Record<number, VideoType> = {
  1: 'movie',
  2: 'tv',
  3: 'variety',
  4: 'anime',
};

/** 将 CMS 类型编码映射为应用内的 VideoType */
function mapVodType(raw: string | number | undefined | null): VideoType | undefined {
  if (typeof raw === 'number') return VOD_TYPE_MAP[raw];
  if (typeof raw === 'string') {
    const num = parseInt(raw, 10);
    if (!isNaN(num)) return VOD_TYPE_MAP[num];
    if (raw === 'movie' || raw === 'tv' || raw === 'variety' || raw === 'anime') {
      return raw;
    }
  }
  return undefined;
}

/** 检查单个视频源是否可用 */
export async function checkVideoSourceAvailability(
  sourceIndex: number,
  timeout: number = 8000
): Promise<SourceStatus> {
  const sources = await getVideoSources();
  const source = sources[sourceIndex];

  if (!source) {
    return { index: sourceIndex, name: '未知', available: false, error: '视频源配置不存在' };
  }

  try {
    const data = await getJSON<CMSListResponse>(source.api, { useProxy: true, timeout });
    if (data && Array.isArray(data.list)) {
      return { index: sourceIndex, name: source.name, available: true };
    }
    return { index: sourceIndex, name: source.name, available: false, error: '响应格式异常' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      index: sourceIndex,
      name: source.name,
      available: false,
      error: message || '未知错误',
    };
  }
}

export interface SourceCheckResult extends SourceStatus {
  videoCount?: number;
  elapsed: number;
}

/** 并发检查所有视频源的可用性 */
export async function checkAllVideoSources(
  concurrency: number = 5,
  timeout: number = 10000
): Promise<{
  results: SourceCheckResult[];
  totalAvailable: number;
  totalSources: number;
}> {
  const sources = await getVideoSources();
  if (sources.length === 0) return { results: [], totalAvailable: 0, totalSources: 0 };

  const results: SourceCheckResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < sources.length) {
      const i = index++;
      const start = Date.now();
      const status = await checkVideoSourceAvailability(i, timeout);
      const elapsed = Date.now() - start;

      let videoCount: number | undefined;
      if (status.available) {
        try {
          const result = await fetchVideosBySource(i);
          if (!result.error) videoCount = result.videos.length;
        } catch {
          // 单个数据源失败不影响其他源的统计
        }
      }
      results.push({ ...status, videoCount, elapsed });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, sources.length) }, () => worker());
  await Promise.all(workers);
  results.sort((a, b) => a.index - b.index);

  return {
    results,
    totalAvailable: results.filter((r) => r.available).length,
    totalSources: results.length,
  };
}

/** 按优先级查找第一个可用的视频源 */
export async function findAvailableVideoSource(
  preferredIndex?: number,
  timeout: number = 8000
): Promise<{ index: number; name: string } | null> {
  const sources = await getVideoSources();
  if (sources.length === 0) return null;

  if (preferredIndex !== undefined && preferredIndex >= 0 && preferredIndex < sources.length) {
    const status = await checkVideoSourceAvailability(preferredIndex, timeout);
    if (status.available) return { index: preferredIndex, name: sources[preferredIndex].name };
  }

  for (let i = 0; i < sources.length; i++) {
    if (i === preferredIndex) continue;
    const status = await checkVideoSourceAvailability(i, timeout);
    if (status.available) return { index: i, name: sources[i].name };
  }

  if (preferredIndex !== undefined && preferredIndex >= 0 && preferredIndex < sources.length) {
    return { index: preferredIndex, name: sources[preferredIndex].name };
  }
  return sources.length > 0 ? { index: 0, name: sources[0].name } : null;
}

/** 将 CMS 原始视频条目映射为应用内部的 Video 类型 */
function mapVideoItem(item: CMSVideoItem): Video {
  return {
    id: String(item.vod_id),
    title: item.vod_name ?? '',
    cover: item.vod_pic ?? '',
    type: mapVodType(item.vod_type) ?? 'movie',
    year: item.vod_year ? parseInt(item.vod_year) : undefined,
    region: item.vod_area,
    description: item.vod_content,
    tags: item.vod_class ? item.vod_class.split(',').filter(Boolean) : [],
    actors: item.vod_actor ? item.vod_actor.split(',').filter(Boolean) : [],
    director: item.vod_director,
    duration: item.vod_duration ? parseInt(item.vod_duration) : undefined,
    sources: item.vod_url ? [{
      id: 'default', name: '默认', url: item.vod_url.split(',')[0], type: 'mp4' as const,
    }] : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** 从指定视频源获取视频列表 */
export async function fetchVideosBySource(sourceIndex: number): Promise<{
  videos: Video[];
  sourceInfo?: { index: number; name: string };
  error?: string;
}> {
  const sources = await getVideoSources();
  const source = sources[sourceIndex];
  if (!source) return { videos: [], error: '未找到配置的视频源' };

  try {
    const data = await getJSON<CMSListResponse>(source.api, { useProxy: true, timeout: 15000 });
    if (data.list && Array.isArray(data.list)) {
      return {
        videos: data.list.map(mapVideoItem),
        sourceInfo: { index: sourceIndex, name: source.name },
      };
    }
    return {
      videos: [],
      sourceInfo: { index: sourceIndex, name: source.name },
      error: `请求源 ${source.name} 响应格式异常`,
    };
  } catch (error) {
    const _message = error instanceof Error ? error.message : String(error);
    console.warn(`从 ${source.name} 获取视频列表失败:`, error);
    return {
      videos: [],
      sourceInfo: { index: sourceIndex, name: source.name },
      error: `无法连接到 ${source.name}：${_message || '未知错误'}`,
    };
  }
}

/** 从 $ 分隔的 parts 中提取标题：跳过 URL 和空串，取第一个有意义的部分 */
function pickTitle(parts: string[], fallback: string): string {
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k].trim();
    if (!p || p.startsWith('http') || p.startsWith('//')) continue;
    return p;
  }
  return fallback;
}

/** 解析播放源字符串，提取源列表和分集信息 */
function parsePlaySources(vodPlayFrom: string, vodPlayUrl: string): { sources: Video['sources']; episodes: Video['episodes'] } {
  const fromList = vodPlayFrom ? vodPlayFrom.split('$$$').filter(Boolean) : [];
  const urlList = vodPlayUrl ? vodPlayUrl.split('$$$').filter(Boolean) : [];
  if (fromList.length === 0 || urlList.length === 0) return { sources: [], episodes: undefined };

  const allSources: Video['sources'] = [];
  const episodesMap = new Map<string, { title: string; sources: Video['sources'] }>();

  for (let i = 0; i < fromList.length; i++) {
    const sourceName = fromList[i].trim() || `源${i + 1}`;
    const urlStr = urlList[i] || '';
    const episodes = urlStr.split('#').filter(Boolean);
    if (episodes.length === 0) continue;

    if (episodes.length === 1) {
      const parts = episodes[0].split('$');
      const url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      if (url) {
        const type = url.includes('.m3u8') ? 'm3u8' as const : url.includes('.mpd') ? 'dash' as const : 'mp4' as const;
        const name = pickTitle(parts.slice(0, -1), sourceName);
        allSources.push({ id: `source-${i}`, name, url, type, isDefault: allSources.length === 0 });
      }
    } else {
      for (let j = 0; j < episodes.length; j++) {
        const parts = episodes[j].split('$');
        const url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        if (!url) continue;
        const epTitle = pickTitle(parts.slice(0, -1), '第' + (j + 1) + '集');
        const type = url.includes('.m3u8') ? 'm3u8' as const : url.includes('.mpd') ? 'dash' as const : 'mp4' as const;
        const sourceId = `source-${i}-ep-${j}`;
        const epKey = `${epTitle}-${j}`;
        if (!episodesMap.has(epKey)) episodesMap.set(epKey, { title: epTitle, sources: [] });
        episodesMap.get(epKey)!.sources.push({ id: sourceId, name: sourceName, url, type, isDefault: i === 0 });
      }
    }
  }

  let episodes: Video['episodes'] | undefined;
  if (episodesMap.size > 0) {
    episodes = Array.from(episodesMap.entries()).map(([key, ep], index) => ({
      id: key, title: ep.title, number: index + 1, sources: ep.sources,
    }));
  }
  return { sources: allSources, episodes };
}

/** 获取单个视频的详情信息（含播放源和分集） */
export async function fetchVideoDetail(sourceIndex: number, videoId: string): Promise<Video | null> {
  const sources = await getVideoSources();
  const source = sources[sourceIndex];
  if (!source) return null;

  try {
    const detailUrl = `${source.api}?ac=detail&vod_id=${videoId}`;
    const data = await getJSON<CMSListResponse>(detailUrl, { useProxy: true });
    if (data.list && Array.isArray(data.list) && data.list.length > 0) {
      const item = data.list[0];
      const { sources: playSources, episodes } = parsePlaySources(
        item.vod_play_from || '', item.vod_play_url || ''
      );
      return { ...mapVideoItem(item), sources: playSources, episodes };
    }
  } catch (error) {
    console.warn(`从 ${source.name} 获取视频详情失败:`, error);
  }
  return null;
}

export interface VideoDetailResult {
  sourceIndex: number;
  sourceName: string;
  video: Video | null;
  error?: string;
}

/** 从多个视频源搜索并返回匹配结果 */
export async function searchVideoFromMultipleSources(
  sourceIndices: number[],
  title: string,
  _year?: number,
): Promise<VideoDetailResult[]> {
  const sources = await getVideoSources();
  const results: VideoDetailResult[] = [];
  const searchTerm = title;

  for (const index of sourceIndices) {
    const source = sources[index];
    if (!source) {
      results.push({ sourceIndex: index, sourceName: '未知', video: null, error: '源配置不存在' });
      continue;
    }

    try {
      const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(searchTerm)}`;
      const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true });
      if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
        results.push({ sourceIndex: index, sourceName: source.name, video: null, error: '未找到匹配资源' });
        continue;
      }
      const match = data.list.find((item: CMSVideoItem) => {
        const t = item.vod_name || '';
        return t === title || t.includes(title) || title.includes(t);
      });
      const target = match || data.list[0];
      if (!target) {
        results.push({ sourceIndex: index, sourceName: source.name, video: null, error: '未找到匹配资源' });
        continue;
      }
      if (target.vod_play_from && target.vod_play_url) {
        const { sources: playSources, episodes } = parsePlaySources(
          target.vod_play_from, target.vod_play_url
        );
        results.push({
          sourceIndex: index,
          sourceName: source.name,
          video: { ...mapVideoItem(target), sources: playSources, episodes },
        });
      } else {
        const detailUrl = `${source.api}?ac=detail&vod_id=${target.vod_id}`;
        const detailData = await getJSON<CMSListResponse>(detailUrl, { useProxy: true });
        const detailItem = detailData.list?.[0];
        if (detailItem) {
          const { sources: playSources, episodes } = parsePlaySources(
            detailItem.vod_play_from || '', detailItem.vod_play_url || ''
          );
          results.push({
            sourceIndex: index,
            sourceName: source.name,
            video: { ...mapVideoItem(detailItem), sources: playSources, episodes },
          });
        } else {
          results.push({
            sourceIndex: index,
            sourceName: source.name,
            video: { ...mapVideoItem(target), sources: [], episodes: undefined },
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ sourceIndex: index, sourceName: source.name, video: null, error: message || '请求失败' });
    }
  }

  return results;
}

/** 按标题在可用视频源中搜索视频 */
export async function searchVideoByTitle(title: string, _year?: number): Promise<Video | null> {
  const sources = await getVideoSources();
  if (sources.length === 0) return null;

  let sourceIndex = 0;
  try {
    const stored = localStorage.getItem('app-settings');
    if (stored) sourceIndex = JSON.parse(stored)?.state?.videoSourceIndex ?? 0;
  } catch { /* 读取设置失败时使用默认值 0 */ }

  const searchTerm = title;

  const trySearch = async (index: number): Promise<Video | null> => {
    const source = sources[index];
    if (!source) return null;
    try {
      const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(searchTerm)}`;
      const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true });
      if (!data.list || !Array.isArray(data.list) || data.list.length === 0) return null;
      const match = data.list.find((item: CMSVideoItem) => {
        const t = item.vod_name || '';
        return t === title || t.includes(title) || title.includes(t);
      });
      return match ? mapVideoItem(match) : mapVideoItem(data.list[0]);
    } catch {
      return null;
    }
  };

  let result = await trySearch(sourceIndex);
  if (result) return result;

  for (let i = 0; i < Math.min(sources.length, 5); i++) {
    if (i === sourceIndex) continue;
    result = await trySearch(i);
    if (result) return result;
  }
  return null;
}

/** 获取指定 IPTV 源的播放地址 */
export async function fetchIPTVUrl(sourceIndex: number): Promise<string> {
  const sources = await getIPTVSources();
  const source = sources[sourceIndex];
  return source?.url || sources[0]?.url || '';
}
