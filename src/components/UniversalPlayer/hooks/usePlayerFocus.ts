import { useState, useCallback, useRef } from 'react';
import type { PlatformType } from '@/types/player';

interface FocusableItem {
  id: string;
  ref: HTMLElement | null;
}

interface UsePlayerFocusOptions {
  platform: PlatformType;
  items: FocusableItem[];
}

export function usePlayerFocus({ platform, items }: UsePlayerFocusOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const navigate = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;

    setFocusedIndex(prev => {
      if (prev === -1) return 0;

      let next = prev;
      switch (direction) {
        case 'left':
          next = Math.max(0, prev - 1);
          break;
        case 'right':
          next = Math.min(currentItems.length - 1, prev + 1);
          break;
        case 'up':
          next = Math.max(0, prev - 5);
          break;
        case 'down':
          next = Math.min(currentItems.length - 1, prev + 5);
          break;
      }

      currentItems[next]?.ref?.focus();
      return next;
    });
  }, []);

  const confirm = useCallback(() => {
    const currentItems = itemsRef.current;
    if (focusedIndex >= 0 && focusedIndex < currentItems.length) {
      const item = currentItems[focusedIndex];
      if (item?.ref) {
        item.ref.click();
      }
    }
  }, [focusedIndex]);

  const resetFocus = useCallback(() => {
    setFocusedIndex(-1);
  }, []);

  const isFocused = useCallback((index: number) => {
    return platform === 'tv' && focusedIndex === index;
  }, [platform, focusedIndex]);

  return {
    focusedIndex,
    navigate,
    confirm,
    resetFocus,
    isFocused,
  };
}
