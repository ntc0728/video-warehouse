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
}

interface EPGChannelInfo {
  id: string;
  name: string;
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

function parseXmltvTime(timeStr: string): Date {
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})$/);
  if (!match) return new Date(timeStr);

  const [, y, M, d, h, m, s, tzH, tzM] = match;
  const tzOffset = parseInt(tzH, 10) * 60 + parseInt(tzM, 10);
  const utcDate = Date.UTC(+y, +M - 1, +d, +h, +m, +s);
  return new Date(utcDate - tzOffset * 60000);
}

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
    channels.push({ id, name });
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

function normalizeName(name: string): string {
  return name
    .replace(/高清|HD|标清|SD|4K|UHD|超清|极致|极速/g, '')
    .replace(/[-\s]/g, '')
    .trim()
    .toLowerCase();
}

function matchEPGChannel(
  channelName: string,
  _tvgId: string | undefined,
  epgChannels: EPGChannelInfo[]
): EPGChannelInfo | null {
  const normalized = normalizeName(channelName);

  for (const epgCh of epgChannels) {
    if (normalizeName(epgCh.name) === normalized) {
      return epgCh;
    }
  }

  for (const epgCh of epgChannels) {
    if (epgCh.name === channelName) {
      return epgCh;
    }
  }

  return null;
}

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

function formatHHmm(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

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

async function getCachedEPG(): Promise<{ data: ParsedEPGData; urls: string[]; timestamp: number } | null> {
  try {
    const db = await getDB();
    const data = await db.get('settings', EPG_CACHE_DATA_KEY);
    const urls = await db.get('settings', EPG_CACHE_URLS_KEY);
    const time = await db.get('settings', EPG_CACHE_TIME_KEY);
    if (data && urls && time) {
      return {
        data: deserializeEPGData(data.value as SerializedEPGData),
        urls: urls.value as string[],
        timestamp: time.value as number,
      };
    }
  } catch { /* ignore */ }
  return null;
}

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
  } catch { /* ignore */ }
}

export async function fetchAndParseEPG(customUrl?: string): Promise<ParsedEPGData> {
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

  for (const url of urls) {
    try {
      const xml = await getText(url, { timeout: 20000, useProxy: true });
      if (xml) {
        const newData = parseXMLTV(xml);
        mergedData = mergeEPGData(mergedData, newData);
      }
    } catch { /* continue to next URL */ }
  }

  await setCachedEPG(mergedData, urls);
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

export function matchAllChannels(
  m3uChannels: { id: string; name: string; tvgId?: string }[],
  epgData: ParsedEPGData
): Map<string, ChannelProgramInfo> {
  const result = new Map<string, ChannelProgramInfo>();

  for (const m3uCh of m3uChannels) {
    const matched = matchEPGChannel(m3uCh.name, m3uCh.tvgId, epgData.channels);
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
