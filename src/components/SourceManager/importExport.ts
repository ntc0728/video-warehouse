/**
 * importExport — 源管理导入/导出工具
 *
 * [2026-08-07 源管理整改]
 * - 视频源：导出格式 `{ name, api, detail }[]` JSON
 * - IPTV / EPG 源：导出格式 `{ name, url }[]` JSON
 * - 导入支持 JSON（数组 / {api_site: {...}} / {items: [...]} / 文本逐行 name<分隔符>url）
 * - 文本导入：按 `:::` 或 `,` 或空格分隔 name 与 url，每行一条
 * - 文件导入：FileReader 读 .json / .txt
 * - URL 导入：fetch（不强制 useProxy，用户自填 URL 应直达）
 */
import type { ManagedIPTVSource, ManagedEPGSource, ManagedVideoSource } from '@/types/source';
import { toast } from '@/components/ui/toastBus';

/* ── 文本导出 ─────────────────────────── */

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportVideoToFile(items: ManagedVideoSource[]) {
  const data = items.map((s) => ({ name: s.name, api: s.api, detail: s.detail }));
  download(`video-sources-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportIPTVToFile(items: ManagedIPTVSource[]) {
  const data = items.map((s) => ({ name: s.name, url: s.url }));
  download(`iptv-sources-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportEPGToFile(items: ManagedEPGSource[]) {
  const data = items.map((s) => ({ name: s.name, url: s.url }));
  download(`epg-sources-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportVideoToText(items: ManagedVideoSource[]) {
  const text = items.map((s) => `${s.name}:::${s.api}:::${s.detail}`).join('\n');
  download(`video-sources-${Date.now()}.txt`, text, 'text/plain');
}

export function exportIPTVToText(items: ManagedIPTVSource[]) {
  const text = items.map((s) => `${s.name}:::${s.url}`).join('\n');
  download(`iptv-sources-${Date.now()}.txt`, text, 'text/plain');
}

export function exportEPGToText(items: ManagedEPGSource[]) {
  const text = items.map((s) => `${s.name}:::${s.url}`).join('\n');
  download(`epg-sources-${Date.now()}.txt`, text, 'text/plain');
}

/* ── 复制到剪贴板 ──────────────────── */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ── 文件导入 ──────────────────────── */

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('文件读取失败'));
    r.readAsText(file);
  });
}

/* ── 解析逻辑 ──────────────────────── */

interface ParsedVideo {
  name: string;
  api: string;
  detail: string;
}
interface ParsedURL {
  name: string;
  url: string;
}

/** 从 JSON 文本解析为数组（支持 {api_site: {...}} / {items: [...]} / [...]） */
function tryParseJSON(text: string): unknown[] | null {
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj)) return obj;
    if (obj && Array.isArray((obj as { items?: unknown[] }).items)) return (obj as { items: unknown[] }).items;
    if (obj && typeof obj === 'object' && (obj as { api_site?: Record<string, unknown> }).api_site) {
      const apiSite = (obj as { api_site: Record<string, ParsedVideo> }).api_site;
      return Object.values(apiSite);
    }
    if (obj && typeof obj === 'object' && (obj as { sources?: unknown[] }).sources) {
      return (obj as { sources: unknown[] }).sources;
    }
    return null;
  } catch {
    return null;
  }
}

/** 从文本逐行解析（name<sep>url[:::detail]） */
function parseTextLines(text: string, hasDetail: boolean): ParsedURL[] | ParsedVideo[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const urlItems: ParsedURL[] = [];
  const videoItems: ParsedVideo[] = [];
  for (const line of lines) {
    // 支持 "name,url" / "name,url,detail" / "name:::url[:::detail]" / "name url"
    const parts = line.split(/\s*(?::::{1,2}|,|\t|\s{2,})\s*/).filter(Boolean);
    if (parts.length < 2) continue;
    if (hasDetail && parts.length >= 3) {
      videoItems.push({ name: parts[0], api: parts[1], detail: parts[2] });
    } else {
      urlItems.push({ name: parts[0], url: parts[1] });
    }
  }
  return hasDetail ? videoItems : urlItems;
}

/** 解析视频源 JSON/文本 */
function parseVideoText(text: string): ParsedVideo[] {
  const json = tryParseJSON(text);
  if (json) {
    return (json as ParsedVideo[])
      .filter((x) => x && typeof x.api === 'string' && typeof x.name === 'string')
      .map((x) => ({ name: x.name, api: x.api, detail: x.detail || x.api }));
  }
  return (parseTextLines(text, true) as ParsedVideo[]).filter(
    (x) => (x as ParsedVideo).api,
  );
}

function parseURLText(text: string): ParsedURL[] {
  const json = tryParseJSON(text);
  if (json) return (json as ParsedURL[]).filter((x) => x && typeof x.url === 'string' && typeof x.name === 'string');
  return parseTextLines(text, false) as ParsedURL[];
}

/** 文件导入（video） */
export async function importVideoFromFile(file: File): Promise<ParsedVideo[]> {
  const text = await readFileAsText(file);
  return parseVideoText(text);
}

export async function importURLFromFile(file: File): Promise<ParsedURL[]> {
  const text = await readFileAsText(file);
  return parseURLText(text);
}

/** URL 导入（fetch 远端文本） */
export async function importFromRemoteUrl(url: string): Promise<string> {
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

/** 文本导入（粘贴） */
export function importVideoFromText(text: string): ParsedVideo[] {
  return parseVideoText(text);
}
export function importURLFromText(text: string): ParsedURL[] {
  return parseURLText(text);
}

/* ── 导入结果提示 ──────────────────────── */

export function summarizeImport<T extends { name: string }>(
  scene: 'video' | 'iptv' | 'epg',
  parsed: T[],
  add: (item: T) => boolean,
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  for (const item of parsed) {
    if (add(item)) added++;
    else skipped++;
  }
  toast.show({
    content: `${scene === 'video' ? '视频源' : scene === 'iptv' ? 'IPTV 源' : '节目单源'}导入完成：成功 ${added}，跳过 ${skipped}`,
    type: skipped > 0 ? 'warning' : 'success',
  });
  return { added, skipped };
}
