import { useRef, useCallback, useState, useEffect } from 'react';
import type { PlayerMode } from '@/types/player';

interface ProgressBarProps {
  mode: PlayerMode;
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
}

function getClientX(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): number {
  if ('touches' in e) {
    return e.touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0]?.clientX ?? 0;
  }
  return (e as MouseEvent).clientX;
}

export default function ProgressBar({ mode, currentTime, duration, buffered, onSeek }: ProgressBarProps) {
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
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    // hover 预览始终更新（tooltip），但非拖拽不触发 seek（thumb 不跟随鼠标）
    setHoverTime(time);
    setHoverPosition(ratio * 100);
    if (isDragging) {
      setPendingTime(time);
      setPendingPosition(ratio * 100);
      onSeek(time);
    }
  }, [duration, isDragging, onSeek]);

  const beginDrag = useCallback((clientX: number) => {
    // 直播 / 无时长 禁止拖拽；缓冲中允许 seek（跳到已缓冲位置可立即恢复播放，
    // 跳到未缓冲位置由浏览器自行等待）——不再一刀切禁用，避免缓冲中无法跳转（审查报告 1.4）
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
            setPendingPosition(ratio * 100);
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
            setPendingPosition(ratio * 100);
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
      >
        <div className="up-progress-buffered" style={{ width: `${bufferedPercent}%` }} />
        <div className="up-progress-played" style={{ width: `${displayPercent}%` }} />
        {!isLive && (
          <div className="up-progress-thumb" style={{ left: `${displayPercent}%` }} />
        )}
        {/* 无时长（加载中）时隐藏 tooltip，避免显示「0:00」（审查报告 4.3） */}
        {hoverTime !== null && !isLive && duration > 0 && (
          <div className="up-progress-tooltip" style={{ left: `${hoverPosition}%` }}>
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
    </div>
  );
}
