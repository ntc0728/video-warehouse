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
    if (!video) {
      toast.show({ content: '截图失败：视频未就绪', duration: 3000 });
      return;
    }

    // 检查视频是否准备好
    if (video.readyState < 2) {
      toast.show({ content: '截图失败：视频尚未加载完成', duration: 3000 });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.show({ content: '截图失败：无法创建画布', duration: 3000 });
      return;
    }

    try {
      ctx.drawImage(video, 0, 0);
    } catch {
      toast.show({ content: '截图失败：视频源不允许截图', duration: 3000 });
      return;
    }

    // 生成文件名：screenshot_title_YYYYMMDD_HHmmss.png
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = (title || 'video').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
    const filename = `screenshot_${safeTitle}_${dateStr}_${timeStr}.png`;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast.show({ content: `截图已保存: ${filename}`, duration: 3000 });
    } catch {
      toast.show({ content: '截图失败：跨域限制，请更换视频源', duration: 4000 });
    }
  }, [getVideoElement, title]);

  return { handleScreenshot };
}
