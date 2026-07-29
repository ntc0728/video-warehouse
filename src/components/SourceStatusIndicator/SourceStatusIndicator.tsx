import { useState } from 'react';
import './SourceStatusIndicator.css';
// 复用详情页 SourceDetectPill 弹窗的逐源网格样式，保证两处弹层视觉一致
import '@/pages/Detail/components/SourceDetectPill.css';

export interface SourceStatusIndicatorProps {
  /** 总源数 */
  totalSources: number;
  /** 已检测完成的源数 */
  totalCompleted: number;
  /** 可用（成功）的源数 */
  totalAvailable: number;
  /** 检测错误（如全部源失败）；存在时 pill 显示错误态 */
  error?: string | null;
  /** 逐源状态列表（用于弹层展示，与详情页源检测弹窗一致的逐源网格） */
  sources?: Array<{ name: string; available: boolean }>;
  className?: string;
}

/**
 * V4 风格源状态指示：折叠 pill + 悬浮/钉住弹出层，
 * 显示 总源数 / 成功 / 失败 / 结果数。
 */
export function SourceStatusIndicator({
  totalSources,
  totalCompleted,
  totalAvailable,
  error = null,
  sources,
  className = '',
}: SourceStatusIndicatorProps) {
  const [pinned, setPinned] = useState(false);
  const completed = Math.min(totalCompleted, totalSources);
  const pct = totalSources > 0 ? Math.round((completed / totalSources) * 100) : 0;
  const fail = Math.max(totalSources - totalAvailable, 0);
  const scanning = completed < totalSources;
  const dotClass = totalAvailable > 0 ? 'is-ok' : 'is-fail';
  const hasError = !scanning && !!error;

  return (
    <div
      className={`source-status-badge ${scanning ? 'is-scanning' : ''} ${hasError ? 'is-error' : ''} ${pinned ? 'is-pinned' : ''} ${className}`}
    >
      <button
        type="button"
        className="ssb-pill"
        onClick={() => setPinned((v) => !v)}
        aria-label="源状态"
      >
        {scanning && <span className="ssb-spin" />}
        {!scanning && <span className={`ssb-dot ${dotClass}`} />}
        <span className="ssb-label">源状态</span>
        {totalSources > 0 && (
          <>
            <span className="ssb-mini" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="ssb-count">
              {completed}/{totalSources}
            </span>
          </>
        )}
      </button>

      <div className="ssb-pop" role="tooltip">
        <div className="ssb-pop-summary">
          <span>
            总源数 <b>{totalSources}</b>
          </span>
          <span className="ok">
            成功 <b>{totalAvailable}</b>
          </span>
          <span className="fail">
            失败 <b>{fail}</b>
          </span>
          {hasError && (
            <span className="err">
              错误 <b>{error}</b>
            </span>
          )}
        </div>
        {sources && sources.length > 0 && !scanning && (
          <div className="sdp-pop-grid">
            {sources.map((s, i) => (
              <div
                key={i}
                className={`sdp-cell ${s.available ? 'is-ok' : 'is-fail'}`}
                title={s.available ? '可用' : '不可用'}
              >
                <span className="sdp-cell-dot" />
                <span className="sdp-cell-name">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SourceStatusIndicator;
