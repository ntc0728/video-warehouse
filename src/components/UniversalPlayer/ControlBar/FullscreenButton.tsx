import { Maximize, Minimize } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { usePlayerStore } from '@/stores';
import { getFullscreenElement, requestFullscreen, exitFullscreen } from '../lib/fullscreen';
import { Icon } from "@/components/ui/Icon";

interface FullscreenButtonProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

export default function FullscreenButton({ containerRef }: FullscreenButtonProps) {
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

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
      } else {
        await requestFullscreen(container);
      }
    } catch {
      // 部分平台不支持或需要用户手势，静默失败
    }
  }, [containerRef]);

  return (
    <button
      onClick={toggleFullscreen}
      title="全屏 (F)"
      aria-label={isFullscreen ? '退出全屏' : '全屏'}
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? <Icon icon={Minimize} size="md" /> : <Icon icon={Maximize} size="md" />}
    </button>
  );
}
