export function preventPinchZoom(): void {
  if (typeof window === 'undefined') return;
  const isMobile =
    window.matchMedia('(pointer: coarse)').matches ||
    /Mobi|Android/i.test(navigator.userAgent);
  if (!isMobile) return;

  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
}
