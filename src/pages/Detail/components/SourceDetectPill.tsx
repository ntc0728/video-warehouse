import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SourceDetectPill.css';

export type SourceDetectStatus = 'idle' | 'running' | 'done';

/**
 * 单个源的**本次搜索落点**（不是「根接口可达性」）。
 * 旧实现单独探一次根列表：茅台资源这类「接口正常但禁止关键词搜索」的源永远显示可用，
 * 搜索结果里却一条没有——「绿灯但没数据」的根因。改为直接复用搜索本身的结果。
 */
export type SourceCellState = 'ok' | 'empty' | 'unsupported' | 'fail' | 'pending';

export interface SourceStatusCell {
  index: number;
  name: string;
  state: SourceCellState;
  /** 悬浮提示：失败原因等具体说明 */
  detail?: string;
}

export interface SourceDetectPillSummary {
  ok: number;
  empty: number;
  unsupported: number;
  fail: number;
}

export interface SourceDetectPillProps {
  status: SourceDetectStatus;
  done: number;
  total: number;
  summary: SourceDetectPillSummary;
  cells: SourceStatusCell[];
  /** running 态胶囊内轮播文本（如「正在查询豆瓣资源…」） */
  runningText?: string;
}

const statusLabel: Record<SourceDetectStatus, string> = {
  idle: '源检测',
  running: '检测中',
  done: '源检测',
};

const cellLabel: Record<SourceCellState, string> = {
  ok: '有可播数据',
  empty: '未找到本片资源',
  unsupported: '不支持关键词搜索',
  fail: '请求失败',
  pending: '查询中',
};

export function SourceDetectPill({
  status,
  done,
  total,
  summary,
  cells,
  runningText,
}: SourceDetectPillProps) {
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // 结果浮层仅 hover 展开（去掉点击钉住）
  const open = status === 'done' && hovered;

  // 胶囊状态点：有数据=绿；否则按异常类型给红/琥珀；纯「无本片数据」保持中性灰
  const dotState = summary.ok > 0
    ? 'is-ok'
    : summary.fail > 0
      ? 'is-fail'
      : summary.unsupported > 0
        ? 'is-warn'
        : '';

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
  }, [open, status, done, total, summary.ok, summary.empty, summary.unsupported, summary.fail, cells.length]);

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
          {status === 'done' && <span className={`sdp-dot ${dotState}`.trim()} />}
          {status === 'idle' && <span className="sdp-dot" />}
          <span className={`sdp-label${status === 'running' ? ' sdp-label--run' : ''}`}>
            {status === 'running' ? (runningText || statusLabel.running) : statusLabel[status]}
          </span>
          {status === 'running' ? (
            /* running：小转圈 + 轮播文本 + 计数，去掉进度条 */
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
            {/* 汇总按「本次搜索落点」统计；零计数的分类不占位 */}
            <div className="sdp-pop-summary">
              <span>
                总源数 <b>{total}</b>
              </span>
              {summary.ok > 0 && (
                <span className="ok">
                  有数据 <b>{summary.ok}</b>
                </span>
              )}
              {summary.empty > 0 && (
                <span>
                  无本片 <b>{summary.empty}</b>
                </span>
              )}
              {summary.unsupported > 0 && (
                <span className="warn">
                  不支持搜索 <b>{summary.unsupported}</b>
                </span>
              )}
              {summary.fail > 0 && (
                <span className="fail">
                  失败 <b>{summary.fail}</b>
                </span>
              )}
            </div>
            <div className="sdp-pop-grid">
              {cells.map((c) => (
                <div
                  key={c.index}
                  className={`sdp-cell is-${c.state}`}
                  title={c.detail || cellLabel[c.state]}
                >
                  <span className="sdp-cell-dot" />
                  <span className="sdp-cell-name">{c.name}</span>
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
