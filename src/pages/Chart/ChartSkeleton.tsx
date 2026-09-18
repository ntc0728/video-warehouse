/**
 * 榜单页专属骨架 — 与真实 .chart-list / .chart-row 逐层同构：
 * 每格一行「排名 + 封面 + 标题/元信息 + 热度」占位，复用 Chart.css 里
 * 「加载更多」骨架 `.chart-list__skeleton` 的四块几何（a/b/c/d），
 * 使首屏骨架与列表内骨架**同尺寸同扫光**，也避免两处各写一份尺寸而漂移。
 *
 * 使用场景（2026-09-18 用户拍板）：仅**本次会话首次成功加载前**显示。
 * 切 tab / 切时间窗仍走居中「小电视 + 加载中…」（2026-09-10 用户决议：
 * 切换时不要旧图与遮罩），故只对「首载」分流，不推翻旧决议。
 *
 * 视口差异化：列数直接消费与真实网格同源的 --chart-cols token
 * （index.css：桌面 2 / ≤1023 与 App 单列），不引入第二套断点真源；
 * 张数 = 列数 × 行数，列数运行时读 token（useGridCols），行数由 useFillRows
 * 按滚动容器可视高度实测推导（2026-09-18：不再固定 4 行）。
 *
 * 样式复用说明：本骨架刻意**不建同名 .css**（同 PlayerSidebarSkeleton 复用
 * Player.css 的做法），几何全部来自 Chart.css；此处显式 import 一次以确保
 * 组件被单独引用时样式在场（Vite 对同一 CSS 的重复 import 会去重）。
 */
import { useRef } from 'react';
import { useGridCols, useFillRows } from '@/hooks';
import './Chart.css';

/** 单行榜单骨架：首屏骨架与「加载更多」共用，几何唯一（.chart-list__skeleton 的 a/b/c/d） */
export function ChartRowSkeleton() {
  return (
    <div className="chart-list__skeleton" aria-hidden="true">
      <i className="a" />
      <i className="b" />
      <i className="c" />
      <i className="d" />
    </div>
  );
}

export default function ChartSkeleton() {
  const cols = useGridCols('--chart-cols', 2);
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useFillRows(gridRef, cols, { minRows: 3, reserve: 48 });

  return (
    <div
      ref={gridRef}
      className="chart-list chart-skeleton skeleton-scope"
      role="status"
      aria-label="加载中"
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <ChartRowSkeleton key={i} />
      ))}
    </div>
  );
}
