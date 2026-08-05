/**
 * 播放进度恢复 Hook
 *
 * 从 IndexedDB 历史记录中查找匹配的播放进度，并恢复到 video 元素。
 * 查找优先级（从精确到内容身份，避免跨集/跨线路取错进度）：
 * 1. episodeUrl - 精确到线路/集（同源同线路续播，如 http://example.com/ep1.m3u8）
 * 2. 剧集内容身份 - videoId + 季号 + 集标签（相同选季/选集跨源共享同一进度）
 * 3. vodId - CMS 源的 vod_id
 * 4. 电影兜底 - videoId 且无季号（电影线路独立进度；跨源时取最近一条线路）
 *
 * 注意：不再使用「videoId && !cmsSourceId」这类跨内容身份的兜底——TV 多集场景下
 * 会把别的季/别的集的进度恢复到当前集（错误固化），必须按内容身份精确匹配。
 *
 * @param videoId - TMDB 视频 ID（如 tmdb-movie-12345）
 * @param vodId - CMS 源的 vod_id（仅 CMS 源视频有值）
 * @param episodeUrl - 当前播放线路/集的 URL（用于精确匹配历史记录）
 * @param episodeLabel - 当前集标签（如 "第3集"，剧集播放时有值）
 * @param seasonNumber - 当前季号（剧集播放时有值）
 * @param skipHistory - 是否跳过历史记录恢复（用于"从头播放"场景）
 */
import { useCallback } from 'react';
import { getHistory } from '@/services/database';
import { playerToast } from '../PlayerToast';

/** Hook 配置选项 */
interface UseProgressRestoreOptions {
  /** TMDB 视频 ID */
  videoId?: string;
  /** CMS 源的 vod_id */
  vodId?: string;
  /** 当前播放线路/集的 URL */
  episodeUrl?: string;
  /** 当前集标签（如 "第3集"） */
  episodeLabel?: string;
  /** 当前季号 */
  seasonNumber?: number;
  /** 是否跳过历史记录恢复 */
  skipHistory?: boolean;
}

export function useProgressRestore({ videoId, vodId, episodeUrl, episodeLabel, seasonNumber, skipHistory = false }: UseProgressRestoreOptions) {
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

      // 查找优先级：episodeUrl（精确到线路/集）→ 剧集内容身份（videoId+季+集）→ vodId → 电影兜底（videoId 无季号）
      let videoHistory = episodeUrl
        ? history.find((h) => h.episodeUrl === episodeUrl)
        : null;
      // 剧集内容身份：相同选季/选集跨源共享同一进度（写入侧按 季号+集标签 去重）
      if (!videoHistory && seasonNumber != null && episodeLabel) {
        videoHistory = history.find(
          (h) => h.videoId === videoId && h.seasonNumber === seasonNumber && h.episodeLabel === episodeLabel,
        );
      }
      // 按 vodId 查找（CMS 源的 vod_id）
      if (!videoHistory && vodId) {
        videoHistory = history.find((h) => h.vodId === vodId);
      }
      // 电影兜底：同 videoId 且无季号的记录（电影线路独立进度，跨源时取最近一条线路）。
      // 排除 episodeLabel 为「第N集」形态的记录——老版剧集记录可能没有 seasonNumber 字段，
      // 若不加排除会被当作电影记录恢复，导致跨集错位续播。
      if (!videoHistory) {
        videoHistory = history.find(
          (h) =>
            h.videoId === videoId &&
            h.seasonNumber == null &&
            !/^第\d+集$/.test(h.episodeLabel || ''),
        );
      }

      // 恢复进度：将 currentTime 设置为上次播放位置
      const video = videoRef.current;
      if (videoHistory && videoHistory.progress > 0 && video.duration && isFinite(video.duration)) {
        // 避免跳转到视频末尾（duration - 1 秒）
        video.currentTime = Math.min(videoHistory.progress, video.duration - 1);
        // 提示已自动恢复播放位置（右上角；PlayerToast.show 自带覆盖语义，防双触发叠加）
        playerToast('已自动跳转到上次观看的位置');
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [videoId, vodId, episodeUrl, episodeLabel, seasonNumber, skipHistory]);

  return { loadProgress };
}
