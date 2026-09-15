/**
 * IPTV 频道页专属骨架 — 与真实页面逐层同构（isDesktopRail 分支同构）：
 *  - rail 模式（桌面）：左栏「频道分类 / 更多台」+ 右侧内容卡
 *    （计数条 + 分区头 + 频道网格，对应 .iptv-rail / .iptv-grid-card /
 *    .iptv-sec / .iptv-channel-grid）；
 *  - 移动模式：顶部筛选卡 + 频道网格。
 *
 * 视口差异化由页面层 isDesktopRail（useIsMobileLayout/useIsTV 同源）
 * 以 prop 传入，骨架内部不再设第二套断点真源；频道网格列数消费与真实网格
 * 同源的 --iptv-page-cols（.iptv-page .iptv-channel-grid，2026-09-08 起
 * IPTV 页专用；此前骨架误用全局 --iptv-cols，桌面档多一列），随视口自动分档。
 * 张数 = 列数 × ROWS（列数运行时读 token，见 useGridCols），不写死。
 */
import Skeleton from '@/components/common/Skeleton';
import { useGridCols } from '@/hooks/useGridCols';
import './IPTVSkeleton.css';

/** 网格渲染几行占位（行数是策略，张数由列数 × 本值派生） */
const ROWS = 3;
/**
 * 左栏分类行数：填的是「左栏高度」而非网格宽度，与列数无关，
 * 故不走 useGridCols；9 行 ≈ 真实分类列表（频道分类 + 更多台）的可见项数。
 */
const RAIL_ROW_COUNT = 9;

function ChannelGridSkeleton() {
  const cols = useGridCols('--iptv-page-cols', 2);

  return (
    <div className="iptv-skeleton__channel-grid">
      {Array.from({ length: cols * ROWS }, (_, i) => (
        <div key={i} className="iptv-skeleton__channel">
          <Skeleton className="iptv-skeleton__channel-cover" />
          <Skeleton className="iptv-skeleton__channel-title" />
        </div>
      ))}
    </div>
  );
}

/** 网格内局部骨架：已有数据后的刷新占位（对应 .iptv-content-loading 场景） */
export function IPTVChannelGridSkeleton() {
  return <ChannelGridSkeleton />;
}

export default function IPTVSkeleton({ rail }: { rail: boolean }) {
  if (!rail) {
    return (
      <div className="iptv-skeleton skeleton-scope" role="status" aria-label="加载频道列表">
        <Skeleton className="iptv-skeleton__topbar" />
        <ChannelGridSkeleton />
      </div>
    );
  }
  return (
    <div
      className="iptv-skeleton iptv-skeleton--rail skeleton-scope"
      role="status"
      aria-label="加载频道列表"
    >
      <aside className="iptv-skeleton__rail">
        <Skeleton className="iptv-skeleton__rail-title" />
        {Array.from({ length: RAIL_ROW_COUNT }, (_, i) => (
          <Skeleton key={i} className="iptv-skeleton__rail-row" />
        ))}
      </aside>
      <div className="iptv-skeleton__content">
        <div className="iptv-skeleton__bar">
          <Skeleton className="iptv-skeleton__bar-count" />
          <Skeleton className="iptv-skeleton__bar-btn" />
        </div>
        <Skeleton className="iptv-skeleton__sec-head" />
        <ChannelGridSkeleton />
      </div>
    </div>
  );
}
