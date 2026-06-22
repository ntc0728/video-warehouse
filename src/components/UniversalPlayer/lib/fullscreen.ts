export function getFullscreenElement() {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement || d.webkitFullscreenElement || null;
}

export async function requestFullscreen(el: HTMLElement) {
  const r = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
  };
  if (r.webkitRequestFullscreen) return r.webkitRequestFullscreen();
  if (r.mozRequestFullScreen) return r.mozRequestFullScreen();
  return el.requestFullscreen();
}

export async function exitFullscreen() {
  const d = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
  };
  if (d.webkitExitFullscreen) return d.webkitExitFullscreen();
  if (d.mozCancelFullScreen) return d.mozCancelFullScreen();
  return d.exitFullscreen();
}
