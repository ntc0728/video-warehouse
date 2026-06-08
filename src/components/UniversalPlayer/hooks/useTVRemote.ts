import { useEffect, useRef } from 'react';

export interface TVRemoteOptions {
  platform: string;
  isChannelListVisible: boolean;
  onBack: () => void;
  onTogglePlay: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onToggleChannelList: () => void;
  onFocusMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onFocusConfirm: () => void;
  onDigitInput: (digit: number) => void;
}

export function useTVRemote(opts: TVRemoteOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (opts.platform !== 'tv') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = optsRef.current;

      if (e.key === 'Menu' || e.key === 'ContextMenu') {
        e.preventDefault();
        current.onToggleChannelList();
        return;
      }

      if (current.isChannelListVisible) {
        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowDown':
          case 'ArrowLeft':
          case 'ArrowRight':
            e.preventDefault();
            current.onFocusMove(e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right');
            return;
          case 'Enter':
            e.preventDefault();
            current.onFocusConfirm();
            return;
          case 'Backspace':
          case 'Escape':
            current.onToggleChannelList();
            return;
          default:
            if (/^[0-9]$/.test(e.key)) {
              e.preventDefault();
              current.onDigitInput(parseInt(e.key, 10));
              return;
            }
            break;
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          current.onFocusMove(e.key.replace('Arrow', '').toLowerCase() as 'left' | 'right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          current.onVolumeUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          current.onVolumeDown();
          break;
        case 'VolumeUp':
          current.onVolumeUp();
          break;
        case 'VolumeDown':
          current.onVolumeDown();
          break;
        case ' ':
        case 'Play':
        case 'MediaPlayPause':
          e.preventDefault();
          current.onTogglePlay();
          break;
        case 'Back':
        case 'Escape':
          current.onBack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opts.platform]);
}