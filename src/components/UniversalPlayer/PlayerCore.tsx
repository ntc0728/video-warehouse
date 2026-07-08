import { AlertTriangle, ListVideo, RefreshCw } from 'lucide-react';
import { usePlayerStore } from '@/stores';
import type { PlayerMode } from '@/types/player';

interface PlayerCoreProps {
  videoRef: (element: HTMLVideoElement | null) => void;
  mode: PlayerMode;
  hasError: boolean;
  onClick: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerLeave?: () => void;
  /** IPTV 错误态快捷入口：唤起频道列表 */
  onOpenChannelList?: () => void;
  /** 重试播放 */
  onRetry?: () => void;
}

const RATIO_STYLES: Record<string, React.CSSProperties> = {
  '4:3': { objectFit: 'contain', aspectRatio: '4/3' },
  '16:9': { objectFit: 'contain', aspectRatio: '16/9' },
  fill: { objectFit: 'fill' },
};

export default function PlayerCore({
  videoRef,
  mode,
  hasError,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onOpenChannelList,
  onRetry,
}: PlayerCoreProps) {
  const mirror = usePlayerStore(s => s.mirror);
  const aspectRatio = usePlayerStore(s => s.aspectRatio);

  const videoStyle: React.CSSProperties = {
    ...(mirror ? { transform: 'scaleX(-1)' } : {}),
    ...RATIO_STYLES[aspectRatio],
  };

  return (
    <div
      className="up-player-core"
      data-mode={mode}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <video
        ref={videoRef}
        className="up-player-video"
        style={videoStyle}
        playsInline
        preload="auto"
      />

      {hasError && (
        <div className="up-player-error">
          <div className="up-player-error-content">
            <AlertTriangle size={48} />
            {mode === 'iptv' ? (<p>频道加载失败，请更换其他频道</p>) : (<p>播放失败，请检查网络连接</p>)}
          </div>
        </div>
      )}
      {hasError && (
        <div className="up-error-actions" onClick={(e) => e.stopPropagation()}>
          {mode === 'iptv' && onOpenChannelList && (
            <button
              type="button"
              className="up-error-actions-btn"
              onClick={(e) => { e.stopPropagation(); onOpenChannelList(); }}
            >
              <ListVideo size={14} />
              <span>切换频道</span>
            </button>
          )}
          {mode !== 'iptv' && onRetry && (
            <button
              type="button"
              className="up-error-actions-btn"
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
            >
              <RefreshCw size={14} />
              <span>重试</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
