/**
 * 频道台标解析器（iptv-org 单一来源 + 跨会话状态记忆）
 *
 * 台标来源定稿（2026-09-08 用户定稿）：只来自 iptv-org logos.json
 * （经 iptvOrgService.fetchIptvOrgChinaChannels 组装进 channel.logo）。
 * 本地 IPTV 源（M3U tvg-logo）、EPG XMLTV <icon>、在线台标库猜测均已退出台标逻辑。
 *
 * 仍保留的能力：
 * - URL 级 ok/fail 记忆持久化到 IndexedDB（30 天）：上次成功的 URL 优先复用，
 *   失败过的 URL 不再请求，避免每次刷新重复 404。
 * - 模块级 failedLogoUrls 失败记忆：已 404/挂起的 URL 不再返回（会话内即时生效）。
 * - 台标不走代理：http 台标原样直连，失败自然走字母占位。
 */
import type { IPTVChannel } from '@/types/iptv';
import {
  loadLogoState,
  saveLogoState,
} from './channelLogoCache';
import type { LogoStateEntry } from './channelLogoCache';

/** 台标 URL 安全化：http/https 一律原样直连（不经代理，减少 worker 请求消耗） */
function toSafeLogoUrl(url: string): string | null {
  if (/^https?:/i.test(url)) return url;
  return null;
}

/** session 级台标失败记忆：已失败 URL 不再进入候选链 */
const failedLogoUrls = new Set<string>();

/** 跨会话 URL 级成败记忆（preloadLogoCache 从 IndexedDB 恢复；防抖批量持久化） */
const logoState = new Map<string, LogoStateEntry>();

/** 防抖持久化成败记忆（批量合并高频 onError/onLoad 写入） */
let logoStateSaveTimer: number | null = null;
function scheduleSaveLogoState(): void {
  if (logoStateSaveTimer !== null) return;
  logoStateSaveTimer = window.setTimeout(() => {
    logoStateSaveTimer = null;
    const snapshot: Record<string, LogoStateEntry> = {};
    for (const [url, entry] of logoState) snapshot[url] = entry;
    void saveLogoState(snapshot);
  }, 800);
}

export function markLogoFailed(url: string): void {
  if (!url) return;
  failedLogoUrls.add(url);
  logoState.set(url, { ok: false, ts: Date.now() });
  scheduleSaveLogoState();
}

export function isLogoFailed(url: string): boolean {
  return failedLogoUrls.has(url);
}

/** 记录台标加载成功：优先复用（跨会话），并从失败记忆中移除 */
export function markLogoSucceeded(url: string): void {
  if (!url) return;
  failedLogoUrls.delete(url);
  logoState.set(url, { ok: true, ts: Date.now() });
  scheduleSaveLogoState();
}

/**
 * 预载台标缓存（应用启动调用，不阻塞）：
 * 从 IndexedDB 恢复 ok/fail 状态到内存。模块级 guard：同一会话只执行一次。
 */
let preloadStarted = false;
export function preloadLogoCache(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  void (async () => {
    try {
      const state = await loadLogoState();
      if (state) {
        for (const [url, entry] of Object.entries(state)) {
          logoState.set(url, entry);
          if (entry.ok) failedLogoUrls.delete(url);
          else failedLogoUrls.add(url);
        }
      }
    } catch { /* 状态恢复失败不影响主流程 */ }
  })();
}

/** 清空内存台标缓存（供 clearAllCaches 调用，IndexedDB 侧由 clearLogoCache 处理） */
export function resetLogoCacheInMemory(): void {
  logoState.clear();
  failedLogoUrls.clear();
}

/**
 * 生成频道台标候选 URL 列表（iptv-org 单一来源）。
 * channel.logo 只会在 iptv-org 组装链路里被赋值（logos.json 按 channel id 精确匹配）；
 * 本地源频道无 logo → 返回空数组，调用方走字母占位。
 * @param _proxyUrl 已废弃（台标不走代理）；保留参数仅为兼容历史调用点。
 */
export function resolveChannelLogoCandidates(
  channel: Pick<IPTVChannel, 'name' | 'logo' | 'tvgId'>,
  _proxyUrl?: string
): string[] {
  const safe = toSafeLogoUrl(channel.logo ?? '');
  if (!safe || failedLogoUrls.has(safe)) return [];

  // 跨会话成功记忆无需排序（单候选），仅过滤失败记忆
  return [safe];
}
