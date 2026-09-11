/**
 * IPTV 频道页专属骨架 — 与真实页面逐层同构（isDesktopRail 分支同构）：
 *  - rail 模式（桌面）：左栏「频道分类 / 更多台」+ 右侧内容卡
 *    （计数条 + 分区头 + 频道网格，对应 .iptv-rail / .iptv-grid-card /
 *    .iptv-sec / .iptv-channel-grid）；
 *  - 移动模式：顶部筛选卡 + 频道网格。
 *
 * 视口差异化由页面层 isDesktopRail（useIsMobileLayout/useIsTV 同源）
 * 以 prop 传入，骨架内部不再设第二套断点真源；频道网格列数消费
 * 与真实网格同源的 --iptv-cols，随视口自动分档。
 */
import Skeleton from '@/components/common/Skeleton';
import './IPTVSkeleton.css';

const RAIL_ROW_COUNT = 9;
const CHANNEL_COUNT = 12;

function ChannelGridSkeleton() {
  return (
    <div className="iptv-skeleton__channel-grid">
      {Array.from({ length: CHANNEL_COUNT }, (_, i) => (
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
      <div className="iptv-skeleton" role="status" aria-label="加载频道列表">
        <Skeleton className="iptv-skeleton__topbar" />
        <ChannelGridSkeleton />
      </div>
    );
  }
  return (
    <div className="iptv-skeleton iptv-skeleton--rail" role="status" aria-label="加载频道列表">
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
