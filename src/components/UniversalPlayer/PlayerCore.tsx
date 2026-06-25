import { AlertTriangle, RefreshCw, ListVideo } from 'lucide-react';
import type { PlayerMode } from '@/types/player';

interface PlayerCoreProps {
  videoRef: (element: HTMLVideoElement | null) => void;
  mode: PlayerMode;
  hasError: boolean;
  onRetry: () => void;
  onClick: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerLeave?: () => void;
  /** IPTV 错误态快捷入口：唤起频道列表 */
  onOpenChannelList?: () => void;
}

export default function PlayerCore({
  videoRef,
  mode,
  hasError,
  onRetry,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onOpenChannelList,
}: PlayerCoreProps) {
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
        playsInline
      />

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
