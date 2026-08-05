/**
 * 「继续观看」数据构建（纯函数，供首页使用）
 *
 * 从观看历史中提取「有进度且未看完（<90%）」的最新记录，
 * 转换为 ContinueWatchingItem 卡片数据，按 updatedAt 倒序、最多 12 条。
 *
 * 规则：
 * - progress <= 0 或 duration <= 0：跳过
 * - 已看完（progress/duration >= 0.9）：跳过
 * - 同一 videoId 多条记录：取最新一条（按 updatedAt），避免同剧重复
 * - overlayLabel：CMS 源名称 + 「X季第Y集」（有则拼）
 */
import type { ContinueWatchingItem } from '@/components/TMDBMovieRow';

interface HistoryLike {
  id: string;
  videoId?: string;
  progress: number;
  duration: number;
  updatedAt: number;
  title?: string;
  cover?: string;
  backdrop?: string;
  cmsSourceName?: string;
  seasonNumber?: number;
  episodeLabel?: string;
}

/**
 * 按 videoId 取最新一条有进度的历史记录
 */
export function latestByVideoId(history: HistoryLike[]): Map<string, HistoryLike> {
  const map = new Map<string, HistoryLike>();
  for (const h of history) {
    if (h.progress <= 0) continue;
    const key = String(h.videoId);
    const prev = map.get(key);
    if (!prev || h.updatedAt > prev.updatedAt) map.set(key, h);
  }
  return map;
}

/**
 * 构建继续观看卡片数据
 */
export function buildContinueItems(history: HistoryLike[], max = 12): ContinueWatchingItem[] {
  const latest = latestByVideoId(history);
  const list: ContinueWatchingItem[] = [];
  for (const h of history) {
    if (h.progress <= 0 || h.duration <= 0) continue;
    // 已看完（≥90%）不再出现在继续观看
    if (h.progress / h.duration >= 0.9) continue;
    const key = String(h.videoId);
    const latestRec = latest.get(key);
    if (!latestRec) continue;
    // 仅保留该 videoId 的最新记录，避免同剧多条重复
    if (latestRec.id !== h.id) continue;
    const parts: string[] = [];
    if (h.cmsSourceName) parts.push(h.cmsSourceName);
    if (h.seasonNumber && h.episodeLabel) parts.push(`${h.seasonNumber}季${h.episodeLabel}`);
    list.push({
      id: key,
      cover: h.cover || '',
      backdrop: h.backdrop || h.cover || '',
      title: h.title || '',
      type: (key.includes('-tv-') ? 'tv' : 'movie') as 'movie' | 'tv',
      overlayLabel: parts.join(' · ') || undefined,
      progress: h.progress,
      duration: h.duration,
      updatedAt: h.updatedAt,
    });
  }
  return list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, max);
}
