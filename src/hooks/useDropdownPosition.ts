import { useState, useEffect, useRef, useCallback } from 'react';
import { useThrottle } from './useThrottle';

/** 下拉框定位信息 */
interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * 计算下拉框位置的 Hook
 * 基于触发按钮的视口坐标，计算下拉框应出现的位置，确保不超出视口。
 */
export function useDropdownPosition(isOpen: boolean) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!isOpen || !triggerRef.current) {
      setPosition(null);
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const dropdownMaxHeight = 280;
    const gap = 8;
    const spaceBelow = viewportHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;

    let top: number;
    let maxHeight: number;

    if (spaceBelow >= dropdownMaxHeight) {
      top = rect.bottom + gap;
      maxHeight = dropdownMaxHeight;
    } else if (spaceBelow >= 200) {
      top = rect.bottom + gap;
      maxHeight = spaceBelow;
    } else if (spaceAbove >= dropdownMaxHeight) {
      top = rect.top - gap;
      maxHeight = dropdownMaxHeight;
    } else {
      top = rect.bottom + gap;
      maxHeight = Math.max(spaceBelow, spaceAbove);
    }

    const left = Math.min(rect.left, viewportWidth - rect.width - 16);

    setPosition({ top, left, width: rect.width, maxHeight });
  }, [isOpen]);

  const throttledUpdate = useThrottle(updatePosition);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('scroll', throttledUpdate, true);
    window.addEventListener('resize', throttledUpdate);

    return () => {
      window.removeEventListener('scroll', throttledUpdate, true);
      window.removeEventListener('resize', throttledUpdate);
    };
  }, [isOpen, throttledUpdate]);

  return { triggerRef, position };
}
