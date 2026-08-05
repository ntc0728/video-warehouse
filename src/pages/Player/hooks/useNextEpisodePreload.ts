import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';

export interface UseNextEpisodePreloadOptions {
  /** 下一集要播放的 URL（未代理原始地址） */
  nextEpisodeUrl?: string;
  /** 是否存在下一集（非末集） */
  enabled: boolean;
}

/**
 * 仅 Wi-Fi 预加载：navigator.connection 的 effectiveType/type 命中蜂窝网络
 * （2g/3g/4g/5g/cellular）时不预加载；无 API / 桌面环境默认允许。
 */
export function isWifiConnection(): boolean {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection;
  if (!conn) return true;
  const t = `${conn.effectiveType ?? ''} ${conn.type ?? ''}`;
  return !/cellular|2g|3g|4g|5g/i.test(t);
}

/**
 * 解析 media playlist 中首个分片 URL（相对路径基于清单 URL 解析）。
 * master 清单（含多码率 #EXT-X-STREAM-INF）返回 null，避免多码率选择复杂度。
 */
export function extractFirstSegmentUrl(manifest: string, manifestUrl: string): string | null {
  // 无 #EXTINF = master 清单/非 media playlist，无普通分片行（STREAM-INF 后是 level 清单 URL）
  if (!/#EXTINF/i.test(manifest)) return null;
  for (const rawLine of manifest.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    return new URL(line, manifestUrl).toString();
  }
  return null;
}

/**
 * 预加载下一集：拉 manifest 文本 + 首分片，落入浏览器 HTTP 缓存，
 * 切集时 hls.js 命中缓存 → 秒起播。串行单任务，失败/取消静默。
 */
async function preloadNextEpisode(url: string, signal: AbortSignal): Promise<void> {
  const manifestRes = await fetch(url, { signal });
  if (!manifestRes.ok) return;
  const manifest = await manifestRes.text();
  // 仅 media playlist（含 #EXTINF）才预拉首分片；master 清单只预拉清单本身
  if (!/#EXTINF/i.test(manifest)) return;
  const segUrl = extractFirstSegmentUrl(manifest, url);
  if (!segUrl) return;
  const segRes = await fetch(segUrl, { signal });
  if (segRes.ok) {
    // 消费 body，使资源完整进入浏览器 HTTP 缓存（切集时命中）
    await segRes.arrayBuffer();
  }
}

/**
 * 预加载②（剧集连播）：当前集 playing 稳定后（300ms），预拉**下一集**
 * manifest + 首分片。仅 Wi-Fi、非末集、点播模式下触发；直播/IPTV 不预加载。
 * 带宽保护：串行单任务（新任务 abort 旧任务）、只拉 1 个分片、失败静默。
 */
export function useNextEpisodePreload({ nextEpisodeUrl, enabled }: UseNextEpisodePreloadOptions) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !nextEpisodeUrl || !isPlaying || !isWifiConnection()) return;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      preloadNextEpisode(nextEpisodeUrl, controller.signal).catch(() => { /* 预加载失败静默 */ });
    }, 300);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [enabled, nextEpisodeUrl, isPlaying]);

  // 卸载清理
  useEffect(() => () => abortRef.current?.abort(), []);
}
