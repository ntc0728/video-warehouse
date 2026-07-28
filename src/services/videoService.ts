/**
 * 视频数据服务
 * 负责从多个视频源（CMS 采集站 API）获取视频列表和详情
 * 通过统一 httpClient（axios）统一处理 缓存 / 超时 / 重试
 */
import type { Video, VideoType, Episode } from '@/types/video';
import type { VideoSourceConfig } from '@/types/source';
import { getVideoSources, getIPTVSources } from './sourceService';
import { getJSON } from './httpClient';
import { extractSeasonNumber } from './seasonMatcher';
import { parsePlaySources } from './vodParser';

export { getVideoSources };
export { parsePlaySources } from './vodParser';

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
  type_id?: number | string;
  type_id_1?: number | string;
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

/**
 * 从 CMS item 中解析 VideoType，优先使用 vod_type，
 * 缺失时回退到 type_id_1（父分类）→ type_id（子分类）。
 */
function getCmsVodType(item: CMSVideoItem): VideoType | undefined {
  return mapVodType(item.vod_type) ?? mapVodType(item.type_id_1) ?? mapVodType(item.type_id);
}

/**
 * 检查单个视频源是否可用
 *
 * 通过调用 CMS API 的列表接口，验证视频源是否可访问且返回格式正确。
 * 用于源检测页面和视频源选择逻辑。
 *
 * @param sourceIndex - 视频源配置索引（在 video-sources.json 中的位置）
 * @param timeout - 请求超时时间（毫秒），默认 8000ms
 * @returns 源状态（是否可用 + 错误信息）
 */
export async function checkVideoSourceAvailability(
  sourceIndex: number,
  timeout: number = 8000,
  sources?: VideoSourceConfig[],
): Promise<SourceStatus> {
  /** 获取所有视频源配置（外部已有时跳过） */
  const allSources = sources ?? await getVideoSources();
  /** 获取指定索引的视频源 */
  const source = allSources[sourceIndex];

  if (!source) {
    return { index: sourceIndex, name: '未知', available: false, error: '视频源配置不存在' };
  }

  try {
    /** 请求 CMS 列表接口（通过 CORS 代理） */
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
      const status = await checkVideoSourceAvailability(i, timeout, sources);
      const elapsed = Date.now() - start;

      let videoCount: number | undefined;
      if (status.available) {
        try {
          const result = await fetchVideosBySource(i, sources);
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
    const status = await checkVideoSourceAvailability(preferredIndex, timeout, sources);
    if (status.available) return { index: preferredIndex, name: sources[preferredIndex].name };
  }

  for (let i = 0; i < sources.length; i++) {
    if (i === preferredIndex) continue;
    const status = await checkVideoSourceAvailability(i, timeout, sources);
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
    type: getCmsVodType(item) ?? 'movie',
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

/**
 * 从 CMS item 解析播放源；若 vod_play_url 为空或解析结果为空，
 * 通过详情接口（ac=videolist&ids=）回退获取完整数据。
 * 返回解析出的 sources / episodes 以及最终使用的 CMS item（可能是详情接口返回的）。
 */
async function resolvePlaySources(
  api: string,
  item: CMSVideoItem,
  signal?: AbortSignal,
  /** 强制按剧集解析：跳过「多集误判为电影线路」的后置转换，确保集数保留 */
  forceSeries = false,
): Promise<{ sources: Video['sources']; episodes: Video['episodes'] | undefined; item: CMSVideoItem }> {
  // 剧集搜索时 item 已按季号识别，强制以非 movie 类型解析，避免集数被转成线路
  const vodType = forceSeries ? undefined : getCmsVodType(item);
  // 1) 先尝试直接解析搜索结果中的 vod_play_url
  if (item.vod_play_url) {
    const parsed = parsePlaySources(item.vod_play_url, vodType);
    if (parsed.sources.length > 0 || (parsed.episodes?.length ?? 0) > 0) {
      return { ...parsed, item };
    }
  }
  // 2) 解析为空时，通过详情接口获取完整 vod_play_url
  try {
    const detailUrl = `${api}?ac=videolist&ids=${item.vod_id}`;
    const detailData = await getJSON<CMSListResponse>(detailUrl, { useProxy: true, signal });
    const detailItem = detailData.list?.[0];
    if (detailItem) {
      const parsed = parsePlaySources(detailItem.vod_play_url || '', vodType);
      return { ...parsed, item: detailItem };
    }
  } catch { /* fall through to empty result */ }
  return { sources: [], episodes: undefined, item };
}

/**
 * 从指定视频源获取视频列表
 *
 * 调用 CMS API 的列表接口，获取视频源的第一页视频列表。
 * 用于设置页的视频源预览和源检测。
 *
 * @param sourceIndex - 视频源配置索引
 * @returns 视频列表和源信息，或错误信息
 */
export async function fetchVideosBySource(
  sourceIndex: number,
  sources?: VideoSourceConfig[],
): Promise<{
  /** 视频列表 */
  videos: Video[];
  /** 源信息（索引和名称） */
  sourceInfo?: { index: number; name: string };
  /** 错误信息（请求失败时） */
  error?: string;
}> {
  /** 获取所有视频源配置（外部已有时跳过） */
  const allSources = sources ?? await getVideoSources();
  /** 获取指定索引的视频源 */
  const source = allSources[sourceIndex];
  if (!source) return { videos: [], error: '未找到配置的视频源' };

  try {
    /** 请求 CMS 列表接口（15 秒超时） */
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

/** 获取单个视频的详情信息（含播放源和分集） */
/**
 * 从指定 CMS 源获取视频详情
 *
 * 通过 CMS API 的 ac=videolist&ids= 接口获取视频详情，
 * 包括播放源（sources）和集数列表（episodes）。
 *
 * @param sourceIndex - CMS 源配置索引（在 video-sources.json 中的位置）
 * @param videoId - CMS 源的视频 ID（vod_id）
 * @param signal - AbortSignal，用于取消请求（离开页面时调用）
 * @returns 视频数据，包含 sources 和 episodes；请求失败或被取消时返回 null
 */
export async function fetchVideoDetail(sourceIndex: number, videoId: string, signal?: AbortSignal): Promise<Video | null> {
  /** 获取所有 CMS 源配置 */
  const sources = await getVideoSources();
  /** 获取指定索引的 CMS 源 */
  const source = sources[sourceIndex];
  if (!source) return null;

  try {
    /** CMS 详情接口 URL */
    const detailUrl = `${source.api}?ac=videolist&ids=${videoId}`;
    /** 请求 CMS 详情接口（传递 signal 支持取消） */
    const data = await getJSON<CMSListResponse>(detailUrl, { useProxy: true, signal });
    // 请求完成后检查是否已取消
    if (signal?.aborted) return null;
    if (data.list && Array.isArray(data.list) && data.list.length > 0) {
      const item = data.list[0];
      /** 解析播放源和集数 */
      const { sources: playSources, episodes } = parsePlaySources(item.vod_play_url || '', getCmsVodType(item));
      return { ...mapVideoItem(item), sources: playSources, episodes };
    }
  } catch (error) {
    // 请求被取消时静默返回 null，不打印错误日志
    if (signal?.aborted) return null;
    console.warn(`从 ${source.name} 获取视频详情失败:`, error);
  }
  return null;
}

export interface VideoDetailResult {
  sourceIndex: number;
  sourceId: string;
  sourceName: string;
  video: Video | null;
  error?: string;
}

/** 从多个视频源搜索并返回匹配结果（并行搜索） */
export async function searchVideoFromMultipleSources(
  sourceIndices: number[],
  title: string,
  year?: number,
  signal?: AbortSignal,
): Promise<VideoDetailResult[]> {
  const sources = await getVideoSources();
  const searchTerm = title;

  // 并行搜索所有源
  const settled = await Promise.allSettled(
    sourceIndices.map(async (index) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const source = sources[index];
      if (!source) {
        return { sourceIndex: index, sourceId: '', sourceName: '未知', video: null, error: '源配置不存在' } as VideoDetailResult;
      }

      try {
        const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(searchTerm)}${year ? `&year=${year}` : ''}`;
        const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true, signal });
        if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
          return { sourceIndex: index, sourceId: source.id, sourceName: source.name, video: null, error: '未找到匹配资源' } as VideoDetailResult;
        }
        const match = data.list.find((item: CMSVideoItem) => {
          const t = item.vod_name || '';
          return t === title || t.includes(title) || title.includes(t);
        });
        const target = match || data.list[0];
        if (!target) {
          return { sourceIndex: index, sourceId: source.id, sourceName: source.name, video: null, error: '未找到匹配资源' } as VideoDetailResult;
        }
        const resolved = await resolvePlaySources(source.api, target, signal);
        return {
          sourceIndex: index,
          sourceId: source.id,
          sourceName: source.name,
          video: { ...mapVideoItem(resolved.item), sources: resolved.sources, episodes: resolved.episodes },
        } as VideoDetailResult;
      } catch (error) {
        if (signal?.aborted) throw error;
        const message = error instanceof Error ? error.message : String(error);
        return { sourceIndex: index, sourceId: source.id, sourceName: source.name, video: null, error: message || '请求失败' } as VideoDetailResult;
      }
    })
  );

  return settled.map((r, i) =>
    r.status === 'fulfilled' ? r.value : {
      sourceIndex: sourceIndices[i],
      sourceId: '',
      sourceName: '未知',
      video: null,
      error: r.reason instanceof Error ? r.reason.message : '请求失败',
    }
  );
}

/**
 * 在指定的单个 CMS 源中搜索视频
 *
 * 通过 CMS API 的 ac=videolist&wd= 接口搜索视频，
 * 支持模糊匹配标题，返回最匹配的视频结果。
 *
 * @param sourceIndex - CMS 源配置索引
 * @param title - 搜索标题（视频名称）
 * @param _year - 年份（当前未使用，预留）
 * @param signal - AbortSignal，用于取消请求
 * @returns 搜索结果，包含视频数据或错误信息
 */
export async function searchVideoFromSingleSource(
  sourceIndex: number,
  title: string,
  _year?: number,
  signal?: AbortSignal,
): Promise<VideoDetailResult> {
  /** 获取所有 CMS 源配置 */
  const sources = await getVideoSources();
  /** 获取指定索引的 CMS 源 */
  const source = sources[sourceIndex];
  if (!source) {
    return { sourceIndex, sourceId: '', sourceName: '未知', video: null, error: '源配置不存在' };
  }

  try {
    /** CMS 搜索接口 URL */
    const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(title)}`;
    /** 请求 CMS 搜索接口（传递 signal 支持取消） */
    const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true, signal });
    // 请求完成后检查是否已取消
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return { sourceIndex, sourceId: source.id, sourceName: source.name, video: null, error: '未找到匹配资源' };
    }
    // 模糊匹配标题：完全匹配 > 包含关系
    const match = data.list.find((item: CMSVideoItem) => {
      const t = item.vod_name || '';
      return t === title || t.includes(title) || title.includes(t);
    });
    /** 匹配到的视频（优先精确匹配，否则取第一条） */
    const target = match || data.list[0];
    if (!target) {
      return { sourceIndex, sourceId: source.id, sourceName: source.name, video: null, error: '未找到匹配资源' };
    }
    /** 解析播放源和集数（传递 signal 支持取消） */
    const resolved = await resolvePlaySources(source.api, target, signal);
    return {
      sourceIndex,
      sourceId: source.id,
      sourceName: source.name,
      video: { ...mapVideoItem(resolved.item), sources: resolved.sources, episodes: resolved.episodes },
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { sourceIndex, sourceId: source.id, sourceName: source.name, video: null, error: message || '请求失败' };
  }
}

/** CMS 单源搜索结果（多条） */
export interface CMSSearchAllResult {
  sourceIndex: number;
  sourceId: string;
  sourceName: string;
  items: Video[];
  page: number;
  total: number;
  error?: string;
}

/**
 * 搜索 CMS 源并返回所有匹配结果（不分页，返回第一页全部）。
 * 用于 Browse 页直链搜索模式。
 */
export async function searchAllFromCMSSource(
  sourceIndex: number,
  title: string,
  page = 1,
  opts?: { signal?: AbortSignal },
): Promise<CMSSearchAllResult> {
  const sources = await getVideoSources();
  const source = sources[sourceIndex];
  if (!source) {
    return { sourceIndex, sourceId: '', sourceName: '未知', items: [], page: 1, total: 0, error: '源配置不存在' };
  }

  try {
    const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(title)}&pg=${page}`;
    const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true, signal: opts?.signal });
    if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return { sourceIndex, sourceId: source.id, sourceName: source.name, items: [], page, total: data.total ?? 0, error: '未找到匹配资源' };
    }

    const items: Video[] = data.list.map(item => {
      const { sources: playSources, episodes } = parsePlaySources(item.vod_play_url || '', getCmsVodType(item));
      return { ...mapVideoItem(item), sources: playSources, episodes };
    });

    return { sourceIndex, sourceId: source.id, sourceName: source.name, items, page, total: data.total ?? 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sourceIndex, sourceId: source.id, sourceName: source.name, items: [], page, total: 0, error: message || '请求失败' };
  }
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

/** 按季搜索 CMS 源的结果：季号 → Video 映射 */
export interface SeasonSearchResult {
  sourceIndex: number;
  sourceId: string;
  sourceName: string;
  /** 季号 → Video 映射（无季号的条目不包含在内） */
  seasons: Map<number, Video>;
  error?: string;
}

/**
 * 搜索 CMS 源并返回按季分组的结果
 *
 * CMS 采集站把每季存为独立 vod 条目（如"超人前传第二季"），
 * 本函数搜索标题后将结果按季号映射，切换选季时无需重新调用 API。
 *
 * @param sourceIndex - CMS 源配置索引
 * @param title - 搜索标题（剧集名称，不含季号）
 * @param _year - 年份（当前未使用，预留）
 * @param signal - AbortSignal，用于取消请求
 * @returns 按季分组的搜索结果
 */
export async function searchVideoSeasonsFromSingleSource(
  sourceIndex: number,
  title: string,
  _year?: number,
  signal?: AbortSignal,
): Promise<SeasonSearchResult> {
  /** 获取所有 CMS 源配置 */
  const sources = await getVideoSources();
  /** 获取指定索引的 CMS 源 */
  const source = sources[sourceIndex];
  if (!source) {
    return { sourceIndex, sourceId: '', sourceName: '未知', seasons: new Map(), error: '源配置不存在' };
  }

  try {
    /** CMS 搜索接口 URL */
    const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(title)}`;
    /** 请求 CMS 搜索接口（传递 signal 支持取消） */
    const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true, signal });
    // 请求完成后检查是否已取消
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return { sourceIndex, sourceId: source.id, sourceName: source.name, seasons: new Map(), error: '未找到匹配资源' };
    }

    /** 季号 → Video 映射（用于切换选季时快速查找） */
    const seasons = new Map<number, Video>();
    /** 无季号条目候选：CMS 常见「单条目收录全集」或「第一季直接以裸剧名收录」 */
    let fallbackItem: CMSVideoItem | undefined;
    let fallbackExact = false;
    for (const item of data.list) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const vodName = item.vod_name ?? '';
      const seasonNumber = extractSeasonNumber(vodName);
      if (seasonNumber === undefined) {
        // 记录无季号条目作为第 1 季回退候选；名称与搜索标题完全一致的优先
        const exact = vodName.trim() === title.trim();
        if (!fallbackItem || (exact && !fallbackExact)) {
          fallbackItem = item;
          fallbackExact = exact;
        }
        continue;
      }
      if (seasons.has(seasonNumber)) continue;

      // 先尝试解析搜索结果，若为空再通过详情接口回退（forceSeries：季条目按剧集解析，保留集数）
      const resolved = await resolvePlaySources(source.api, item, signal, true);
      seasons.set(seasonNumber, { ...mapVideoItem(resolved.item), sources: resolved.sources, episodes: resolved.episodes });
    }

    // 第 1 季缺失时用无季号条目补位，避免整个映射为空（单条目多集）
    // 或第一季永远缺失（第一季裸剧名、后续季带"第X季"的收录习惯）
    if (fallbackItem && !seasons.has(1)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const resolved = await resolvePlaySources(source.api, fallbackItem, signal, true);
      if ((resolved.episodes?.length ?? 0) > 0 || resolved.sources.length > 0) {
        seasons.set(1, { ...mapVideoItem(resolved.item), sources: resolved.sources, episodes: resolved.episodes });
      }
    }

    return { sourceIndex, sourceId: source.id, sourceName: source.name, seasons };
  } catch (error) {
    if (signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { sourceIndex, sourceId: source.id, sourceName: source.name, seasons: new Map(), error: message || '请求失败' };
  }
}

/**
 * 按集号在剧集列表中查找匹配的集。
 * CMS 源切换后集 ID 不同，但集号（number）一致即可匹配。
 */
export function findEpisodeByNumber(episodes: Episode[], targetNumber: number) {
  return episodes.find(ep => ep.number === targetNumber);
}

/**
 * 将 CMS 搜索到的 seasonMap 转换为 PlayerSeasonPanel 所需的格式。
 */
export function buildCmsSeasons(
  seasonMap: Map<number, { episodes?: Episode[] }>,
): { season_number: number; name: string; episode_count: number }[] {
  return Array.from(seasonMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, video]) => ({
      season_number: num,
      name: `第${num}季`,
      episode_count: video.episodes?.length ?? 0,
    }));
}
