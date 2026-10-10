import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SelectedSourceCheckResult } from '../../../services/videoService';
import './SourceDetectPill.css';

export type SourceDetectStatus = 'idle' | 'running' | 'done';

export interface SourceDetectPillProps {
  status: SourceDetectStatus;
  done: number;
  total: number;
  ok: number;
  fail: number;
  results: SelectedSourceCheckResult[];
  /** running 态胶囊内轮播文本（如「正在查询豆瓣资源…」），替换旧「检测中」+进度条 */
  runningText?: string;
}

const statusLabel: Record<SourceDetectStatus, string> = {
  idle: '源检测',
  running: '检测中',
  done: '源检测',
};

export function SourceDetectPill({
  status,
  done,
  total,
  ok,
  fail,
  results,
  runningText,
}: SourceDetectPillProps) {
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // 结果浮层仅 hover 展开（2026-10-10 用户要求：去掉点击钉住）
  const open = status === 'done' && hovered;

  const recompute = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.right, width: r.width });
  };

  // 打开时（含数据变化导致内容高度变化）重新测量锚点位置
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    recompute();
  }, [open, status, done, total, ok, fail, results.length]);

  // 打开期间监听滚动/缩放，跟随锚点
  useEffect(() => {
    if (!open) return;
    const onScroll = () => recompute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // 悬浮进入/离开用 120ms 缓冲，容许鼠标从 pill 移到弹窗时跨越 6px 间隙
  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(true);
  };
  const handleLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), 120);
  };

  return (
    <>
      <div
        ref={anchorRef}
        className={`sdp ${status === 'done' ? 'is-done' : ''}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <button
          type="button"
          className={`sdp-pill ${status}`}
          aria-label={status === 'running' ? (runningText || statusLabel.running) : statusLabel[status]}
        >
          {status === 'running' && <span className="sdp-spin" />}
          {status === 'done' && <span className="sdp-dot is-ok" />}
          {status === 'idle' && <span className="sdp-dot" />}
          <span className={`sdp-label${status === 'running' ? ' sdp-label--run' : ''}`}>
            {status === 'running' ? (runningText || statusLabel.running) : statusLabel[status]}
          </span>
          {status === 'running' ? (
            /* running：小转圈 + 轮播文本 + 计数，去掉进度条（2026-10-10） */
            total > 0 && (
              <span className="sdp-count">
                {done}/{total}
              </span>
            )
          ) : (
            /* done / idle：保持原 UI（进度条 + 计数） */
            total > 0 && (
              <>
                <span className="sdp-mini" aria-hidden>
                  <i style={{ width: `${pct}%` }} />
                </span>
                <span className="sdp-count">
                  {done}/{total}
                </span>
              </>
            )
          )}
        </button>
      </div>

      {open &&
        pos &&
        createPortal(
          <div
            className="sdp-pop is-open"
            role="tooltip"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: Math.max(240, pos.width),
              transform: 'translateX(-100%)',
              zIndex: 1000,
            }}
          >
            <div className="sdp-pop-summary">
              <span>
                总源数 <b>{total}</b>
              </span>
              <span className="ok">
                成功 <b>{ok}</b>
              </span>
              <span className="fail">
                失败 <b>{fail}</b>
              </span>
            </div>
            <div className="sdp-pop-grid">
              {results.map((r) => (
                <div
                  key={r.index}
                  className={`sdp-cell ${r.available ? 'is-ok' : 'is-fail'}`}
                  title={r.available ? '可用' : r.error || '不可用'}
                >
                  <span className="sdp-cell-dot" />
                  <span className="sdp-cell-name">{r.name}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default SourceDetectPill;
