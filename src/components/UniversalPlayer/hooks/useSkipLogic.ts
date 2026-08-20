import { useRef } from 'react';
import { useSettingsStore } from '@/stores';

interface UseSkipLogicOptions {
  onSkipIntro?: () => void;
  onSkipOutro?: () => void;
  onEnded?: () => void;
}

export function useSkipLogic({ onSkipIntro, onSkipOutro, onEnded }: UseSkipLogicOptions) {
  const hasSkippedIntroRef = useRef(false);
  const hasSkippedOutroRef = useRef(false);

  const checkSkipIntro = (video: HTMLVideoElement) => {
    const settings = useSettingsStore.getState();
    const ct = video.currentTime;
    if (settings.skipIntro && !hasSkippedIntroRef.current && ct < settings.skipIntroDuration && ct > 0.5) {
      hasSkippedIntroRef.current = true;
      video.currentTime = settings.skipIntroDuration;
      onSkipIntro?.();
      return true;
    }
    return false;
  };

  const checkSkipOutro = (video: HTMLVideoElement) => {
    const settings = useSettingsStore.getState();
    const ct = video.currentTime;
    const dur = video.duration;
    if (settings.skipOutro && !hasSkippedOutroRef.current && ct > dur - settings.skipOutroDuration && ct < dur - 1) {
      hasSkippedOutroRef.current = true;
      video.pause();
      onSkipOutro?.();
      onEnded?.();
      return true;
    }
    return false;
  };

  const reset = () => {
    hasSkippedIntroRef.current = false;
    hasSkippedOutroRef.current = false;
  };

  return { checkSkipIntro, checkSkipOutro, reset, hasSkippedIntroRef, hasSkippedOutroRef };
}
