/**
 * 数据源配置服务
 * 从本地 JSON 配置文件加载视频源、IPTV 源和 EPG 源的定义
 */
import type { VideoSourceConfig, IPTVSourceConfig, VideoSourcesData, EPGSourceConfig, ManagedVideoSource } from '@/types/source';
import { getJSON } from './httpClient';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

// 为向后兼容重新导出类型
export type { EPGSourceConfig } from '@/types/source';

const VIDEO_SOURCES_URL = '/data/video-sources.json';
const IPTV_SOURCES_URL = '/data/iptv-sources.json';
const EPG_SOURCES_URL = '/data/epg-sources.json';

// 内存缓存：避免同一会话内重复请求同一配置文件
let videoSourcesCache: VideoSourceConfig[] | null = null;
let iptvSourcesCache: IPTVSourceConfig[] | null = null;
let epgSourcesCache: EPGSourceConfig[] | null = null;
// in-flight promise：并发调用（bootstrap 与页面首次请求同时发生）共享同一 fetch，
// 避免「多页面同时获取 sources.json」的重复请求；完成后清空，失败可重试
let videoSourcesPromise: Promise<VideoSourceConfig[]> | null = null;
let iptvSourcesPromise: Promise<IPTVSourceConfig[]> | null = null;
let epgSourcesPromise: Promise<EPGSourceConfig[]> | null = null;

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

/** 去重（按 id；video 源） */
function uniqueById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    if (!x || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

/** 去重（按 url；iptv/epg 源） */
function uniqueByUrl<T extends { url: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    if (!x || seen.has(x.url)) continue;
    seen.add(x.url);
    out.push(x);
  }
  return out;
}

/**
 * 从持久化 SourceManager store 派生「启用的视频源」（含 custom）。
 * 原实现依赖 bootstrapScene→syncConsumers 写入的模块内存 attached，Player 等
 * 不触发 bootstrap 的页面在新会话中拿不到启用源 → 「保存下标指向 attached 段」全部失效。
 * 改为每次调用时从持久化 store 实时派生，合成数组会话内稳定，下标始终有效。
 */
function enabledVideoFromStore(): VideoSourceConfig[] {
  const s = useSourceManagerStore.getState();
  if (!s || !Array.isArray(s.video)) return [];
  return s.video
    .filter((v) => v?.status?.enabled)
    .sort((a, b) => a.order - b.order)
    .map((v) => {
      const meta = v as ManagedVideoSource & { timeoutMs?: number; retries?: number };
      return {
        id: v.id,
        name: v.name,
        api: v.api,
        detail: v.detail,
        timeoutMs: meta.timeoutMs,
        retries: meta.retries,
      };
    });
}

/** 从持久化 SourceManager store 派生「启用的 IPTV 源」（含 custom） */
function enabledIPTVFromStore(): IPTVSourceConfig[] {
  const s = useSourceManagerStore.getState();
  if (!s || !Array.isArray(s.iptv)) return [];
  return s.iptv
    .filter((v) => v?.status?.enabled)
    .sort((a, b) => a.order - b.order)
    .map((v) => ({ name: v.name, url: v.url }));
}

/** 从配置文件获取所有视频源列表（含启用 custom 源，合成数组） */
export function getVideoSources(): Promise<VideoSourceConfig[]> {
  const merged = () => uniqueById([...(videoSourcesCache ?? []), ...attachedVideoSources, ...enabledVideoFromStore()]);
  if (videoSourcesCache) return Promise.resolve(merged());
  if (!videoSourcesPromise) {
    videoSourcesPromise = (async () => {
      try {
        const data = await getJSON<VideoSourcesData>(VIDEO_SOURCES_URL);
        videoSourcesCache = Object.entries(data.api_site).map(([id, site]) => ({ ...site, id }));
      } catch (error) {
        console.error('加载视频源失败:', error);
      } finally {
        videoSourcesPromise = null;
      }
      return merged();
    })();
  }
  return videoSourcesPromise;
}

/** 从配置文件获取所有 IPTV 源列表（含启用 custom 源） */
export function getIPTVSources(): Promise<IPTVSourceConfig[]> {
  const merged = () => uniqueByUrl([...(iptvSourcesCache ?? []), ...attachedIPTVSources, ...enabledIPTVFromStore()]);
  if (iptvSourcesCache) return Promise.resolve(merged());
  if (!iptvSourcesPromise) {
    iptvSourcesPromise = (async () => {
      try {
        iptvSourcesCache = await getJSON<IPTVSourceConfig[]>(IPTV_SOURCES_URL);
      } catch (error) {
        console.error('加载 IPTV 源失败:', error);
      } finally {
        iptvSourcesPromise = null;
      }
      return merged();
    })();
  }
  return iptvSourcesPromise;
}

/** 从配置文件获取所有 EPG 节目单源列表（含附加 custom 源） */
export function getEPGSources(): Promise<EPGSourceConfig[]> {
  if (epgSourcesCache) return Promise.resolve([...epgSourcesCache, ...attachedEPGSources]);
  if (!epgSourcesPromise) {
    epgSourcesPromise = (async () => {
      try {
        epgSourcesCache = await getJSON<EPGSourceConfig[]>(EPG_SOURCES_URL);
      } catch (error) {
        console.error('加载 EPG 源失败:', error);
      } finally {
        epgSourcesPromise = null;
      }
      return [...(epgSourcesCache ?? []), ...attachedEPGSources];
    })();
  }
  return epgSourcesPromise;
}

/**
 * 解析「启用的视频源」在 getVideoSources() 合成数组中的下标。
 * ID 持久化（videoSourceIds）→ 按 ID 解析下标，替代旧的「保存 attached 段位置」逻辑。
 * settings 无 ID（从未 bootstrap）时回退从持久化 SourceManager store 派生，保证自定义源可用。
 */
export async function getEnabledVideoSourceIndices(): Promise<number[]> {
  let ids = useSettingsStore.getState().videoSourceIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    const s = useSourceManagerStore.getState();
    ids = s?.video?.filter((v) => v?.status?.enabled)?.sort((a, b) => a.order - b.order)?.map((v) => v.id) ?? [];
  }
  const sources = await getVideoSources();
  const indices = ids.map((id) => sources.findIndex((s) => s.id === id)).filter((i) => i >= 0);
  return indices.length > 0 ? indices : [0];
}

/** 解析「启用的 IPTV 源」在 getIPTVSources() 合成数组中的下标（ID = URL） */
export async function getEnabledIPTVSourceIndices(): Promise<number[]> {
  let ids = useSettingsStore.getState().iptvSourceIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    const s = useSourceManagerStore.getState();
    ids = s?.iptv?.filter((v) => v?.status?.enabled)?.sort((a, b) => a.order - b.order)?.map((v) => v.url) ?? [];
  }
  const sources = await getIPTVSources();
  const indices = ids.map((id) => sources.findIndex((s) => s.url === id)).filter((i) => i >= 0);
  return indices.length > 0 ? indices : [0];
}
