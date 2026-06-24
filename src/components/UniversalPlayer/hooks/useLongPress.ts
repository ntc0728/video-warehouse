import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onSeek: (direction: 'left' | 'right') => void;
}

const LONG_PRESS_DELAY = 500;
const SEEK_INTERVAL = 500;

export function useLongPress({ onSeek }: UseLongPressOptions) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLongPressedRef = useRef(false);
  const [seekIndicator, setSeekIndicator] = useState<'left' | 'right' | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    setSeekIndicator(null);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.up-control-bar') || target.closest('.up-player-header') || target.closest('.up-channel-list-overlay') || target.closest('.iptv-osd-bar') || target.closest('.iptv-volume-popup')) {
      return;
    }

    hasLongPressedRef.current = false;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const isLeftSide = relX < rect.width * 0.4;
    const isRightSide = relX > rect.width * 0.6;

    if (!isLeftSide && !isRightSide) return;

    const direction = isLeftSide ? 'left' : 'right';

    // Delay seek + indicator to distinguish tap from long-press
    longPressTimerRef.current = setTimeout(() => {
      setSeekIndicator(direction);
      hasLongPressedRef.current = true;
      onSeek(direction);
      seekIntervalRef.current = setInterval(() => onSeek(direction), SEEK_INTERVAL);
    }, LONG_PRESS_DELAY);
  }, [onSeek]);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  return {
    seekIndicator,
    hasLongPressedRef,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
  };
}
