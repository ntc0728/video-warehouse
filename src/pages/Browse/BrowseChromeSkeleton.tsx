/**
 * Browse 首屏 chrome 骨架 — 左栏筛选 + 顶栏排序条（2026-09-23 用户需求）。
 *
 * 触发窗口：本次挂载「首拍终态」之前（有数据 / 首轮 loading 结束 / 错误 / 直链无词）。
 * 终态一到 chromeSettled 锁死，后续筛选/翻页不再回到骨架 —— 只护首次进入。
 *
 * 结构镜像（对应 Browse/index.tsx）：
 *   左栏 = .filter-bar 三组（分类/地区/年份 · label 真文 + chips 灰块）；
 *   顶栏 = .browse-sort-bar（类型 7 pill + 分隔线 + 排序 3 pill + 计数位）。
 *
 * 模式 tab（智能检索/直链搜索）不属筛选项，始终真实渲染，不进本骨架。
 * 根类复用真实 .filter-bar / .browse-sort-bar 以继承 grid-area（filters / head）。
 */
import Skeleton from '@/components/common/Skeleton';
import { CATEGORY_CONFIG } from './constants';
import { SORT_OPTIONS } from '@/components/FilterBar/constants';
import './BrowseChromeSkeleton.css';

const TYPE_COUNT = Object.keys(CATEGORY_CONFIG).length;
const SORT_COUNT = SORT_OPTIONS.length;
/** 各组 chips 占位数（桌面 2 列 → 约 3~4 行，贴近真实铺开高度） */
const GENRE_CHIPS = 6;
const REGION_CHIPS = 8;
const YEAR_CHIPS = 8;

export function BrowseFilterChromeSkeleton() {
  return (
    <div
      className="filter-bar browse-chrome-skeleton browse-chrome-skeleton--filters skeleton-scope"
      role="status"
      aria-label="筛选加载中"
    >
      <div className="filter-bar__row filter-bar__row--wrap">
        <span className="filter-bar__label filter-bar__label--as-chip">分类</span>
        <div className="filter-bar__chips-wrap">
          {Array.from({ length: GENRE_CHIPS }, (_, i) => (
            <Skeleton key={i} className="browse-chrome-skeleton__chip" />
          ))}
        </div>
      </div>
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">地区</span>
        <div className="filter-bar__chips-scroll">
          {Array.from({ length: REGION_CHIPS }, (_, i) => (
            <Skeleton key={i} className="browse-chrome-skeleton__chip" />
          ))}
        </div>
      </div>
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">年份</span>
        <div className="filter-bar__chips-scroll">
          {Array.from({ length: YEAR_CHIPS }, (_, i) => (
            <Skeleton key={i} className="browse-chrome-skeleton__chip" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BrowseSortChromeSkeleton() {
  return (
    <div
      className="browse-sort-bar browse-chrome-skeleton browse-chrome-skeleton--sort skeleton-scope"
      role="status"
      aria-label="排序加载中"
    >
      <div className="browse-sort-bar__types">
        {Array.from({ length: TYPE_COUNT }, (_, i) => (
          <Skeleton
            key={i}
            className="browse-chrome-skeleton__pill browse-chrome-skeleton__pill--type"
          />
        ))}
      </div>
      <span className="browse-sort-bar__divider" aria-hidden="true" />
      <div className="browse-sort-bar__tabs">
        {Array.from({ length: SORT_COUNT }, (_, i) => (
          <Skeleton
            key={i}
            className="browse-chrome-skeleton__pill browse-chrome-skeleton__pill--tab"
          />
        ))}
      </div>
      <span className="browse-sort-bar__count" role="status">
        <Skeleton className="browse-chrome-skeleton__count" />
      </span>
    </div>
  );
}
