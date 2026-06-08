import { Maximize, Minimize } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

interface FullscreenButtonProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

export default function FullscreenButton({ containerRef }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }, [containerRef]);

  return (
    <button className="up-control-btn" onClick={toggleFullscreen} title="全屏 (F)">
      {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
    </button>
  );
}
