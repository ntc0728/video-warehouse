import { useCallback } from 'react';

export function useScreenshot() {
  const handleScreenshot = useCallback(() => {
    const video = document.querySelector('.up-player-video') as HTMLVideoElement | null;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const link = document.createElement('a');
    link.download = `screenshot_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    canvas.remove();
  }, []);

  return { handleScreenshot };
}
