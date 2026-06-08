import { useState, useEffect } from 'react';

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

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsLargeScreen(): boolean {
  return useMediaQuery('(min-width: 1920px)');
}

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

export function useIsTV(): boolean {
  const [isTV] = useState(getIsTV);
  return isTV;
}

export type Orientation = 'portrait' | 'landscape';

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
