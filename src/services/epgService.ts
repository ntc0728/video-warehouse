import { useSettingsStore } from '@/stores';
import { getText } from './httpClient';
import { getDB } from './database';

const DEFAULT_EPG_URL = 'http://epg.51zmt.top:8000/e.xml';
const EPG_CACHE_DATA_KEY = 'epg-cache-data';
const EPG_CACHE_URLS_KEY = 'epg-cache-urls';
const EPG_CACHE_TIME_KEY = 'epg-cache-time';

export interface EPGProgram {
  title: string;
  start: Date;
  end: Date;
  /** 是否已过期（可用于回看） */
  isPast?: boolean;
  /** 是否正在播放 */
  isCurrent?: boolean;
  /** 是否未来节目 */
  isFuture?: boolean;
}

export interface EPGChannelInfo {
  id: string;
  name: string;
  /** XMLTV <icon src> 台标 URL（部分 EPG 源提供，可作频道台标回退来源） */
  icon?: string;
}

export interface ParsedEPGData {
  channels: EPGChannelInfo[];
  programmes: Map<string, EPGProgram[]>;
}

export interface ChannelProgramInfo {
  current: { title: string; start: string; end: string } | null;
  next: { title: string; start: string; end: string } | null;
}

interface SerializedEPGData {
  channels: EPGChannelInfo[];
  programmes: Record<string, Array<{ title: string; start: string; end: string }>>;
}

/** 解析 XMLTV 格式时间字符串为 Date 对象 */
function parseXmltvTime(timeStr: string): Date {
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})$/);
  if (!match) return new Date(timeStr);

  const [, y, M, d, h, m, s, tzH, tzM] = match;
  const tzOffset = parseInt(tzH, 10) * 60 + parseInt(tzM, 10);
  const utcDate = Date.UTC(+y, +M - 1, +d, +h, +m, +s);
  return new Date(utcDate - tzOffset * 60000);
}

/** 解析 XMLTV 格式的节目单 XML 数据 */
function parseXMLTV(xml: string): ParsedEPGData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const channels: EPGChannelInfo[] = [];
  const programmes = new Map<string, EPGProgram[]>();

  const channelNodes = doc.querySelectorAll('channel');
  channelNodes.forEach(node => {
    const id = node.getAttribute('id') || '';
    const displayName = node.querySelector('display-name');
    const name = displayName?.textContent?.trim() || id;
    // XMLTV 标准：<channel><icon src="..."/></channel>，作为频道台标回退来源
    const iconEl = node.querySelector('icon');
    const icon = iconEl?.getAttribute('src')?.trim() || undefined;
    channels.push({ id, name, icon });
  });

  const programmeNodes = doc.querySelectorAll('programme');
  programmeNodes.forEach(node => {
    const channelId = node.getAttribute('channel') || '';
    const startStr = node.getAttribute('start') || '';
    const stopStr = node.getAttribute('stop') || '';
    const titleEl = node.querySelector('title');
    const title = titleEl?.textContent?.trim() || '';

    if (!channelId || !startStr || !stopStr || !title) return;

    const start = parseXmltvTime(startStr);
    const end = parseXmltvTime(stopStr);

    if (!programmes.has(channelId)) {
      programmes.set(channelId, []);
    }
    programmes.get(channelId)!.push({ title, start, end });
  });

  programmes.forEach((progs) => {
    progs.sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  return { channels, programmes };
}

/** 合并两份 EPG 数据，去重并按时间排序 */
function mergeEPGData(existing: ParsedEPGData, newData: ParsedEPGData): ParsedEPGData {
  const mergedChannels = new Map(existing.channels.map(c => [c.id, c]));

  for (const channel of newData.channels) {
    if (!mergedChannels.has(channel.id)) {
      mergedChannels.set(channel.id, channel);
    }
  }

  const mergedProgrammes = new Map(existing.programmes);

  for (const [channelId, newProgs] of newData.programmes) {
    const existingProgs = mergedProgrammes.get(channelId) || [];
    const existingStartTimes = new Set(existingProgs.map(p => p.start.getTime()));

    const uniqueNewProgs = newProgs.filter(p => !existingStartTimes.has(p.start.getTime()));
    const merged = [...existingProgs, ...uniqueNewProgs].sort((a, b) => a.start.getTime() - b.start.getTime());
    mergedProgrammes.set(channelId, merged);
  }

  return {
    channels: Array.from(mergedChannels.values()),
    programmes: mergedProgrammes,
  };
}

/** 规范化频道名称，去除清晰度标记和冗余词汇以便匹配 */
export function normalizeName(name: string): string {
  return name
    // 去除清晰度/技术标记
    .replace(/高清|HD|标清|SD|4K|UHD|超清|极致|极速/gi, '')
    // 去除频道分类/冗余词
    .replace(/综合|频道|卫视|电视|台|HD|直播|轮播/gi, '')
    // 去除所有空白和连字符
    .replace(/[-\s]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * EPG 频道预索引：一次性构建后，单频道匹配从 O(n) 全量遍历降为 O(1) 查表。
 * 适用于「数百个频道 × 数千个 EPG 频道」的批量匹配场景（IPTV 页卡片台标、节目单）。
 */
export interface EPGChannelIndex {
  /** tvg-id → 频道 */
  byId: Map<string, EPGChannelInfo>;
  /** normalizeName → 首个频道 */
  byNormalizedName: Map<string, EPGChannelInfo>;
  /** 原始名 → 首个频道 */
  byRawName: Map<string, EPGChannelInfo>;
  /** 原始列表（模糊匹配兜底） */
  channels: EPGChannelInfo[];
}

/** 构建 EPG 频道预索引（O(n)），重复键保留首个 */
export function buildEPGChannelIndex(epgChannels: EPGChannelInfo[]): EPGChannelIndex {
  const byId = new Map<string, EPGChannelInfo>();
  const byNormalizedName = new Map<string, EPGChannelInfo>();
  const byRawName = new Map<string, EPGChannelInfo>();
  for (const ch of epgChannels) {
    if (ch.id && !byId.has(ch.id)) byId.set(ch.id, ch);
    const norm = normalizeName(ch.name);
    if (norm && !byNormalizedName.has(norm)) byNormalizedName.set(norm, ch);
    if (ch.name && !byRawName.has(ch.name)) byRawName.set(ch.name, ch);
  }
  return { byId, byNormalizedName, byRawName, channels: epgChannels };
}

/** 基于预索引匹配 M3U 频道（tvg-id 精确 → 规范化 → 原始名 → 模糊兜底） */
export function matchEPGChannelIndexed(
  channelName: string,
  tvgId: string | undefined,
  index: EPGChannelIndex
): EPGChannelInfo | null {
  // 优先使用 tvg-id 精确匹配
  if (tvgId) {
    const exactMatch = index.byId.get(tvgId);
    if (exactMatch) return exactMatch;
  }

  // 规范化名称匹配（O(1)）
  const normalized = normalizeName(channelName);
  if (normalized) {
    const byNorm = index.byNormalizedName.get(normalized);
    if (byNorm) return byNorm;
  }

  // 精确字符串匹配（O(1)）
  const byRaw = index.byRawName.get(channelName);
  if (byRaw) return byRaw;

  // 模糊匹配：名称包含关系（触发率低，线性扫描可接受）
  // 空名直接返回 null——空串是任何字符串的子串，`includes('')` 恒真会误匹配首个频道
  if (!normalized) return null;
  for (const epgCh of index.channels) {
    const epgNameNormalized = normalizeName(epgCh.name);
    if (epgNameNormalized.includes(normalized) || normalized.includes(epgNameNormalized)) {
      return epgCh;
    }
  }

  return null;
}

/** 将 M3U 频道与 EPG 频道进行匹配（支持 tvg-id 精确、规范化、模糊匹配） */
export function matchEPGChannel(
  channelName: string,
  tvgId: string | undefined,
  epgChannels: EPGChannelInfo[]
): EPGChannelInfo | null {
  if (!epgChannels || epgChannels.length === 0) return null;
  return matchEPGChannelIndexed(channelName, tvgId, buildEPGChannelIndex(epgChannels));
}

/** 为节目列表添加过期/播放中/未来状态标记 */
function markProgramStatus(programs: EPGProgram[]): EPGProgram[] {
  const now = Date.now();
  return programs.map(prog => ({
    ...prog,
    isPast: prog.end.getTime() <= now,
    isCurrent: prog.start.getTime() <= now && prog.end.getTime() > now,
    isFuture: prog.start.getTime() > now,
  }));
}

/** 查找当前正在播放和下一个节目 */
function findCurrentAndNext(programmes: EPGProgram[]): {
  current: EPGProgram | null;
  next: EPGProgram | null;
} {
  const now = Date.now();
  let current: EPGProgram | null = null;
  let next: EPGProgram | null = null;

  for (const prog of programmes) {
    const start = prog.start.getTime();
    const end = prog.end.getTime();

    if (start <= now && now < end) {
      current = prog;
    } else if (start > now && !next) {
      next = prog;
    }

    if (current && next) break;
  }

  return { current, next };
}

/** 将 Date 格式化为 HH:MM 格式 */
function formatHHmm(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** 将解析后的 EPG 数据序列化为可存储的 JSON 格式 */
function serializeEPGData(data: ParsedEPGData): SerializedEPGData {
  const programmes: SerializedEPGData['programmes'] = {};
  data.programmes.forEach((progs, channelId) => {
    programmes[channelId] = progs.map(p => ({
      title: p.title,
      start: p.start.toISOString(),
      end: p.end.toISOString(),
    }));
  });
  return { channels: data.channels, programmes };
}

/** 将序列化的 EPG 数据还原为运行时格式 */
function deserializeEPGData(data: SerializedEPGData): ParsedEPGData {
  const programmes = new Map<string, EPGProgram[]>();
  Object.entries(data.programmes).forEach(([channelId, progs]) => {
    programmes.set(channelId, progs.map(p => ({
      title: p.title,
      start: new Date(p.start),
      end: new Date(p.end),
    })));
  });
  return { channels: data.channels, programmes };
}

/** 从 IndexedDB 缓存中读取 EPG 数据 */
async function getCachedEPG(): Promise<{ data: ParsedEPGData; urls: string[]; timestamp: number } | null> {
  try {
    const db = await getDB();
    const data = await db.get('settings', EPG_CACHE_DATA_KEY);
    const urls = await db.get('settings', EPG_CACHE_URLS_KEY);
    const time = await db.get('settings', EPG_CACHE_TIME_KEY);
    if (data && urls && time) {
      return {
        data: deserializeEPGData((data as { value: SerializedEPGData }).value),
        urls: (urls as { value: string[] }).value,
        timestamp: (time as { value: number }).value,
      };
    }
  } catch { /* 缓存读取失败或数据格式异常时返回 null */ }
  return null;
}

/** 将 EPG 数据写入 IndexedDB 缓存 */
async function setCachedEPG(data: ParsedEPGData, urls: string[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('settings', 'readwrite');
    await Promise.all([
      tx.store.put({ key: EPG_CACHE_DATA_KEY, value: serializeEPGData(data) }),
      tx.store.put({ key: EPG_CACHE_URLS_KEY, value: urls }),
      tx.store.put({ key: EPG_CACHE_TIME_KEY, value: Date.now() }),
      tx.done,
    ]);
  } catch { /* 缓存写入失败不影响主流程 */ }
}

// ── EPG 请求合并（防「节目单无限调用接口」）─────────────────────────
// 同一 key（customUrl）在途请求共享一次网络拉取：重复点击节目单 / 多处同时
// 拉取 EPG（播放页 + 设置页）不会再各自发全量请求。完成后自动清空。
const pendingEPGFetch = new Map<string, Promise<ParsedEPGData>>();

export function fetchAndParseEPG(customUrl?: string): Promise<ParsedEPGData> {
  const key = customUrl ?? '';
  let pending = pendingEPGFetch.get(key);
  if (!pending) {
    pending = doFetchAndParseEPG(customUrl).finally(() => {
      pendingEPGFetch.delete(key);
    });
    pendingEPGFetch.set(key, pending);
  }
  return pending;
}

async function doFetchAndParseEPG(customUrl?: string): Promise<ParsedEPGData> {
  const epgUrls = useSettingsStore.getState().epgUrls;
  const updateInterval = useSettingsStore.getState().epgUpdateInterval || 6;
  const intervalMs = updateInterval * 60 * 60 * 1000;

  const urls = customUrl ? [customUrl] : (epgUrls.length > 0 ? epgUrls : [DEFAULT_EPG_URL]);

  const cached = await getCachedEPG();
  const urlsChanged = JSON.stringify(cached?.urls || []) !== JSON.stringify(urls);
  const cacheExpired = !cached || Date.now() - cached.timestamp >= intervalMs;

  if (!urlsChanged && !cacheExpired && cached) {
    return cached.data;
  }

  let mergedData: ParsedEPGData = cached?.data || { channels: [], programmes: new Map() };
  const errors: string[] = [];

  // 并行获取所有 EPG 源，而非串行
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const xml = await getText(url, { timeout: 20000, useProxy: true });
      return xml ? parseXMLTV(xml) : null;
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      mergedData = mergeEPGData(mergedData, result.value);
    } else if (result.status === 'rejected') {
      const errMsg = result.reason instanceof Error ? result.reason.message : '未知错误';
      errors.push(`${urls[i]}: ${errMsg}`);
    }
  }

  await setCachedEPG(mergedData, urls);

  // 如果所有源都失败且没有缓存数据，抛出错误
  if (errors.length > 0 && mergedData.channels.length === 0) {
    throw new Error(`节目单加载失败：${errors.join('; ')}`);
  }

  return mergedData;
}

/**
 * 仅从缓存获取 EPG 数据，不发起网络请求
 * 用于 IPTV 播放页面，避免进入播放页时调用接口
 */
export async function getCachedEPGData(): Promise<ParsedEPGData> {
  const cached = await getCachedEPG();
  return cached?.data || { channels: [], programmes: new Map() };
}

/** 获取 EPG 缓存的最后更新时间戳 */
export async function getEPGCacheTime(): Promise<number | null> {
  try {
    const db = await getDB();
    const time = await db.get('settings', EPG_CACHE_TIME_KEY);
    if (time) {
      return (time as { value: number }).value;
    }
  } catch { /* 缓存读取失败时返回 null */ }
  return null;
}

/** 批量匹配 M3U 频道与 EPG 数据，返回各频道当前节目信息 */
export function matchAllChannels(
  m3uChannels: { id: string; name: string; tvgId?: string }[],
  epgData: ParsedEPGData
): Map<string, ChannelProgramInfo> {
  const result = new Map<string, ChannelProgramInfo>();
  // 预索引一次，避免每个频道全量遍历 EPG 频道列表
  const index = buildEPGChannelIndex(epgData.channels);

  for (const m3uCh of m3uChannels) {
    const matched = matchEPGChannelIndexed(m3uCh.name, m3uCh.tvgId, index);
    if (!matched) continue;

    const progs = epgData.programmes.get(matched.id);
    if (!progs || progs.length === 0) continue;

    const { current, next } = findCurrentAndNext(progs);

    if (current || next) {
      result.set(m3uCh.id, {
        current: current ? { title: current.title, start: formatHHmm(current.start), end: formatHHmm(current.end) } : null,
        next: next ? { title: next.title, start: formatHHmm(next.start), end: formatHHmm(next.end) } : null,
      });
    }
  }

  return result;
}

/**
 * 获取指定频道的带状态标记的节目列表
 * 用于 EPG 节目列表组件展示
 */
export function getChannelProgramsWithStatus(
  channelId: string,
  epgData: ParsedEPGData
): EPGProgram[] {
  const progs = epgData.programmes.get(channelId);
  if (!progs || progs.length === 0) return [];
  return markProgramStatus(progs);
}

/**
 * 格式化时间为 HH:MM 格式
 */
export function formatTimeHHmm(date: Date): string {
  return formatHHmm(date);
}
