import { Maximize, Minimize, Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { usePlayerStore } from '@/stores';
import { toggleFullscreen, subscribeFullscreen } from '../lib/fullscreen';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface FullscreenButtonProps {
  containerRef: React.RefObject<HTMLElement | null>;
  /** 播放错误态：为真时拒绝全屏切换（C4 三处守卫一致） */
  hasError?: boolean;
}

export default function FullscreenButton({ containerRef, hasError = false }: FullscreenButtonProps) {
  const isFullscreen = usePlayerStore(s => s.isFullscreen);
  const setFullscreen = usePlayerStore(s => s.setFullscreen);

  // 订阅统一全屏管理器：合并「元素级 fullscreenchange / iOS webkitbegin-endfullscreen /
  // CSS 伪全屏」三种来源，iOS 系统全屏与伪全屏都能驱动 isFullscreen。
  useEffect(() => subscribeFullscreen((active) => setFullscreen(active)), [setFullscreen]);

  // C4/R2：与 F 键 / 双击共用 lib/fullscreen 的 toggleFullscreen
  const toggleFullscreenButton = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    await toggleFullscreen(container, container.querySelector('video'), hasError);
  }, [containerRef, hasError]);

  return (
    <button
      className="up-header-fullscreen-btn"
      onClick={toggleFullscreenButton}
      title="全屏 (F)"
      aria-label={isFullscreen ? '退出全屏' : '全屏'}
      aria-pressed={isFullscreen}
    >
      <DuoIcon
        primary={isFullscreen ? Minimize : Maximize}
        secondary={isFullscreen ? Minimize2 : Maximize2}
        size="md"
      />
    </button>
  );
}
