import { useRef, useCallback, useState, useEffect } from 'react';
import type { PlayerMode } from '@/types/player';
import ThumbnailPreview, { type ThumbnailSource } from './ThumbnailPreview';

interface ProgressBarProps {
  mode: PlayerMode;
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
  /** G1：hover 缩略图源（可选）；缺省时 tooltip 仅显示时间戳 */
  thumbnails?: ThumbnailSource;
  /**
   * P1-11：缓冲中拖拽钳制——向前拖不超出已缓冲区间（向后不受限），
   * 兼顾「缓冲中不可乱拖」与「防缓冲锁死」（审查报告 1.4 折中方案）
   */
  isBuffering?: boolean;
}

function getClientX(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): number {
  if ('touches' in e) {
    return e.touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0]?.clientX ?? 0;
  }
  return (e as MouseEvent).clientX;
}

export default function ProgressBar({ mode, currentTime, duration, buffered, onSeek, thumbnails, isBuffering = false }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  // 松手后保持目标位置，直到 timeupdate 追上或超时
  const [pendingTime, setPendingTime] = useState<number | null>(null);
  const [pendingPosition, setPendingPosition] = useState(0);

  const isLive = mode === 'live';

  const calcTime = useCallback((clientX: number): number => {
    if (!barRef.current || duration <= 0) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const updateFromEvent = useCallback((clientX: number) => {
    // Issue3：缓冲中（非拖拽）hover 不更新圆点/tooltip 位置——避免「圆点跟随鼠标」的误导
    if (!isDragging && isBuffering) return;
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    // hover 预览始终更新（tooltip），但非拖拽不触发 seek（thumb 不跟随鼠标）
    setHoverTime(time);
    setHoverPosition((time / duration) * 100);
    if (isDragging) {
      setPendingTime(time);
      setPendingPosition((time / duration) * 100);
      onSeek(time);
    }
  }, [duration, isDragging, isBuffering, onSeek]);

  const beginDrag = useCallback((clientX: number) => {
    // 直播 / 无时长 禁止拖拽；Issue3：缓冲中允许自由 seek（点击即跳到目标位置，
    // 以最后一次点击为准；浏览器会自动缓冲到该区间），不再钳制到已缓冲区间（避免「圆点复位到 0」）
    if (isLive || duration <= 0) return;
    setIsDragging(true);
    const time = calcTime(clientX);
    const ratio = (time / duration) * 100;
    setHoverTime(time);
    setHoverPosition(ratio);
    setPendingTime(time);
    setPendingPosition(ratio);
    onSeek(time);
  }, [isLive, duration, calcTime, onSeek]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    beginDrag(e.clientX);
  }, [beginDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateFromEvent(e.clientX);
  }, [updateFromEvent]);

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    beginDrag(getClientX(e));
  }, [beginDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    updateFromEvent(getClientX(e));
  }, [updateFromEvent]);

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => endDrag();
      let mouseRafId = 0;
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (mouseRafId) return;
        mouseRafId = requestAnimationFrame(() => {
          if (barRef.current && duration > 0) {
            const rect = barRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = ratio * duration;
            setPendingTime(time);
            setPendingPosition((time / duration) * 100);
            onSeek(time);
          }
          mouseRafId = 0;
        });
      };
      let touchRafId = 0;
      const handleGlobalTouchMove = (e: TouchEvent) => {
        if (touchRafId) return;
        touchRafId = requestAnimationFrame(() => {
          if (barRef.current && duration > 0) {
            e.preventDefault();
            const rect = barRef.current.getBoundingClientRect();
            const clientX = getClientX(e);
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const time = ratio * duration;
            setPendingTime(time);
            setPendingPosition((time / duration) * 100);
            onSeek(time);
          }
          touchRafId = 0;
        });
      };
      const handleGlobalTouchEnd = () => endDrag();
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', handleGlobalTouchEnd);
      return () => {
        if (mouseRafId) cancelAnimationFrame(mouseRafId);
        if (touchRafId) cancelAnimationFrame(touchRafId);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('touchmove', handleGlobalTouchMove);
        window.removeEventListener('touchend', handleGlobalTouchEnd);
      };
    }
  }, [isDragging, duration, onSeek, endDrag]);

  // pendingTime 追上 currentTime 时清除 pending 状态
  useEffect(() => {
    if (pendingTime !== null && !isDragging && Math.abs(currentTime - pendingTime) < 0.5) {
      setPendingTime(null);
    }
  }, [currentTime, pendingTime, isDragging]);

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const progress = duration > 0 && Number.isFinite(duration) ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 && Number.isFinite(duration) ? (buffered / duration) * 100 : 0;
  // 拖动中或松手后的过渡期内保持显示目标位置，不跳回旧值
  const showPending = isDragging || pendingTime !== null;
  const displayPercent = showPending
    ? (hoverTime !== null ? hoverPosition : (pendingTime !== null ? pendingPosition : progress))
    : progress;
  const displayTime = (displayPercent / 100) * duration;

  // P0-2：键盘操作进度（role=slider 标准交互；Shift 加速步长）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isLive || duration <= 0) return;
    const step = e.shiftKey ? 30 : 5;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        onSeek(Math.max(0, currentTime - step));
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        onSeek(Math.min(duration, currentTime + step));
        break;
      case 'PageUp':
        onSeek(Math.min(duration, currentTime + 60));
        break;
      case 'PageDown':
        onSeek(Math.max(0, currentTime - 60));
        break;
      case 'Home':
        onSeek(0);
        break;
      case 'End':
        onSeek(duration);
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }, [isLive, duration, currentTime, onSeek]);

  return (
    <div className="up-progress-container">
      <div
        ref={barRef}
        className={`up-progress-bar ${isLive ? 'up-progress-live' : ''} ${isDragging ? 'up-progress-dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoverTime(null)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        /* P0-2：进度条语义化 + 键盘可达（B站/YouTube 均为 role=slider） */
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={isLive || duration <= 0 ? 0 : Math.round(duration)}
        aria-valuenow={isLive || duration <= 0 ? 0 : Math.round(displayTime)}
        aria-valuetext={isLive || duration <= 0 ? '直播' : `${formatTime(displayTime)} / ${formatTime(duration)}`}
        aria-disabled={isLive}
        tabIndex={isLive || duration <= 0 ? -1 : 0}
        onKeyDown={handleKeyDown}
      >
        <div className="up-progress-buffered" style={{ width: `${bufferedPercent}%` }} />
        <div className="up-progress-played" style={{ width: `${displayPercent}%` }} />
        {!isLive && (
          <div className="up-progress-thumb" style={{ left: `${displayPercent}%` }} />
        )}
        {/* 无时长（加载中）时隐藏 tooltip，避免显示「0:00」（审查报告 4.3）。
            G1：提供缩略图源时展示预览图，否则回退时间戳文本。
            tooltip 水平钳制：两端不溢出进度条边界（left clamp，宽约 9rem 上限） */}
        {hoverTime !== null && !isLive && duration > 0 && (
          <div
            className="up-progress-tooltip"
            style={{ left: `clamp(4.5rem, ${hoverPosition}%, calc(100% - 4.5rem))` }}
          >
            <ThumbnailPreview
              source={thumbnails}
              time={hoverTime}
              fallback={formatTime(hoverTime)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
