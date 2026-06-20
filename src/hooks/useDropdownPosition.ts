import { useCallback, useRef, useState } from 'react';

export function useDropdownPosition() {
  const triggerEl = useRef<HTMLDivElement | null>(null);
  const openUpwardRef = useRef(false);
  const [openUpward, setOpenUpward] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerEl.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const DROPDOWN_MAX_H = 420;
    const SPACE_BELOW = viewportH - rect.bottom;
    const shouldOpenUpward = SPACE_BELOW < DROPDOWN_MAX_H && rect.top > DROPDOWN_MAX_H;
    if (openUpwardRef.current !== shouldOpenUpward) {
      openUpwardRef.current = shouldOpenUpward;
      setOpenUpward(shouldOpenUpward);
    }
  }, []);

  const refCallback = useCallback((el: HTMLDivElement | null) => {
    triggerEl.current = el;
  }, []);

  return { refCallback, openUpward, updatePosition };
}
