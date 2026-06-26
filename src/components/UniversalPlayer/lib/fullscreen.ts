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

  // iOS Safari：使用视频级全屏以获得正确的系统集成
  if (isIOS()) {
    const video = el.querySelector('video') || el.closest('.up-player-core')?.querySelector('video');
    const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void };
    if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
      return;
    }
    // 回退方案：在 documentElement 上请求全屏以获得最佳兼容性
    if (document.documentElement.requestFullscreen) {
      return document.documentElement.requestFullscreen();
    }
  }

  // 标准 API + 浏览器前缀
  if (r.requestFullscreen) return r.requestFullscreen();
  if (r.webkitRequestFullscreen) return r.webkitRequestFullscreen();
  if (r.mozRequestFullScreen) return r.mozRequestFullScreen();
  if (r.msRequestFullscreen) return r.msRequestFullscreen();

  // 最后手段：在 document 根元素上全屏
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

  // 检查 iOS 视频全屏是否处于激活状态
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
