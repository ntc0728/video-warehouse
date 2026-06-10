import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, RefreshCw, ListVideo } from 'lucide-react';
import type { PlayerMode } from '@/types/player';

interface PlayerCoreProps {
  videoRef: (element: HTMLVideoElement | null) => void;
  mode: PlayerMode;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onClick: (e: React.MouseEvent) => void;
  /** IPTV 错误态快捷入口：唤起频道列表 */
  onOpenChannelList?: () => void;
}

export default function PlayerCore({
  videoRef,
  mode,
  isLoading,
  hasError,
  onRetry,
  onClick,
  onOpenChannelList,
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
      {hasError && mode === 'iptv' && (
        <div className="up-error-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="up-error-actions-btn up-error-actions-btn-primary"
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
          >
            <RefreshCw size={14} />
            <span>重试当前频道</span>
          </button>
          <button
            type="button"
            className="up-error-actions-btn"
            onClick={(e) => { e.stopPropagation(); onOpenChannelList?.(); }}
          >
            <ListVideo size={14} />
            <span>切换频道</span>
          </button>
        </div>
      )}
    </div>
  );
}
