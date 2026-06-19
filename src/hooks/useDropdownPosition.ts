import { useCallback, useRef, useState } from 'react';

export function useDropdownPosition() {
  const triggerEl = useRef<HTMLDivElement | null>(null);
  const [openUpward, setOpenUpward] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerEl.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const DROPDOWN_MAX_H = 420;
    const SPACE_BELOW = viewportH - rect.bottom;
    setOpenUpward(SPACE_BELOW < DROPDOWN_MAX_H && rect.top > DROPDOWN_MAX_H);
  }, []);

  const refCallback = useCallback((el: HTMLDivElement | null) => {
    triggerEl.current = el;
  }, []);

  return { refCallback, openUpward, updatePosition };
}
