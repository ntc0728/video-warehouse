/**
 * 历史页专属骨架 — 与真实内容区逐层同构：
 *  - 桌面（≥768 且非 app）：左侧算珠时间轴槽（rail + 5 个算珠位）+ 右侧
 *    「分组节点行 + 记录卡网格」；
 *  - 移动 / app：时间轴槽由 History.css 门控自动隐藏，只剩节点行 + 网格
 *    （与真实页同一套门控，骨架不另设断点）。
 *
 * 为什么复用真实类（.history-content / .history-timeline / .history-groups /
 * .history-group-body / .history-grid / .record-card / .record-card__media /
 * .record-card__body）：高度、间距、sticky 槽宽、网格列数、封面 16:9 比例
 * 全部由 History.css 与 RecordCard.css 唯一决定 —— 骨架只往里填灰块，
 * 于是「骨架必须与真实内容等高」这条约束天然成立（同 PlayerSidebarSkeleton
 * 复用 .player-panel 的做法）。仅交互态（hover / 跑马灯 / 指针）在
 * HistorySkeleton.css 里关掉。
 *
 * 列数 = 运行时读 --history-cols token（index.css 分档 1/2/3/4/5/6，TV 恒 5），
 * 与真实 .history-grid 同源；行数由 useFillRows 按滚动容器可视高度实测推导
 * （2026-09-18：不再固定 2 行）。
 *
 * 触发时机：useUserStore 首次从 IndexedDB 读取完成前（_loading）。历史数据在
 * 本地库，正常路径下骨架存在时间极短，靠 .skeleton-scope 的 150ms 延迟淡入
 * 过滤掉「快请求闪一下」（与 Browse/Collections 同一机制）。
 */
import { useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols, useFillRows } from '@/hooks';
import './HistorySkeleton.css';

/** 左侧时间轴算珠位数：真实分组最多 5 段（今天/昨天/本周/本月/更早） */
const BEAD_COUNT = 5;

export default function HistorySkeleton() {
  const cols = useGridCols('--history-cols', 1);
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useFillRows(gridRef, cols, { minRows: 2, reserve: 48 });

  return (
    <div className="history-content history-skeleton skeleton-scope" role="status" aria-label="加载中">
      {/* 左侧算珠时间轴槽：桌面由 .history-timeline 的媒体查询显示，移动端自动 display:none */}
      <div className="history-timeline history-skeleton__timeline" aria-hidden="true">
        <span className="history-timeline__rail" />
        <div className="history-timeline__beads">
          {Array.from({ length: BEAD_COUNT }, (_, i) => (
            <span key={i} className="history-skeleton__bead">
              <span className="history-skeleton__bead-dot" />
              <Skeleton className="history-skeleton__bead-label" />
              <Skeleton className="history-skeleton__bead-count" />
            </span>
          ))}
        </div>
      </div>

      <div className="history-groups">
        <div className="history-group">
          {/* 移动端内联节点行（桌面由 .history-node-col 的媒体查询隐藏） */}
          <div className="history-node-col" aria-hidden="true">
            <span className="history-skeleton__node-dot" />
            <Skeleton className="history-skeleton__node-label" />
            <Skeleton className="history-skeleton__node-count" />
          </div>

          <div className="history-group-body">
            <div ref={gridRef} className="history-grid">
              {Array.from({ length: cols * rows }, (_, i) => (
                <article key={i} className="record-card history-skeleton__card">
                  <div className="record-card__media">
                    <Skeleton className="history-skeleton__media" />
                  </div>
                  <div className="record-card__body">
                    <Skeleton className="history-skeleton__title" />
                    <Skeleton className="history-skeleton__meta" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
