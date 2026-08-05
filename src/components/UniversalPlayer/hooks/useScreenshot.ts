import { useCallback } from 'react';
import { usePlayerElement } from '../context/PlayerContext';
import { toast } from '@/components/ui/toastBus';

interface UseScreenshotOptions {
  title?: string;
}

/**
 * 播放器截图 Hook
 * 成功 → success 提示；失败 → error 提示（统一 3s 由 toastBus 兜底）
 */
export function useScreenshot({ title }: UseScreenshotOptions = {}) {
  const { getVideoElement } = usePlayerElement();

  const handleScreenshot = useCallback(() => {
    const video = getVideoElement();
    if (!video) {
      toast.show({ content: '截图失败：视频未就绪', type: 'error' });
      return;
    }

    // 检查视频是否准备好
    if (video.readyState < 2) {
      toast.show({ content: '截图失败：视频尚未加载完成', type: 'error' });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.show({ content: '截图失败：无法创建画布', type: 'error' });
      return;
    }

    try {
      ctx.drawImage(video, 0, 0);
    } catch {
      toast.show({ content: '截图失败：视频源不允许截图', type: 'error' });
      return;
    }

    // 生成文件名：screenshot_title_YYYYMMDD_HHmmss.png
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = (title || 'video').replace(/[<>:\"/\\\\|?*]/g, '_').slice(0, 50);
    const filename = `screenshot_${safeTitle}_${dateStr}_${timeStr}.png`;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast.show({ content: `截图已保存: ${filename}`, type: 'success' });
    } catch {
      toast.show({ content: '截图失败：跨域限制，请更换视频源', type: 'error' });
    }
  }, [getVideoElement, title]);

  return { handleScreenshot };
}
