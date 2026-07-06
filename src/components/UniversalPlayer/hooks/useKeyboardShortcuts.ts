import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import type { PlatformType, PlayerMode, LoopMode } from '@/types/player';

interface UseKeyboardShortcutsOptions {
  platform: PlatformType;
  mode: PlayerMode;
  isControlsVisible: boolean;
  showControls: () => void;
  hideControls: () => void;
  playerCore: { togglePlay: () => void; setVolume: (v: number) => void; seek: (time: number) => void; getCurrentTime: () => number; getDuration: () => number };
  showVolumePopupWithTimer: () => void;
  toggleFullscreen?: () => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
}

const LOOP_CYCLE: LoopMode[] = ['none', 'single', 'list'];
const SEEK_DEBOUNCE_MS = 100;

export function useKeyboardShortcuts({
  platform,
  mode,
  isControlsVisible,
  showControls,
  hideControls,
  playerCore,
  showVolumePopupWithTimer,
  toggleFullscreen,
  onPrevEpisode,
  onNextEpisode,
}: UseKeyboardShortcutsOptions) {
  // seek 防抖 ref
  const seekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // TV 平台由 useTVRemote 统一处理，不注册重复监听
    if (platform === 'tv') return;

    /** 带防抖的 seek，避免连续按键导致频繁 seek 卡顿 */
    const debouncedSeek = (time: number) => {
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
      seekDebounceRef.current = setTimeout(() => {
        playerCore.seek(time);
        seekDebounceRef.current = null;
      }, SEEK_DEBOUNCE_MS);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const volume = usePlayerStore.getState().volume;

      if (mode === 'iptv') {
        // IPTV 模式：支持播放/暂停、音量、全屏、Escape
        switch (e.key) {
          case ' ':
            e.preventDefault();
            playerCore.togglePlay();
            break;
          case 'ArrowUp':
            e.preventDefault();
            playerCore.setVolume(Math.min(1, volume + 0.1));
            showVolumePopupWithTimer();
            break;
          case 'ArrowDown':
            e.preventDefault();
            playerCore.setVolume(Math.max(0, volume - 0.1));
            showVolumePopupWithTimer();
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            toggleFullscreen?.();
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            if (volume > 0) {
              usePlayerStore.getState().setMutedVolume(volume);
              playerCore.setVolume(0);
            } else {
              const prev = usePlayerStore.getState().mutedVolume;
              playerCore.setVolume(prev > 0 ? prev : 1);
            }
            break;
          case 'Escape':
            if (isControlsVisible) {
              e.preventDefault();
              hideControls();
            }
            break;
        }
        return;
      }

      // 视频模式快捷键
      switch (e.key) {
        case ' ':
          e.preventDefault();
          playerCore.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          debouncedSeek(Math.max(0, playerCore.getCurrentTime() - 10));
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const dur = playerCore.getDuration();
          debouncedSeek(Math.min(dur || Infinity, playerCore.getCurrentTime() + 10));
          break;
        }
        case 'ArrowUp':
          e.preventDefault();
          playerCore.setVolume(Math.min(1, volume + 0.1));
          showVolumePopupWithTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          playerCore.setVolume(Math.max(0, volume - 0.1));
          showVolumePopupWithTimer();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          if (volume > 0) {
            usePlayerStore.getState().setMutedVolume(volume);
            playerCore.setVolume(0);
          } else {
            const prev = usePlayerStore.getState().mutedVolume;
            playerCore.setVolume(prev > 0 ? prev : 1);
          }
          break;
        case 'l':
        case 'L': {
          e.preventDefault();
          // 循环模式切换：none → single → list → none
          const currentLoop = usePlayerStore.getState().loopMode;
          const nextLoop = LOOP_CYCLE[(LOOP_CYCLE.indexOf(currentLoop) + 1) % LOOP_CYCLE.length];
          usePlayerStore.getState().setLoopMode(nextLoop);
          break;
        }
        case 'Escape':
          if (isControlsVisible) {
            e.preventDefault();
            hideControls();
          }
          break;
        case '[':
          e.preventDefault();
          onPrevEpisode?.();
          break;
        case ']':
          e.preventDefault();
          onNextEpisode?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
        seekDebounceRef.current = null;
      }
    };
  }, [platform, mode, isControlsVisible, showControls, hideControls, showVolumePopupWithTimer, playerCore, toggleFullscreen, onPrevEpisode, onNextEpisode]);
}
