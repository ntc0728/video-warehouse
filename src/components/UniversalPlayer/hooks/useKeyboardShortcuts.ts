import { useEffect } from 'react';
import { usePlayerStore } from '@/stores';

interface UseKeyboardShortcutsOptions {
  platform: string;
  mode: string;
  isChannelListVisible: boolean;
  isControlsVisible: boolean;
  showControls: () => void;
  hideControls: () => void;
  playerCore: { togglePlay: () => void; setVolume: (v: number) => void };
  showVolumePopupWithTimer: () => void;
}

export function useKeyboardShortcuts({
  platform,
  mode,
  isChannelListVisible,
  isControlsVisible,
  showControls,
  hideControls,
  playerCore,
  showVolumePopupWithTimer,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (platform !== 'tv' || mode !== 'iptv') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChannelListVisible) return;

      const volume = usePlayerStore.getState().volume;

      switch (e.key) {
        case 'F1':
        case 'Info':
          e.preventDefault();
          if (isControlsVisible) {
            hideControls();
          } else {
            showControls();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (isControlsVisible) {
            hideControls();
          } else {
            showControls();
          }
          break;
        case 'ArrowUp':
        case 'VolumeUp':
          e.preventDefault();
          playerCore.setVolume(Math.min(1, volume + 0.1));
          showVolumePopupWithTimer();
          break;
        case 'ArrowDown':
        case 'VolumeDown':
          e.preventDefault();
          playerCore.setVolume(Math.max(0, volume - 0.1));
          showVolumePopupWithTimer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [platform, mode, isChannelListVisible, isControlsVisible, showControls, hideControls, showVolumePopupWithTimer, playerCore]);
}
