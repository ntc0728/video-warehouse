import { Maximize, Minimize } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { getFullscreenElement, requestFullscreen, exitFullscreen } from '../lib/fullscreen';

interface FullscreenButtonProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

export default function FullscreenButton({ containerRef }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!getFullscreenElement());
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

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
    <button className="up-control-btn" onClick={toggleFullscreen} title="全屏 (F)">
      {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
    </button>
  );
}
