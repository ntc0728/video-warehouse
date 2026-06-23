import { useCallback, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import { getAutoHideDelay } from '../lib/utils';

interface UsePlayerControlsOptions {
  setControlsVisible: (visible: boolean) => void;
  activePopover: string | null;
}

export function usePlayerControls({ setControlsVisible, activePopover }: UsePlayerControlsOptions) {
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    const { isPlaying: playing } = usePlayerStore.getState();
    if (!playing || activePopover) return;
    const delay = getAutoHideDelay();
    autoHideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, delay);
  }, [setControlsVisible, activePopover]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    resetAutoHideTimer();
  }, [setControlsVisible, resetAutoHideTimer]);

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, [setControlsVisible]);

  return {
    autoHideTimerRef,
    resetAutoHideTimer,
    showControls,
    hideControls,
  };
}
