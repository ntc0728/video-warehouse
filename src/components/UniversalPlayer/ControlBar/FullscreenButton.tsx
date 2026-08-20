import { Maximize, Minimize, Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { usePlayerStore } from '@/stores';
import { getFullscreenElement, toggleFullscreen } from '../lib/fullscreen';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface FullscreenButtonProps {
  containerRef: React.RefObject<HTMLElement | null>;
  /** 播放错误态：为真时拒绝全屏切换（C4 三处守卫一致） */
  hasError?: boolean;
}

export default function FullscreenButton({ containerRef, hasError = false }: FullscreenButtonProps) {
  const isFullscreen = usePlayerStore(s => s.isFullscreen);
  const setFullscreen = usePlayerStore(s => s.setFullscreen);

  useEffect(() => {
    const handleChange = () => {
      setFullscreen(!!getFullscreenElement());
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('msfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('msfullscreenchange', handleChange);
    };
  }, [setFullscreen]);

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
