import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import type { Video, Episode } from '@/types/video';

interface UseAutoPlayOptions {
  video: Video | null;
  localEpisodeId: string | undefined;
  onSwitchEpisode: (ep: Episode) => void;
}

export function useAutoPlay({ video, localEpisodeId, onSwitchEpisode }: UseAutoPlayOptions) {
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [skipIndicator, setSkipIndicator] = useState<'intro' | 'outro' | null>(null);

  const nextEpisodeRef = useRef<string | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayCancelRef = useRef(false);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef(video);
  videoRef.current = video;

  const startAutoPlayCountdown = useCallback((nextEpId: string) => {
    nextEpisodeRef.current = nextEpId;
    autoPlayCancelRef.current = false;
    setAutoPlayCountdown(3);

    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
          if (!autoPlayCancelRef.current && nextEpisodeRef.current) {
            const nextEp = videoRef.current?.episodes?.find(e => e.id === nextEpisodeRef.current);
            if (nextEp) onSwitchEpisode(nextEp);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onSwitchEpisode]);

  const cancelAutoPlay = useCallback(() => {
    autoPlayCancelRef.current = true;
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setAutoPlayCountdown(null);
    nextEpisodeRef.current = null;
  }, []);

  const playNextNow = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    autoPlayCancelRef.current = true;
    setAutoPlayCountdown(null);
    if (nextEpisodeRef.current) {
      const nextEp = videoRef.current?.episodes?.find(e => e.id === nextEpisodeRef.current);
      if (nextEp) onSwitchEpisode(nextEp);
    }
    nextEpisodeRef.current = null;
  }, [onSwitchEpisode]);

  const handleSkipIntro = useCallback(() => {
    setSkipIndicator('intro');
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipIndicator(null), 2000);
  }, []);

  const handleSkipOutro = useCallback(() => {
    setSkipIndicator('outro');
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipIndicator(null), 2000);
  }, []);

  const handleEnded = useCallback(() => {
    const loopMode = usePlayerStore.getState().loopMode;
    const autoPlayEnabled = useSettingsStore.getState().autoPlay;

    if (loopMode === 'single') {
      const videoEl = document.querySelector<HTMLVideoElement>('.up-player-video');
      if (videoEl) {
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
      }
      return;
    }

    if (!autoPlayEnabled && loopMode === 'none') return;

    if (videoRef.current?.episodes && videoRef.current.episodes.length > 0 && localEpisodeId) {
      const currentIndex = videoRef.current.episodes.findIndex((ep) => ep.id === localEpisodeId);

      if (loopMode === 'list') {
        const nextIndex = (currentIndex + 1) % videoRef.current.episodes.length;
        startAutoPlayCountdown(videoRef.current.episodes[nextIndex].id);
        return;
      }

      if (currentIndex < videoRef.current.episodes.length - 1) {
        startAutoPlayCountdown(videoRef.current.episodes[currentIndex + 1].id);
      }
    }
  }, [localEpisodeId, startAutoPlayCountdown]);

  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, []);

  return {
    autoPlayCountdown,
    skipIndicator,
    handleEnded,
    handleSkipIntro,
    handleSkipOutro,
    cancelAutoPlay,
    playNextNow,
  };
}
