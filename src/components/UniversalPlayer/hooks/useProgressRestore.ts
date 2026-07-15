/**
 * 播放进度恢复 Hook
 *
 * 从 IndexedDB 历史记录中查找匹配的播放进度，并恢复到 video 元素。
 * 支持多级查找策略，确保在不同场景下都能找到正确的进度记录。
 *
 * 查找优先级（从精确到模糊）：
 * 1. episodeUrl - 精确到集（如 http://example.com/ep1.m3u8）
 * 2. videoId + cmsSourceId - 精确到视频+CMS源（同一视频不同源的进度）
 * 3. vodId - CMS 源的 vod_id
 * 4. videoId - 兜底，无 cmsSourceId 的记录
 *
 * @param videoId - TMDB 视频 ID（如 tmdb-movie-12345）
 * @param vodId - CMS 源的 vod_id（仅 CMS 源视频有值）
 * @param episodeUrl - 当前播放集的 URL（用于精确匹配历史记录）
 * @param cmsSourceId - CMS 源配置 ID（如 "cj.lzcaiji.com"）
 * @param skipHistory - 是否跳过历史记录恢复（用于"从头播放"场景）
 */
import { useCallback } from 'react';
import { getHistory } from '@/services/database';

/** Hook 配置选项 */
interface UseProgressRestoreOptions {
  /** TMDB 视频 ID */
  videoId?: string;
  /** CMS 源的 vod_id */
  vodId?: string;
  /** 当前播放集的 URL */
  episodeUrl?: string;
  /** CMS 源配置 ID */
  cmsSourceId?: string;
  /** 是否跳过历史记录恢复 */
  skipHistory?: boolean;
}

export function useProgressRestore({ videoId, vodId, episodeUrl, cmsSourceId, skipHistory = false }: UseProgressRestoreOptions) {
  /**
   * 加载并恢复播放进度
   * @param videoRef - video 元素的 ref
   */
  const loadProgress = useCallback(async (videoRef: React.RefObject<HTMLVideoElement | null>) => {
    // 前置条件：需要有 videoId、video 元素、且不跳过历史
    if (!videoId || !videoRef.current || skipHistory) return;
    try {
      // 从 IndexedDB 获取所有历史记录（按 updatedAt 倒序）
      const history = await getHistory();

      // 查找优先级：episodeUrl（精确到集）→ videoId + cmsSourceId（精确到源）→ vodId → videoId
      let videoHistory = episodeUrl
        ? history.find((h) => h.episodeUrl === episodeUrl)
        : null;
      // 按 videoId + cmsSourceId 查找（同一视频不同源的进度）
      if (!videoHistory && cmsSourceId) {
        videoHistory = history.find((h) => h.videoId === videoId && h.cmsSourceId === cmsSourceId);
      }
      // 按 vodId 查找（CMS 源的 vod_id）
      if (!videoHistory && vodId) {
        videoHistory = history.find((h) => h.vodId === vodId);
      }
      // 兜底：按 videoId 查找（无 cmsSourceId 的记录）
      if (!videoHistory) {
        videoHistory = history.find((h) => h.videoId === videoId && !h.cmsSourceId);
      }

      // 恢复进度：将 currentTime 设置为上次播放位置
      const video = videoRef.current;
      if (videoHistory && videoHistory.progress > 0 && video.duration && isFinite(video.duration)) {
        // 避免跳转到视频末尾（duration - 1 秒）
        video.currentTime = Math.min(videoHistory.progress, video.duration - 1);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [videoId, vodId, episodeUrl, cmsSourceId, skipHistory]);

  return { loadProgress };
}
