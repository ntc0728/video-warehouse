import { useCallback, useRef } from 'react';
import { getFullscreenElement, requestFullscreen, exitFullscreen } from '../lib/fullscreen';

interface UsePlayerClickHandlerOptions {
  mode: 'video' | 'iptv' | 'live';
  hasError: boolean;
  isControlsVisible: boolean;
  hasLongPressedRef: React.MutableRefObject<boolean>;
  videoElementRef: React.MutableRefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showControls: () => void;
  togglePlay: () => void;
}

export function usePlayerClickHandler({
  mode, hasError, isControlsVisible,
  hasLongPressedRef, videoElementRef, containerRef,
  showControls, togglePlay,
}: UsePlayerClickHandlerOptions) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleFullscreen = useCallback(async () => {
    if (hasError) return;
    const el = containerRef.current;
    if (!el) return;
    try {
      if (getFullscreenElement()) {
        await exitFullscreen(videoElementRef.current);
      } else {
        await requestFullscreen(el);
      }
    } catch {
      // 部分平台不支持全屏 API，静默失败
    }
  }, [hasError, containerRef, videoElementRef]);

  const handlePlayerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.up-control-bar') || target.closest('.up-player-header') || target.closest('.up-channel-list-overlay') || target.closest('.iptv-osd-bar') || target.closest('.iptv-volume-popup')) {
      return;
    }

    // IPTV 模式：单击显示 OSD 控制栏
    if (mode === 'iptv') {
      showControls();
      return;
    }

    // 长按快进快退后不触发单击
    if (hasLongPressedRef.current) {
      hasLongPressedRef.current = false;
      return;
    }

    // 控制栏隐藏时，单击仅显示控制栏
    if (!isControlsVisible) {
      showControls();
      return;
    }

    // 双击切换全屏
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleToggleFullscreen();
    } else {
      // 单击：切换播放/暂停 + 显示控制栏
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        togglePlay();
        showControls();
      }, 250);
    }
  }, [mode, isControlsVisible, showControls, togglePlay, handleToggleFullscreen, hasLongPressedRef]);

  return { handlePlayerClick, handleToggleFullscreen, clickTimerRef };
}
