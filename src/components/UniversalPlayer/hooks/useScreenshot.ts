import { useCallback } from 'react';
import { usePlayerElement } from '../context/PlayerContext';
import { toast } from '@/components/ui';

interface UseScreenshotOptions {
  title?: string;
}

export function useScreenshot({ title }: UseScreenshotOptions = {}) {
  const { getVideoElement } = usePlayerElement();

  const handleScreenshot = useCallback(() => {
    const video = getVideoElement();
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // 生成文件名：screenshot_title_YYYYMMDD_HHmmss.png
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = (title || 'video').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
    const filename = `screenshot_${safeTitle}_${dateStr}_${timeStr}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast.show({ content: `截图已保存: ${filename}`, duration: 3000 });
  }, [getVideoElement, title]);

  return { handleScreenshot };
}
