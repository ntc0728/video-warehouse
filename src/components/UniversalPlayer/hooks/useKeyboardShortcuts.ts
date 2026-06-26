import { useEffect } from 'react';
import { usePlayerStore } from '@/stores';
import type { PlatformType, PlayerMode } from '@/types/player';

interface UseKeyboardShortcutsOptions {
  platform: PlatformType;
  mode: PlayerMode;
  isControlsVisible: boolean;
  showControls: () => void;
  hideControls: () => void;
  playerCore: { togglePlay: () => void; setVolume: (v: number) => void; seek: (time: number) => void; getCurrentTime: () => number; getDuration: () => number };
  showVolumePopupWithTimer: () => void;
  toggleFullscreen?: () => void;
}

export function useKeyboardShortcuts({
  platform,
  mode,
  isControlsVisible,
  showControls,
  hideControls,
  playerCore,
  showVolumePopupWithTimer,
  toggleFullscreen,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    // TV 平台由 useTVRemote 统一处理，不注册重复监听
    if (platform === 'tv') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const volume = usePlayerStore.getState().volume;

      if (mode === 'iptv') {
        // IPTV 桌面模式：仅处理 Escape 关闭控制栏
        if (e.key === 'Escape' && isControlsVisible) {
          e.preventDefault();
          hideControls();
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
          playerCore.seek(Math.max(0, playerCore.getCurrentTime() - 10));
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const dur = playerCore.getDuration();
          playerCore.seek(Math.min(dur || Infinity, playerCore.getCurrentTime() + 10));
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
        case 'Escape':
          if (isControlsVisible) {
            e.preventDefault();
            hideControls();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [platform, mode, isControlsVisible, showControls, hideControls, showVolumePopupWithTimer, playerCore, toggleFullscreen]);
}
