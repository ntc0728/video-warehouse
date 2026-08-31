import { useCallback } from 'react';
import { usePlayerElement } from '../context/PlayerContext';
import { playerToastCenter } from '../PlayerToast';

interface UseScreenshotOptions {
  title?: string;
}

/**
 * 播放器截图 Hook
 * 成功 → success 提示；失败 → error 提示。
 * 统一走播放器内「屏幕居中」toast（playerToastCenter），不依赖全局 sonner 的
 * 视口级居中 CSS——避免出现「提示出现在页面顶部而非播放器内居中」的问题。
 */
export function useScreenshot({ title }: UseScreenshotOptions = {}) {
  const { getVideoElement } = usePlayerElement();

  const handleScreenshot = useCallback(() => {
    const video = getVideoElement();
    if (!video) {
      playerToastCenter('截图失败：视频未就绪', 2500, 'error');
      return;
    }

    // 检查视频是否准备好
    if (video.readyState < 2) {
      playerToastCenter('截图失败：视频尚未加载完成', 2500, 'error');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      playerToastCenter('截图失败：无法创建画布', 2500, 'error');
      return;
    }

    try {
      ctx.drawImage(video, 0, 0);
    } catch {
      playerToastCenter('截图失败：视频源不允许截图', 2500, 'error');
      return;
    }

    // 生成文件名：screenshot_title_YYYYMMDD_HHmmss.png
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = (title || 'video').replace(/[<>:\"/\\|?*]/g, '_').slice(0, 50);
    const filename = `screenshot_${safeTitle}_${dateStr}_${timeStr}.png`;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      playerToastCenter(`截图已保存: ${filename}`, 2500, 'success');
    } catch {
      playerToastCenter('截图失败：跨域限制，请更换视频源', 2500, 'error');
    }
  }, [getVideoElement, title]);

  return { handleScreenshot };
}
