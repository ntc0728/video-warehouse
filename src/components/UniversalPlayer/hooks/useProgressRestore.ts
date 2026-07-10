import { useCallback } from 'react';
import { getHistory } from '@/services/database';

interface UseProgressRestoreOptions {
  videoId?: string;
  vodId?: string;
  episodeUrl?: string;
  skipHistory?: boolean;
}

export function useProgressRestore({ videoId, vodId, episodeUrl, skipHistory = false }: UseProgressRestoreOptions) {
  const loadProgress = useCallback(async (videoRef: React.RefObject<HTMLVideoElement | null>) => {
    if (!videoId || !videoRef.current || skipHistory) return;
    try {
      const history = await getHistory();
      const videoHistory = episodeUrl
        ? history.find((h) => h.episodeUrl === episodeUrl)
        : vodId
          ? history.find((h) => h.vodId === vodId)
          : history.find((h) => h.videoId === videoId);
      const video = videoRef.current;
      if (videoHistory && videoHistory.progress > 0 && video.duration && isFinite(video.duration)) {
        video.currentTime = Math.min(videoHistory.progress, video.duration - 1);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [videoId, vodId, episodeUrl, skipHistory]);

  return { loadProgress };
}
