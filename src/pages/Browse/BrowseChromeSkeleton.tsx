/**
 * Browse 首屏 chrome 骨架 — 左栏筛选 + 顶栏排序条（2026-09-23 用户需求）。
 *
 * 触发窗口：本次挂载「首拍终态」之前（有数据 / 首轮 loading 结束 / 错误 / 直链无词）。
 * 终态一到 chromeSettled 锁死，后续筛选/翻页不再回到骨架 —— 只护首次进入。
 *
 * 结构镜像（对应 Browse/index.tsx）：
 *   左栏 = .filter-bar 三组（分类/地区/年份 · label 真文 + chips 灰块）；
 *        分类组按 category 的 CATEGORY_CONFIG 镜像真实 genre 数。
 *   顶栏 = .browse-sort-bar（类型 6 pill + 分隔线 + 排序 3 pill + 计数位）。
 *        类型 pill 取 VISIBLE_CATEGORY_KEYS（2026-11-07 删「全部」/综艺/动漫后 4 档）。
 *
 * 模式 tab（智能检索/直链搜索）不属筛选项，始终真实渲染，不进本骨架。
 * 根类复用真实 .filter-bar / .browse-sort-bar 以继承 grid-area（filters / head）。
 */
import type { CSSProperties } from 'react';
import type { TMDBGenre } from '@/types/tmdb';
import Skeleton from '@/components/common/Skeleton';
import { useTMDBStore } from '@/stores';
import { VISIBLE_CATEGORY_KEYS, CATEGORY_CONFIG } from './constants';
import type { CategoryKey } from '@/types/category';
import { SORT_OPTIONS, YEAR_OPTIONS, YEAR_OLDER_LABEL, FILTER_COLLAPSE_LIMIT, type RegionOption } from '@/components/FilterBar/constants';
import './BrowseChromeSkeleton.css';

// 结果区头部类型行 4 档（电影/剧集/排行榜/纪录片，与 constants VISIBLE_CATEGORY_KEYS 单点同源）
const TYPE_COUNT = VISIBLE_CATEGORY_KEYS.length;
const SORT_COUNT = SORT_OPTIONS.length;
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
 *  超出 MOBILE_CHIPS 的标签移动端不渲染（--fill），≥1024 复活。
 *  `extra`：折叠态下的「展开」按钮占位数（真实行多渲染一个按钮 chip）。 */
function LabeledChipGroup({ labels, extra = 0 }: { labels: string[]; extra?: number }) {
  return (
    <>
      {labels.map((label, i) => (
        <Skeleton
          key={`${label}-${i}`}
          className={`browse-chrome-skeleton__chip${i >= MOBILE_CHIPS ? ' browse-chrome-skeleton__chip--fill' : ''}`}
          style={chipStyle(label)}
        />
      ))}
      {Array.from({ length: extra }, (_, i) => (
        <Skeleton key={`more-${i}`} className="browse-chrome-skeleton__chip" style={chipStyle('展开全部（24）')} />
      ))}
      {Array.from({ length: FILL_CHIPS }, (_, i) => (
        <Skeleton key={`fill-${i}`} className="browse-chrome-skeleton__chip browse-chrome-skeleton__chip--fill" />
      ))}
    </>
  );
}

/** 左栏「分类」行骨架灰块数量。
 *  与 index.tsx currentGenres 同逻辑：按 CATEGORY_CONFIG[category] 的 genresSource 选
 *  movieGenres / tvGenres / 合并，再减 excludedGenreIds（defaultGenreIds）
 *  得到「真实行可见 genre 数」。
 *  骨架按该数量同步渲染灰块，genres 落地后与真实行严格等量，首屏不跳动。
 *  genres 尚未落地（holdTmdb / 首帧）时数量为 0 → 仅「全部」1 枚，FILL_CHIPS 撑满不露底。
 */
function useGenreChipCount(category: CategoryKey): number {
  const movieGenres = useTMDBStore((s) => s.movieGenres);
  const tvGenres = useTMDBStore((s) => s.tvGenres);
  const cfg = CATEGORY_CONFIG[category];
  let base: TMDBGenre[];
  if (cfg.genresSource === 'movie') base = movieGenres;
  else if (cfg.genresSource === 'tv') base = tvGenres;
  else {
    // both 与 index.tsx currentGenres 同口径：按 name 去重（movie/tv 表重名如动画/喜剧/剧情…）
    const seen = new Set<string>();
    base = [];
    for (const g of [...movieGenres, ...tvGenres]) {
      const key = g.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); base.push(g); }
    }
  }
  const excluded = new Set(cfg.defaultGenreIds);
  return base.filter((g) => !excluded.has(g.id)).length;
}

function GenreChips({ category }: { category: CategoryKey }) {
  // 分类不折叠（与真实 FilterBar 一致）：始终全量，不使用 FILTER_COLLAPSE_LIMIT
  const count = useGenreChipCount(category);
  return (
    <>
      <Skeleton key="chip-all" className="browse-chrome-skeleton__chip" style={chipStyle('全部')} />
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={`chip-genre-${i}`}
          className="browse-chrome-skeleton__chip"
          style={chipStyle('分类')}
        />
      ))}
      {Array.from({ length: FILL_CHIPS }, (_, i) => (
        <Skeleton key={`fill-${i}`} className="browse-chrome-skeleton__chip browse-chrome-skeleton__chip--fill" />
      ))}
    </>
  );
}

export function BrowseFilterChromeSkeleton({
  category = 'movie',
  categoryLabel,
  regionOptions = [],
  collapsible = false,
}: {
  category?: CategoryKey;
  /** 与真实 FilterBar 一致的分组标题（真实用 CATEGORY_LABELS[category]，如「电影」） */
  categoryLabel?: string;
  /** 与真实 FilterBar 同一份地区选项（TMDB 真实国家校验后），保证骨架占位数等量 */
  regionOptions?: RegionOption[];
  /** ≥2560 单列时真实 FilterBar 会折叠长尾，骨架同步截断 + 留「展开」占位 */
  collapsible?: boolean;
}) {

  return (
    <div
      className="filter-bar browse-chrome-skeleton browse-chrome-skeleton--filters skeleton-scope"
      role="status"
      aria-label="筛选加载中"
    >
      <div className="filter-bar__row filter-bar__row--wrap">
        {/* 与真实 FilterBar 同文案：分类行 label = categoryLabel || '分类' */}
        <span className="filter-bar__label filter-bar__label--as-chip">
          {categoryLabel || '分类'}
        </span>
        <div className="filter-bar__chips-wrap">
          {/*
           * 分类组按当前 category 的 CATEGORY_CONFIG（genresSource）镜像真实
           * genre 数；默认「电影」时等价于「全部」1 枚 + movieGenres 全量。骨架与真实行等量，
           * 首屏不跳动；genres 未落地时仅「全部」，FILL_CHIPS 撑满不露底。
           */}
          <GenreChips category={category} />
        </div>
      </div>
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">地区</span>
        <div className="filter-bar__chips-scroll">
          {/* 真实地区行 = 「全部」+ regionOptions，骨架须含「全部」占位才等量 */}
          <Skeleton className="browse-chrome-skeleton__chip" style={chipStyle('全部')} />
          <LabeledChipGroup
            labels={regionOptions.slice(0, collapsible ? FILTER_COLLAPSE_LIMIT.region : undefined).map((o) => o.label)}
            extra={collapsible && regionOptions.length > FILTER_COLLAPSE_LIMIT.region ? 1 : 0}
          />
        </div>
      </div>
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">年份</span>
        <div className="filter-bar__chips-scroll">
          {/* 真实年份行 = 「全部」+ YEAR_OPTIONS + 「其他」，骨架同样含「全部」 */}
          <Skeleton className="browse-chrome-skeleton__chip" style={chipStyle('全部')} />
          {/* 年份：「其他」语义独立、折叠时也始终可见，故先截断年份数字再拼「其他」 */}
          <LabeledChipGroup
            labels={[
              ...YEAR_OPTIONS.slice(0, collapsible ? FILTER_COLLAPSE_LIMIT.year : undefined).map((o) => o.label),
              YEAR_OLDER_LABEL,
            ]}
            extra={collapsible && YEAR_OPTIONS.length > FILTER_COLLAPSE_LIMIT.year ? 1 : 0}
          />
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
