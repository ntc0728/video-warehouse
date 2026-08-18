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

  /**
   * R5：控制栏可见性的单一同步出口。
   * 播放状态变化时统一在此决策，避免各处散落的 setControlsVisible/resetAutoHideTimer 互相覆盖：
   * - 播放中：显示 → 排自动隐藏
   * - 暂停/缓冲/出错/弹层打开：常驻显示，不排隐藏
   */
  const syncAutoHide = useCallback(({ isPlaying, isBuffering, hasError }: { isPlaying: boolean; isBuffering?: boolean; hasError?: boolean }) => {
    if (isBuffering || hasError || !isPlaying) {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      return;
    }
    showControls();
  }, [showControls]);

  return {
    autoHideTimerRef,
    resetAutoHideTimer,
    showControls,
    hideControls,
    syncAutoHide,
  };
}
