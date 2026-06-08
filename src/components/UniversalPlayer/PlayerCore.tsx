import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { PlayerMode } from '@/types/player';

interface PlayerCoreProps {
  videoRef: (element: HTMLVideoElement | null) => void;
  mode: PlayerMode;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onClick: (e: React.MouseEvent) => void;
}

export default function PlayerCore({
  videoRef,
  mode,
  isLoading,
  hasError,
  onRetry,
  onClick,
}: PlayerCoreProps) {
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowLoading(false), 300);
      return () => clearTimeout(timer);
    }
    setShowLoading(true);
  }, [isLoading]);

  return (
    <div className="up-player-core" onClick={onClick}>
      <video
        ref={videoRef}
        className="up-player-video"
        playsInline
        autoPlay
        {...(mode === 'live' || mode === 'iptv' ? {} : {})}
      />
      {showLoading && (
        <div className="up-player-loading">
          <Loader2 size={40} className="up-loading-spinner" />
          <span>正在加载...</span>
        </div>
      )}
      {hasError && (
        <div className="up-player-error">
          <div className="up-player-error-content">
            <AlertTriangle size={48} />
            {mode === 'iptv' ? (<p>频道加载失败，请更换其他频道</p>) : (<><p>播放失败，请检查网络连接</p><button className='up-retry-btn' onClick={(e) => { e.stopPropagation(); onRetry(); }}><RefreshCw size={16} /> 重试</button></>)}
          </div>
        </div>
      )}
    </div>
  );
}
