import { useCallback, useRef } from 'react';

interface UseFocusableOptions {
  isTV?: boolean;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
}

export function useFocusable(options: UseFocusableOptions = {}) {
  const { isTV, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight } = options;
  const ref = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isTV) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          onEnter?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onArrowRight?.();
          break;
      }
    },
    [isTV, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]
  );

  return {
    ref,
    tabIndex: isTV ? 0 : undefined,
    onKeyDown: isTV ? handleKeyDown : undefined,
    focusVisibleClass: isTV ? 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface' : '',
  };
}
