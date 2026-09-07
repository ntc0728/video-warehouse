import './SourceStatusIndicator.css';

/** 逐源统计（结果数 + 失败标记），搜索结束后渲染 demo 同款逐源 badge */
export interface SourceStatusStat {
  name: string;
  /** 该源贡献的结果数（原始值，不受本地筛选影响） */
  count: number;
  /** 请求失败（超时/报错） */
  failed: boolean;
}

export interface SourceStatusIndicatorProps {
  /** 总源数 */
  totalSources: number;
  /** 已检测完成的源数 */
  totalCompleted: number;
  /** 逐源统计列表 */
  stats?: SourceStatusStat[];
  className?: string;
}

/**
 * 源状态指示（双态，2026-09-07 用户拍板）：
 * - 搜索中：折叠 pill（spinner + 进度条 + 计数），UI 样式与旧版一致；
 * - 搜索结束：demo 同款逐源 badge 行（ok=绿 / warn=橙(0 条) / bad=红(失败)），
 *   不再渲染旧的鼠标悬浮弹层（ssb-pop 已删除）。
 */
export function SourceStatusIndicator({
  totalSources,
  totalCompleted,
  stats = [],
  className = '',
}: SourceStatusIndicatorProps) {
  const completed = Math.min(totalCompleted, totalSources);
  const pct = totalSources > 0 ? Math.round((completed / totalSources) * 100) : 0;
  const scanning = completed < totalSources;

  // 搜索中：折叠 pill（不可点击，纯状态展示）
  if (scanning) {
    return (
      <div className={`source-status-badge is-scanning ${className}`}>
        <span className="ssb-pill" aria-label="源状态">
          <span className="ssb-spin" />
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
        </span>
      </div>
    );
  }

  // 搜索结束：逐源 badge（绿=有结果 / 橙=0 条 / 红=失败）
  return (
    <div className={`ssb-badges ${className}`}>
      {stats.map((s) => (
        <span
          key={s.name}
          className={`ssb-badge ${s.failed ? 'bad' : s.count > 0 ? 'ok' : 'warn'}`}
        >
          <i aria-hidden />
          {s.name} {s.failed ? '失败' : s.count}
        </span>
      ))}
    </div>
  );
}

export default SourceStatusIndicator;
