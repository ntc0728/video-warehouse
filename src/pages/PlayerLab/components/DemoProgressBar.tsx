/**
 * 播放器整改 Demo — 进度条
 *
 * 对照现有 `UniversalPlayer/ControlBar/ProgressBar.tsx` 的修复：
 * 1. 零 ARIA / 零键盘（:174-185）→ 完整 role="slider" + aria-value* + 键盘操作。
 * 2. 触摸目标 3–6px（UniversalPlayer.css:378-393）→ 视觉 4px、热区 44px（伪元素扩展）。
 * 3. hover tooltip 无边界钳制（:194）→ 左右各钳制半个气泡宽。
 * 4. 拖拽每帧直接改 currentTime 且不暂停（:98-147）→ 拖拽开始暂停、松手按原状态恢复。
 * 5. 进度值每 250ms 走 React state → 这里由父组件在 rAF 里直写 CSS 变量，零 React 重渲染。
 */
import { useCallback, useRef, useState } from 'react';

export interface DemoChapter {
  start: number;
  end: number;
  label: string;
}

interface Props {
  duration: number;
  buffered: number;
  /** 拖拽中由父组件传入的覆盖进度（0–1） */
  dragRatio: number | null;
  chapters: DemoChapter[];
  onSeek: (time: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
}

/** 秒 → mm:ss / h:mm:ss */
function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** aria-valuetext：读成时间而不是裸数字（WCAG 4.1.2） */
function spokenTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  return h > 0 ? `${h} 小时 ${m} 分 ${s} 秒` : `${m} 分 ${s} 秒`;
}

export default function DemoProgressBar({
  duration,
  buffered,
  dragRatio,
  chapters,
  onSeek,
  onScrubStart,
  onScrubEnd,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const ratioFromEvent = useCallback((clientX: number): number => {
    const el = rootRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onScrubStart();
    const r = ratioFromEvent(e.clientX);
    setHoverRatio(r);
    onSeek(r * duration);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = ratioFromEvent(e.clientX);
    setHoverRatio(r);
    if (dragging) onSeek(r * duration);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    onScrubEnd();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const big = e.shiftKey ? 10 : 5;
    const cur = (hoverRatio ?? Number(rootRef.current?.style.getPropertyValue('--pl-progress') || 0)) * duration;
    const clamp = (t: number) => Math.max(0, Math.min(duration, t));
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = clamp(cur - big); break;
      case 'ArrowRight': next = clamp(cur + big); break;
      case 'PageDown': next = clamp(cur - duration * 0.1); break;
      case 'PageUp': next = clamp(cur + duration * 0.1); break;
      case 'Home': next = 0; break;
      case 'End': next = duration; break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
    onSeek(next);
  };

  const currentRatio = dragRatio ?? Number(rootRef.current?.dataset.ratio ?? 0);
  const tipRatio = hoverRatio ?? 0;
  // 气泡边界钳制：最多探出到距边缘 6%，避免被裁切
  const tipLeft = Math.max(6, Math.min(94, tipRatio * 100));

  return (
    <div
      ref={rootRef}
      className={`pl-progress${dragging ? ' pl-progress--dragging' : ''}`}
      style={dragRatio !== null ? { ['--pl-progress' as string]: String(dragRatio) } : undefined}
      role="slider"
      tabIndex={0}
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentRatio * duration)}
      aria-valuetext={`${spokenTime(currentRatio * duration)}，共 ${spokenTime(duration)}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => { if (!dragging) setHoverRatio(null); }}
      onKeyDown={handleKeyDown}
    >
      <div className="pl-progress-hit">
        <div className="pl-progress-track">
          <div className="pl-progress-buffered" style={{ width: `${Math.min(100, buffered * 100)}%` }} />
          {chapters.map((c) => (
            <div
              key={c.label}
              className="pl-progress-chapter"
              style={{
                left: `${(c.start / duration) * 100}%`,
                width: `${((c.end - c.start) / duration) * 100}%`,
              }}
              title={c.label}
            />
          ))}
          <div className="pl-progress-played" />
          <div className="pl-progress-thumb" />
        </div>
      </div>

      {hoverRatio !== null && duration > 0 && (
        <div className="pl-progress-tip" style={{ left: `${tipLeft}%` }}>
          <span className="pl-progress-tip-time">{formatTime(hoverRatio * duration)}</span>
          <span className="pl-progress-tip-total">/ {formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
