import { useCallback, useRef } from 'react';
import { toggleFullscreen } from '../lib/fullscreen';

interface UsePlayerClickHandlerOptions {
  mode: 'video' | 'iptv' | 'live';
  hasError: boolean;
  isControlsVisible: boolean;
  /** 移动端布局：单击立即显/隐控制栏，不做 250ms 双击等待（P1-2） */
  isMobileLayout?: boolean;
  hasLongPressedRef: React.MutableRefObject<boolean>;
  videoElementRef: React.MutableRefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showControls: () => void;
  hideControls?: () => void;
  togglePlay: () => void;
}

export function usePlayerClickHandler({
  mode, hasError, isControlsVisible, isMobileLayout = false,
  hasLongPressedRef, videoElementRef, containerRef,
  showControls, hideControls, togglePlay,
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

    // P1-2 移动端：单击立即显/隐控制栏，双击第二拍全屏，不做 250ms 延迟等待
    if (isMobileLayout) {
      if (clickTimerRef.current) {
        // 双击第二拍 → 全屏（清掉第一拍标记）
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        handleToggleFullscreen();
        return;
      }
      // 第一拍：立即切换控制栏可见性
      clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; }, 250);
      if (isControlsVisible) {
        hideControls?.();
      } else {
        showControls();
      }
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
      // 单击：切换播放/暂停 + 显示控制栏（桌面保留 250ms 双击窗口）
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        togglePlay();
        showControls();
      }, 250);
    }
  }, [mode, isControlsVisible, isMobileLayout, showControls, hideControls, togglePlay, handleToggleFullscreen, hasLongPressedRef]);

  return { handlePlayerClick, handleToggleFullscreen, clickTimerRef };
}
