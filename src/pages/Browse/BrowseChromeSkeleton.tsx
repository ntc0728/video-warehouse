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
import type { CSSProperties } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { CATEGORY_CONFIG } from './constants';
import { REGION_OPTIONS, SORT_OPTIONS, YEAR_OPTIONS, YEAR_OLDER_LABEL } from '@/components/FilterBar/constants';
import './BrowseChromeSkeleton.css';

const TYPE_COUNT = Object.keys(CATEGORY_CONFIG).length;
const SORT_COUNT = SORT_OPTIONS.length;
/** 分类组占位数：真实 genre chips 由接口动态返回（以 2 字标签为主），
 *  骨架按 2 字档均一宽度近似（真实宽度 = 文本 2em + 左右 padding）。 */
const GENRE_CHIPS = 6;
/** 地区/年份组 <1024 移动档保留的占位数：真实标签超出此数的标 --fill，
 *  移动端不渲染（胶囊为整行大块，数量必须克制）、≥1024 复活。 */
const MOBILE_CHIPS = 8;
/** ≥1024 追加的「撑满」占位（2026-10-10 用户要求）：桌面 chips 容器被骨架 CSS
 *  拉伸为吃满本组剩余高度 + overflow 裁剪，富余胶囊按视口高度被裁掉 →
 *  任意大屏高度下三组都被胶囊铺满不露底；移动端 display:none 不参与布局。 */
const FILL_CHIPS = 14;

/** 骨架胶囊宽 = 真实 chip 盒宽：文本宽 + 左右 padding（--space-sm×2，border-box 同源，
 *  对齐 Browse.css ≥1024 的 .filter-bar__chip padding）。字宽估算：CJK ≈ 1em、
 *  ASCII（年份数字）≈ 0.55em（--text-sm 档与真实排版宽度偏差 <1px）。
 *  走 --chip-w 自定义属性：移动端 width:100% 规则不受 inline style 影响。 */
function chipStyle(label: string): CSSProperties {
  const units = [...label].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.55), 0);
  return { '--chip-w': `calc(${units}em + 2 * var(--space-sm))` } as CSSProperties;
}

/** 真实标签组（地区 / 年份）：宽度逐个还原 + FILL_CHIPS 桌面撑满块；
 *  超出 MOBILE_CHIPS 的标签移动端不渲染（--fill），≥1024 复活。 */
function LabeledChipGroup({ labels }: { labels: string[] }) {
  return (
    <>
      {labels.map((label, i) => (
        <Skeleton
          key={`${label}-${i}`}
          className={`browse-chrome-skeleton__chip${i >= MOBILE_CHIPS ? ' browse-chrome-skeleton__chip--fill' : ''}`}
          style={chipStyle(label)}
        />
      ))}
      {Array.from({ length: FILL_CHIPS }, (_, i) => (
        <Skeleton key={`fill-${i}`} className="browse-chrome-skeleton__chip browse-chrome-skeleton__chip--fill" />
      ))}
    </>
  );
}

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
          {/* 分类 = genre chips 由接口动态返回，骨架按 2 字档均一宽度近似 */}
          {Array.from({ length: GENRE_CHIPS + FILL_CHIPS }, (_, i) => (
            <Skeleton
              key={i}
              className={`browse-chrome-skeleton__chip${i >= GENRE_CHIPS ? ' browse-chrome-skeleton__chip--fill' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">地区</span>
        <div className="filter-bar__chips-scroll">
          <LabeledChipGroup labels={REGION_OPTIONS.map((o) => o.label)} />
        </div>
      </div>
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">年份</span>
        <div className="filter-bar__chips-scroll">
          <LabeledChipGroup labels={[...YEAR_OPTIONS.map((o) => o.label), YEAR_OLDER_LABEL]} />
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
