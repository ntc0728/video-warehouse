import { AlertTriangle, ListVideo, RefreshCw } from 'lucide-react';
import { usePlayerStore } from '@/stores';
import type { PlayerMode } from '@/types/player';
import { Icon } from "@/components/ui/Icon";

interface PlayerCoreProps {
  videoRef: (element: HTMLVideoElement | null) => void;
  mode: PlayerMode;
  hasError: boolean;
  onClick: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerLeave?: () => void;
  /** IPTV 错误态快捷入口：唤起频道列表 */
  onOpenChannelList?: () => void;
  /** 重试播放 */
  onRetry?: () => void;
}

const RATIO_CONTAINER_STYLES: Record<string, React.CSSProperties> = {
  fill: { width: '100%', height: '100%' },
};

const RATIO_VIDEO_STYLES: Record<string, React.CSSProperties> = {
  '4:3': { top: '0', bottom: '0', left: '50%', right: 'auto', width: 'auto', height: '100%', aspectRatio: '4/3', objectFit: 'contain', transform: 'translateX(-50%)' },
  '16:9': { left: '0', right: '0', top: '50%', bottom: 'auto', width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'contain', transform: 'translateY(-50%)' },
  fill: { objectFit: 'fill' },
};

export default function PlayerCore({
  videoRef,
  mode,
  hasError,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerMove,
  onPointerLeave,
  onOpenChannelList,
  onRetry,
}: PlayerCoreProps) {
  const mirror = usePlayerStore(s => s.mirror);
  const aspectRatio = usePlayerStore(s => s.aspectRatio);
  const isPiP = usePlayerStore(s => s.isPiP);

  const containerStyle = RATIO_CONTAINER_STYLES[aspectRatio];
  const mirrorTransform = mirror ? 'scaleX(-1)' : '';

  // PiP 模式下强制 16:9 比例，避免画中画窗口比例过方
  const ratioStyle = isPiP ? { aspectRatio: '16/9', objectFit: 'contain' as const, transform: '' } : RATIO_VIDEO_STYLES[aspectRatio];
  const ratioTransform = ratioStyle?.transform || '';
  const videoStyle: React.CSSProperties = {
    ...ratioStyle,
    transform: [mirrorTransform, ratioTransform].filter(Boolean).join(' ') || undefined,
  };

  return (
    <div
      className="up-player-core"
      data-mode={mode}
      style={containerStyle}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
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
            <Icon icon={AlertTriangle} size="3xl" />
            {mode === 'iptv' ? (<p>频道加载失败，请更换其他频道</p>) : (<p>播放失败，请检查网络连接</p>)}
          </div>
          <div className="up-error-actions" onClick={(e) => e.stopPropagation()}>
            {mode === 'iptv' && onOpenChannelList && (
              <button
                type="button"
                className="up-error-actions-btn"
                onClick={(e) => { e.stopPropagation(); onOpenChannelList(); }}
              >
                <Icon icon={ListVideo} size="xs" />
                <span>切换频道</span>
              </button>
            )}
            {mode !== 'iptv' && onRetry && (
              <button
                type="button"
                className="up-error-actions-btn"
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
              >
                <Icon icon={RefreshCw} size="xs" />
                <span>重试</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
