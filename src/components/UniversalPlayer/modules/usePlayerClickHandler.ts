import { useCallback, useRef } from 'react';
import { toggleFullscreen } from '../lib/fullscreen';

interface UsePlayerClickHandlerOptions {
  mode: 'video' | 'iptv' | 'live';
  hasError: boolean;
  isControlsVisible: boolean;
  /** 移动端布局：单击立即显/隐控制栏，不做 250ms 双击等待（-2） */
  isMobileLayout?: boolean;
  /** 仅音频源（manifest 无视频轨）：单击直接暂停/播放，且不进入双击全屏。
   * 黑屏上控制栏会自动隐藏，首击若只「叫出控制栏」用户完全看不到反馈，
   * 250ms 内第二击又会被判成全屏 → 体感「点了暂停没反应」（2026-11-11）。 */
  audioOnly?: boolean;
  hasLongPressedRef: React.MutableRefObject<boolean>;
  videoElementRef: React.MutableRefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showControls: () => void;
  togglePlay: () => void;
}

export function usePlayerClickHandler({
  mode, hasError, isControlsVisible, isMobileLayout = false, audioOnly = false,
  hasLongPressedRef, videoElementRef, containerRef,
  showControls, togglePlay,
}: UsePlayerClickHandlerOptions) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // C4/：全屏切换统一走 lib/fullscreen 的 toggleFullscreen（退出目标 + hasError 守卫三处一致）
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

    // 仅音频源：单击直接暂停/播放（黑屏上「先叫出控制栏」没有任何视觉反馈），
    // 且不进入双击全屏——黑屏全屏无意义，还会让第二击把暂停变成全屏。
    if (audioOnly) {
      togglePlay();
      showControls();
      return;
    }

    //-2 移动端：单击立即显/隐控制栏，双击第二拍全屏，不做 250ms 延迟等待
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
      // 控制栏隐藏 → 仅显示控制栏（不切换播放）；控制栏已显示 → 点击空白区域暂停/播放
      if (isControlsVisible) {
        togglePlay();
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
  }, [mode, isControlsVisible, isMobileLayout, audioOnly, showControls, togglePlay, handleToggleFullscreen, hasLongPressedRef]);

  return { handlePlayerClick, handleToggleFullscreen, clickTimerRef };
}
