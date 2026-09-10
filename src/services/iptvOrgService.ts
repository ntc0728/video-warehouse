/**
 * iptv-org 数据层（2026-09-08 方案 B 定稿：17MB 三 JSON 瘦身）
 *
 * 主干 = iptv/countries/cn.m3u（单文件 ~28KB / 144 条，毫秒级）：
 *  - 每条自带 tvg-id（= iptv-org channel id）、tvg-logo（台标，与 logos.json 同源同值）、
 *    group-title（英文分类）、显示名（英文，可能带 "(720p)" 画质后缀）、url（播放流）。
 *  - streams.json / logos.json 彻底退役（原 9.1MB raw 不再拉取）。
 * 中文名 = api/channels.json 的 alt_names（CN 有流频道 99/149 有中文名）：
 *  - 后台拉取 + IndexedDB 落盘 7 天；拉到前主干显示英文名，拉到后由 store 替换 name。
 * 恒直连（GitHub Pages 原生 CORS）；失败经 IPTV 代理重试一次（6s 超时，用户定稿）。
 *
 * 定位：本模块是「可拆附件」——任何异常都降级（返回空 / 抛给调用方由调用方兜底），
 * 本地 M3U 聚合源永远可以作为独立主干运行（见 useIPTVStore.refreshChannels 合并策略）。
 */

import type { IPTVChannel } from '@/types/iptv';
import { normalizeName } from '@/services/epgService';
import { buildSourceProxyUrl } from '@/services/iptvService';
import {
  getCachedIptvOrgChannels,
  setCachedIptvOrgChannels,
  isIptvOrgCacheFresh,
  getCachedIptvOrgCnNames,
  setCachedIptvOrgCnNames,
  isIptvOrgCnNamesFresh,
} from '@/services/database';

const M3U_URL = 'https://iptv-org.github.io/iptv/countries/cn.m3u';
const API_BASE = 'https://iptv-org.github.io/api';
/**
 * 单个接口超时上限（2026-09-08 用户定稿）：IPTV 所有接口超时不得超过 6s，超过即判失败。
 * cn.m3u 仅 28KB 毫秒级；channels.json（gzip 0.98MB）仅中文名增强时后台拉取。
 */
const FETCH_TIMEOUT_MS = 6000;

/** iptv-org channels.json 频道条目（仅中文名增强消费的字段） */
interface OrgApiChannel {
  id: string;
  name: string;
  alt_names?: string[];
  country: string;
}

/** cn.m3u 单条频道（EXTINF 解析结果） */
export interface CnM3UEntry {
  /** tvg-id（= iptv-org channel id，如 'CCTV1.cn@HD'）；缺失时用显示名兜底 */
  id: string;
  /** 显示名（已剥 "(720p)" 画质后缀） */
  name: string;
  /** 台标 URL（tvg-logo） */
  logo?: string;
  /** 英文分类（group-title 原值） */
  group?: string;
  /** 播放流 URL */
  url: string;
  /** 画质（显示名 "(720p)" 后缀提取） */
  quality?: string;
}

/** 组装后的 iptv-org 主干频道（合并前的中间形态） */
export interface OrgChinaChannel {
  /** iptv-org 频道 id（如 'CCTV1.cn@HD'），稳定键 */
  id: string;
  /** 展示名（中文名缓存命中则中文，否则 cn.m3u 英文名） */
  name: string;
  /** 原始英文名（搜索辅助） */
  nameEn: string;
  /** 备用名（搜索辅助） */
  altNames: string[];
  /** 台标 URL（cn.m3u tvg-logo） */
  logo?: string;
  /** 播放流 URL（cn.m3u） */
  url: string;
  /** 画质（显示名后缀提取） */
  quality?: string;
  /** 中文分类（group-title 映射，单个） */
  group: string;
}

/** 分类英文 → 中文映射（demo categoryNames 扩充版）；未映射分类取英文原文 */
const CATEGORY_ZH: Record<string, string> = {
  general: '综合',
  news: '新闻',
  sports: '体育',
  movies: '电影',
  series: '电视剧',
  kids: '少儿',
  music: '音乐',
  documentary: '纪录片',
  entertainment: '娱乐',
  lifestyle: '生活',
  education: '教育',
  shop: '购物',
  religious: '宗教',
  business: '商业',
  culture: '文化',
  legislative: '政务',
  weather: '天气',
  animation: '动漫',
  travel: '旅游',
  cooking: '美食',
  science: '科普',
  auto: '汽车',
  outdoor: '户外',
};

const CJK_RE = /[\u4e00-\u9fa5]/;
/** 主干频道 id 前缀（避免与本地源频道 id 冲突） */
export const ORG_ID_PREFIX = 'iptvorg-';

// ── 网络层：6s 超时 + 代理重试一次 ──────────────────────────

/** 单次文本拉取（6s 超时）；非 2xx 抛错 */
async function fetchOnceText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`iptv-org HTTP ${res.status}`);
  return res.text();
}

/** 单次 JSON 拉取（6s 超时）；非 2xx 抛错 */
async function fetchOnceJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`iptv-org HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * 直连 + 一次代理兜底重试的通用拉取。首次直连 iptv-org.github.io；
 * 失败（超时/非 2xx/网络错误）时若配置了 IPTV 代理则经代理重试一次——只重试一次。
 */
async function fetchWithFallback<T>(
  url: string,
  once: (u: string) => Promise<T>,
  proxyUrl?: string
): Promise<T> {
  try {
    return await once(url);
  } catch (firstErr) {
    if (!proxyUrl) throw firstErr;
    const viaProxy = buildSourceProxyUrl(url, proxyUrl);
    if (viaProxy === url) throw firstErr; // 代理不可用：不再重试
    return once(viaProxy);
  }
}

// ── cn.m3u 解析与组装 ──────────────────────────────────────

/**
 * 解析 cn.m3u 文本 → 频道条目数组。
 * 格式：`#EXTINF:-1 tvg-id="X" tvg-logo="Y" group-title="Z",显示名 (720p)` + 下一行 URL。
 */
export function parseCnM3U(text: string): CnM3UEntry[] {
  const out: CnM3UEntry[] = [];
  let cur: Omit<CnM3UEntry, 'url'> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const title = line.slice(line.lastIndexOf(',') + 1).trim();
      const quality = title.match(/\((\d+p)\)\s*$/i)?.[1];
      const name = title.replace(/\s*\(\d+p\)\s*$/i, '').trim();
      cur = {
        id: line.match(/tvg-id="([^"]*)"/)?.[1]?.trim() || name,
        name,
        logo: line.match(/tvg-logo="([^"]*)"/)?.[1] || undefined,
        group: line.match(/group-title="([^"]*)"/)?.[1] || undefined,
        quality,
      };
    } else if (!line.startsWith('#')) {
      if (cur) {
        out.push({ ...cur, url: line });
        cur = null;
      }
    }
  }
  return out.filter((e) => e.id && e.url);
}

/** group-title（英文）→ 中文分组名；缺失或 Undefined → '其他' */
export function groupTitleToZh(title?: string): string {
  if (!title || title === 'Undefined') return '其他';
  return CATEGORY_ZH[title.toLowerCase()] ?? title;
}

/**
 * 组装单个 iptv-org 主干频道 → IPTVChannel。
 * id 用 `iptvorg-` 前缀 + tvg-id，避免与本地源频道 id 冲突；
 * url 先放 cn.m3u 流 —— store 合并时若命中本地源同名频道，会改为本地流（本地源优先）。
 */
export function toIPTVChannelFromApi(ch: OrgChinaChannel): IPTVChannel {
  return {
    id: `${ORG_ID_PREFIX}${ch.id}`,
    name: ch.name,
    logo: ch.logo,
    url: ch.url,
    group: ch.group,
    tvgId: ch.id,
    name_en: ch.nameEn,
    altNames: ch.altNames,
    categories: [ch.group],
    country: 'CN',
    quality: ch.quality,
    // 标记 iptv-org 主干来源：播放链接一律直连不拼代理（cn.m3u 原始流）
    sourceId: 'iptvorg',
  };
}

/**
 * 由 cn.m3u 条目 + 中文名映射组装主干频道与台标名称索引。
 * 中文名：中文名缓存命中（names[id]）则显示中文，否则 cn.m3u 英文名。
 */
export function buildOrgChannels(
  entries: CnM3UEntry[],
  names: Record<string, string>
): { channels: IPTVChannel[]; nameIndex: Map<string, string> } {
  const channels: IPTVChannel[] = [];
  const nameIndex = new Map<string, string>();
  for (const e of entries) {
    const zh = names[e.id];
    channels.push(
      toIPTVChannelFromApi({
        id: e.id,
        name: zh || e.name,
        nameEn: e.name,
        altNames: [],
        logo: e.logo,
        url: e.url,
        quality: e.quality,
        group: groupTitleToZh(e.group),
      })
    );
    // 台标名称索引（供更多台本地源频道按名匹配）：中文名/英文名/tvgId 全部建键
    if (e.logo) {
      for (const key of channelMatchKeys({ name: zh || e.name, name_en: e.name, altNames: [] })) {
        if (!nameIndex.has(key)) nameIndex.set(key, e.logo);
      }
      if (!nameIndex.has(e.id)) nameIndex.set(e.id, e.logo);
    }
  }
  return { channels, nameIndex };
}

// ── 缓存状态 ──────────────────────────────────────────────

/** 模块级内存缓存：同会话内重复 refresh 不重新下载（失败不缓存，下次重拉） */
let memoryCache: OrgChinaResult | null = null;

/** 中文名内存缓存（channel id → 中文名）；null = 尚未从磁盘加载 */
let cnNames: Record<string, string> | null = null;

/**
 * 台标名称索引（规范化频道名 → 台标 URL）。
 * 供「更多台」本地源频道按名匹配台标（它们没有 iptv-org channel id，无法走 id 精确匹配）。
 * 键来源：tvgId + 中文名 + 英文名（normalizeName 规范化）。
 */
let logoByName: Map<string, string> | null = null;

/**
 * 按频道名匹配台标（供本地源 / 更多台频道使用，cn.m3u tvg-logo 一级来源）。
 * 匹配不到返回 undefined → 调用方用 iptv 源自带台标兜底。
 */
export function matchLogoForChannel(ch: Pick<IPTVChannel, 'name' | 'name_en' | 'altNames'>): string | undefined {
  if (!logoByName || logoByName.size === 0) return undefined;
  for (const key of channelMatchKeys(ch)) {
    const hit = logoByName.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/** 从磁盘加载中文名缓存（内存命中直接返回） */
async function loadCnNames(): Promise<Record<string, string>> {
  if (cnNames) return cnNames;
  try {
    const cached = await getCachedIptvOrgCnNames();
    cnNames = cached?.names ?? {};
  } catch { cnNames = {}; }
  return cnNames;
}

/** 组装后的结果（供 store 合并） */
export interface OrgChinaResult {
  /** 组装好的 IPTVChannel（url = cn.m3u 流） */
  channels: IPTVChannel[];
}

/**
 * 拉取并组装 iptv-org 中国频道主干（cn.m3u 单文件 28KB）。
 * 缓存策略：内存 → 磁盘（7 天 TTL，过期先返回旧数据渲染再走网络刷新，失败兜底旧数据）→ 网络。
 * cn.m3u 拉取失败且无任何缓存 → 抛错（调用方回退纯本地主干）。
 * @param proxyUrl IPTV 代理地址：直连失败时用于重试一次（仅重试一次）
 */
export async function fetchIptvOrgChinaChannels(proxyUrl?: string): Promise<OrgChinaResult> {
  if (memoryCache) return memoryCache;

  // ① 磁盘缓存兜底：首屏/弱网先用缓存秒出（6s 超时下直接拉 API 很可能失败，
  //    此前无磁盘缓存 → 一超时就整体回退本地 M3U 源，即「用 iptv 源兜底」现象）
  try {
    const cached = await getCachedIptvOrgChannels();
    if (cached && cached.channels.length > 0) {
      logoByName = new Map(Object.entries(cached.logoByName));
      // 套用中文名缓存（磁盘主干里的 name 可能还是上次的英文名）
      const names = await loadCnNames();
      if (Object.keys(names).length > 0) {
        memoryCache = { channels: applyNamesToChannels(cached.channels, names) };
      } else {
        memoryCache = { channels: cached.channels };
      }
      if (isIptvOrgCacheFresh(cached.timestamp)) return memoryCache;
      // 过期：继续走网络拿新数据；失败再用这份旧缓存兜底
    }
  } catch { /* 缓存不可用：继续走网络 */ }

  try {
    const text = await fetchWithFallback(M3U_URL, fetchOnceText, proxyUrl);
    const entries = parseCnM3U(text);
    if (entries.length === 0) throw new Error('cn.m3u 解析为空');
    const names = await loadCnNames();
    const { channels, nameIndex } = buildOrgChannels(entries, names);
    logoByName = nameIndex;
    const result: OrgChinaResult = { channels };
    memoryCache = result;
    void setCachedIptvOrgChannels({
      channels,
      logoByName: Object.fromEntries(nameIndex),
      timestamp: Date.now(),
    }).catch(() => {});
    return result;
  } catch (err) {
    // ② 网络失败（6s 超时 / 代理重试也失败）→ 用磁盘缓存兜底（含过期数据）
    if (memoryCache) return memoryCache;
    throw err;
  }
}

/** 把中文名映射套到主干频道 name 上（保留其他字段） */
function applyNamesToChannels(
  channels: IPTVChannel[],
  names: Record<string, string>
): IPTVChannel[] {
  return channels.map((ch) => {
    if (!ch.id.startsWith(ORG_ID_PREFIX)) return ch;
    const zh = names[ch.id.slice(ORG_ID_PREFIX.length)];
    return zh && zh !== ch.name ? { ...ch, name: zh } : ch;
  });
}

/**
 * 中文名增强（方案 B 后台层）：channels.json（gzip 0.98MB / raw 7.5MB）仅取
 * CN 频道的 alt_names 中文名，IndexedDB 落盘 7 天只拉一次。
 * 同时把中文名键补进台标名称索引（更多台匹配率提升）并回写主干磁盘缓存。
 *
 * @returns names = org channel id → 中文名（可能为空对象）；channels = 内存主干
 *          （name 已替换为中文名）。store 用 channels 重放本地流合并后 set。
 */
export async function fetchCnDisplayNames(proxyUrl?: string): Promise<{
  names: Record<string, string>;
  channels: IPTVChannel[];
}> {
  const names = await loadCnNames();
  let fresh = false;
  try {
    const cached = await getCachedIptvOrgCnNames();
    fresh = cached ? isIptvOrgCnNamesFresh(cached.timestamp) : false;
  } catch { /* 读不到视为过期 */ }

  if (!fresh) {
    try {
      const all = await fetchWithFallback(
        `${API_BASE}/channels.json`,
        fetchOnceJson<OrgApiChannel[]>,
        proxyUrl
      );
      const extracted: Record<string, string> = {};
      for (const ch of all) {
        if (ch.country !== 'CN') continue;
        const zh = (ch.alt_names ?? []).find((n) => CJK_RE.test(n));
        if (zh) extracted[ch.id] = zh;
      }
      if (Object.keys(extracted).length > 0) {
        cnNames = extracted;
        Object.assign(names, extracted);
        void setCachedIptvOrgCnNames({ names: extracted, timestamp: Date.now() }).catch(() => {});
      }
    } catch { /* 拉取失败：沿用旧缓存（可能为空），主干保持英文名 */ }
  }

  if (Object.keys(names).length === 0) return { names: {}, channels: [] };

  // 更新内存主干 + 台标名称索引中文键
  let changed = false;
  if (memoryCache) {
    const next = applyNamesToChannels(memoryCache.channels, names);
    changed = next.some((ch, i) => ch.name !== memoryCache!.channels[i].name);
    memoryCache = { channels: next };
    if (logoByName) {
      for (const ch of next) {
        if (!ch.logo) continue;
        for (const key of channelMatchKeys(ch)) {
          if (!logoByName.has(key)) logoByName.set(key, ch.logo);
        }
      }
    }
    if (changed) {
      void setCachedIptvOrgChannels({
        channels: next,
        logoByName: Object.fromEntries(logoByName ?? new Map()),
        timestamp: Date.now(),
      }).catch(() => {});
    }
  }
  return { names, channels: memoryCache?.channels ?? [] };
}

/** 清空内存缓存（供 clearAllCaches / 测试使用） */
export function resetIptvOrgApiCacheInMemory(): void {
  memoryCache = null;
  logoByName = null;
  cnNames = null;
}

/**
 * 本地源频道名 ↔ iptv-org 频道名的合并匹配键（双侧各生成键集合，任一相交即同一频道）。
 * normalizeName 会剥「卫视/台/频道/综合/高清」等冗余词：
 * 本地「CCTV-1 综合」→'cctv1' ↔ org「CCTV-1」→'cctv1'；「湖南卫视」→'湖南' ↔ org「湖南卫视」→'湖南'。
 */
export function channelMatchKeys(ch: Pick<IPTVChannel, 'name' | 'name_en' | 'altNames'>): Set<string> {
  const keys = new Set<string>();
  const add = (n?: string) => {
    const norm = normalizeName(n ?? '');
    if (norm) keys.add(norm);
  };
  add(ch.name);
  add(ch.name_en);
  for (const alt of ch.altNames ?? []) add(alt);
  return keys;
}
