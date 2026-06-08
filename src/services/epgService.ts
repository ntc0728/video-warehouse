import { useSettingsStore } from '@/stores';
import { getText } from './httpClient';

const DEFAULT_EPG_URL = 'http://epg.51zmt.top:8000/e.xml';

export interface EPGProgram {
  title: string;
  start: Date;
  end: Date;
}

interface EPGChannelInfo {
  id: string;
  name: string;
}

interface ParsedEPGData {
  channels: EPGChannelInfo[];
  programmes: Map<string, EPGProgram[]>;
}

export interface ChannelProgramInfo {
  current: { title: string; start: string; end: string } | null;
  next: { title: string; start: string; end: string } | null;
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

export async function fetchAndParseEPG(customUrl?: string): Promise<ParsedEPGData> {
  const url = customUrl || useSettingsStore.getState().epgUrl || DEFAULT_EPG_URL;
  const xml = await getText(url, { timeout: 20000 });
  return parseXMLTV(xml);
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