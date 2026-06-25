export function getFullscreenElement() {
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return document.fullscreenElement
    || d.webkitFullscreenElement
    || d.msFullscreenElement
    || null;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function requestFullscreen(el: HTMLElement) {
  const r = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };

  // iOS Safari: use video-level fullscreen for proper system integration
  if (isIOS()) {
    const video = el.querySelector('video') || el.closest('.up-player-core')?.querySelector('video');
    const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void };
    if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
      return;
    }
    // Fallback: request fullscreen on document element for best compatibility
    if (document.documentElement.requestFullscreen) {
      return document.documentElement.requestFullscreen();
    }
  }

  // Standard + vendor prefixes
  if (r.requestFullscreen) return r.requestFullscreen();
  if (r.webkitRequestFullscreen) return r.webkitRequestFullscreen();
  if (r.mozRequestFullScreen) return r.mozRequestFullScreen();
  if (r.msRequestFullscreen) return r.msRequestFullscreen();

  // Last resort: fullscreen on document root
  if (document.documentElement.requestFullscreen) {
    return document.documentElement.requestFullscreen();
  }
}

export async function exitFullscreen(videoElement?: HTMLVideoElement | null) {
  const d = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
  };

  // Check if iOS video fullscreen is active
  const video = videoElement ?? document.querySelector('.up-player-video');
  const v = video as (HTMLVideoElement & { webkitExitFullscreen?: () => void }) | null;
  if (v?.webkitExitFullscreen && isIOS()) {
    v.webkitExitFullscreen();
    return;
  }

  if (d.exitFullscreen) return d.exitFullscreen();
  if (d.webkitExitFullscreen) return d.webkitExitFullscreen();
  if (d.mozCancelFullScreen) return d.mozCancelFullScreen();
  if (d.msExitFullscreen) return d.msExitFullscreen();
}
