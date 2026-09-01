import { AlertTriangle, ListVideo, RefreshCw } from 'lucide-react';
import { usePlayerStore } from '@/stores';
import type { PlayerMode } from '@/types/player';
import { Icon } from "@/components/ui/Icon";
import { detectDeviceCaps, getVideoCompatAttrs } from './lib/deviceCaps';

// <video> 兼容属性须首帧渲染即存在（iOS 不认运行时补的 webkit-playsinline；X5 须静态
// 写出 x5-video-player-type 等同层属性）。模块级探测一次即可。
// 注：webkit-playsinline / x5-* 等非标准属性不在 React 类型里，运行时 React 会原样渲染，
// 这里用 unknown 桥接绕过 TS 校验。
const VIDEO_COMPAT_ATTRS = getVideoCompatAttrs(detectDeviceCaps()) as unknown as React.HTMLAttributes<HTMLVideoElement>;

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
  /** P1-3 预留：错误态「切换播放源」入口（PlayerPage 接线后启用） */
  onSwitchSource?: () => void;
}

const RATIO_CONTAINER_STYLES: Record<string, React.CSSProperties> = {
  fill: { width: '100%', height: '100%' },
};

// 画面比例覆盖语义与 PotPlayer/VLC 一致：内容拉伸填充所选比例框（objectFit: fill）。
// 若用 contain，内容始终按固有比例显示、只会在框内加黑边——比例选择不改变画面几何，
// 无法纠正 CMS 源常见的 DAR 元数据错误（如 4:3 内容被标 16:9）。
// 居中用 margin:auto（.up-player-video 已是 absolute + inset:0），不再引入 translateX/Y
// transform，减少视频合成层在后台页签被冻结的面。
const RATIO_VIDEO_STYLES: Record<string, React.CSSProperties> = {
  '4:3': { margin: 'auto', width: 'auto', height: '100%', aspectRatio: '4/3', objectFit: 'fill' },
  '16:9': { margin: 'auto', width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'fill' },
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
  onSwitchSource,
}: PlayerCoreProps) {
  const mirror = usePlayerStore(s => s.mirror);
  const aspectRatio = usePlayerStore(s => s.aspectRatio);
  const isPiP = usePlayerStore(s => s.isPiP);
  // Issue4 色彩调整：亮度/饱和度/对比度经 CSS filter 应用到视频（手势与弹窗共用同一 store 字段）
  const colorFilter = usePlayerStore(s => s.colorFilter);
  // 外挂字幕渲染管线：subtitleUrl（blob VTT）此前只存 store 无消费方，导入字幕从未显示
  const subtitleUrl = usePlayerStore(s => s.subtitleUrl);
  const subtitleEnabled = usePlayerStore(s => s.subtitleEnabled);
  // P1-3：错误覆盖层透传具体错误文案（adapter/native error 写入 store）
  const errorMessage = usePlayerStore(s => s.errorMessage);

  const containerStyle = RATIO_CONTAINER_STYLES[aspectRatio];

  // PiP 模式下强制 16:9 比例，避免画中画窗口比例过方（contain 防止 PiP 窗内变形）
  const ratioStyle = isPiP ? { aspectRatio: '16/9', objectFit: 'contain' as const } : RATIO_VIDEO_STYLES[aspectRatio];
  const colorFilterCss =
    colorFilter.brightness === 1 && colorFilter.saturation === 1 && colorFilter.contrast === 1
      ? undefined
      : `brightness(${colorFilter.brightness}) saturate(${colorFilter.saturation}) contrast(${colorFilter.contrast})`;
  const videoStyle: React.CSSProperties = {
    ...ratioStyle,
    transform: mirror ? 'scaleX(-1)' : undefined,
    filter: colorFilterCss,
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
        {...VIDEO_COMPAT_ATTRS}
        preload="auto"
      >
        {/* 外挂字幕轨：仅点播模式；key=subtitleUrl 保证换字幕文件时重建轨；关闭时卸载 track 隐藏 */}
        {mode === 'video' && subtitleUrl && subtitleEnabled && (
          <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} default />
        )}
      </video>

      {hasError && (
        <div className="up-player-error">
          <div className="up-player-error-content">
            <Icon icon={AlertTriangle} size="3xl" />
            {mode === 'iptv' ? (
              <p>{errorMessage || '频道加载失败，请更换其他频道'}</p>
            ) : (
              <p>{errorMessage || '播放失败，请检查网络连接'}</p>
            )}
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
            {mode !== 'iptv' && onSwitchSource && (
              <button
                type="button"
                className="up-error-actions-btn"
                onClick={(e) => { e.stopPropagation(); onSwitchSource(); }}
              >
                <Icon icon={ListVideo} size="xs" />
                <span>切换播放源</span>
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
