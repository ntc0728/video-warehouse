import { useCallback, useRef } from 'react';
import { toggleFullscreen } from '../lib/fullscreen';

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

  // C4/R2：全屏切换统一走 lib/fullscreen 的 toggleFullscreen（退出目标 + hasError 守卫三处一致）
  const handleToggleFullscreen = useCallback(async () => {
    await toggleFullscreen(containerRef.current, videoElementRef.current, hasError);
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
