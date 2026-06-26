import { useState, useEffect } from 'react';

/**
 * 监听 CSS 媒体查询的 Hook
 * @param query CSS 媒体查询表达式，如 '(max-width: 1023px)'
 * @returns 当前是否匹配该媒体查询
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 检测当前设备是否为触控设备
 * @returns 是否支持触摸输入
 */
export function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 0;
}

/** 检测是否为移动端（视口宽度 < 1024px） */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

/** 检测是否为平板端（视口宽度 768px ~ 1023px） */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/** 检测是否为桌面端（视口宽度 >= 1024px） */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/** 检测是否为大屏幕（视口宽度 >= 1920px） */
export function useIsLargeScreen(): boolean {
  return useMediaQuery('(min-width: 1920px)');
}

/**
 * 通过 User-Agent 检测是否为电视设备
 * 支持 WebOS、Tizen、Roku、Apple TV、PlayStation、Xbox、Google TV 等
 * @returns 是否为电视设备
 */
export function getIsTV(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('tv') ||
    ua.includes('smart-tv') ||
    ua.includes('hbbtv') ||
    ua.includes('roku') ||
    ua.includes('viera') ||
    ua.includes('webos') ||
    ua.includes('tizen') ||
    ua.includes('googletv') ||
    ua.includes('appletv') ||
    ua.includes('crkey') ||
    ua.includes('playstation') ||
    ua.includes('xbox')
  );
}

/** 电视设备检测 Hook，基于 getIsTV 的状态化封装 */
export function useIsTV(): boolean {
  const [isTV] = useState(getIsTV);
  return isTV;
}

/** 屏幕方向类型 */
export type Orientation = 'portrait' | 'landscape';

/** 监听屏幕方向变化的 Hook */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'landscape' : 'portrait');
    };
    mql.addEventListener('change', handler);
    setOrientation(mql.matches ? 'landscape' : 'portrait');
    return () => mql.removeEventListener('change', handler);
  }, []);

  return orientation;
}
