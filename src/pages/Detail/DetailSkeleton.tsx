/**
 * 详情页专属骨架 — 与真实页面**逐区块**同构（2026-10-10 按方案 A · 海报对开重构）。
 *
 * 真实渲染顺序（Detail/index.tsx 方案 A）：
 *   .detail-hero（海报对开：≥768 两列 海报列|文本区，<768 单列文本区）
 *     .detail-hero-poster   竖海报 2:3（骨架 = 灰块）
 *     .detail-hero-info     横板底纹区：kicker / 标题 / meta / 简介 3 行 / CTA 按钮行
 *   .detail-facts（资料区）
 *     .detail-tabs-wrap     tab 槽骨架（图标 + 标签方框，不渲染真实文字，外壳复用真实类）
 *     .detail-content
 *       基础信息表   chips 4 + 典型 7 格 + 2 条整行（国家/发行）
 *       演员         .detail-cast-row--collapsed 12 槽
 *       剧照         .detail-stills-grid 6 张
 *   相关推荐 / 你可能还喜欢   各 1 行网格（slice(0,12)）
 *
 * 复用真实结构类（.detail-hero/.detail-hero-poster/.detail-hero-info/.detail-hero-body/
 * .detail-facts-grid/.detail-fact/.detail-tabs/.detail-cast-row/.detail-stills-grid/.detail-recommend），
 * 布局几何单真源自动跟随 ≥768 两列形态；骨架私有类只管灰块尺寸与「同构常量」。
 *
 * 「已知常量不当未知」（2026-09-18 要求）：区块数量与顺序确定；唯一不可知的是条件字段
 * （真实基础信息 12 个条件项 + 2 整行）→ 取典型 INFO_CELL_COUNT=7 / FULL_ROW_COUNT=2 并在此注明。
 * 旧 .detail-top / .detail-hero-side 两栏镜像随方案 A 退役（2026-10-10）。
 */
import { useEffect, useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols } from '@/hooks';
import './DetailSkeleton.css';

/** tabs：真实前两项恒为概览/播放列表（TV 多一个「季信息」，骨架取公共最小 2）；
    图标/标签均为骨架方框，wide 区分标签槽宽度档（2 字 vs 4 字） */
const TAB_ITEMS = [
  { key: 'info', wide: false },
  { key: 'sources', wide: true },
] as const;
/** 类型 chips：真实 = genres.length（TMDB 典型 2–5） */
const GENRE_CHIP_COUNT = 4;
/** 基础信息表格数：真实条件项最多 12，典型命中 7（评分/发行时间/状态/时长/语言/导演/票房） */
const INFO_CELL_COUNT = 7;
/** 整行（国家 / 发行）恒 2 条 */
const FULL_ROW_COUNT = 2;
/** 演员卡槽：真实 `.detail-cast-row--collapsed`（auto-fill minmax(6rem,1fr)，折叠 2 行） */
const CAST_SLOTS = 12;
/** hero 简介行数：真实 3 行折叠，典型 3 行 */
const OVERVIEW_LINES = 3;
/** 剧照：与真实页自身剧照加载骨架同值 6 张 */
const STILL_COUNT = 6;
/** 推荐区：真实最多 2 个（相关推荐 / 你可能还喜欢），每个 slice(0, 12) */
const RECOMMEND_SECTIONS = ['相关推荐', '你可能还喜欢'] as const;
const RECOMMEND_MAX_ITEMS = 12;

/** 竖版海报卡（镜像 VideoCard 壳：封面 2:3 + 标题行），推荐网格用 */
function RecommendCardSkeleton() {
  return (
    <div className="video-card detail-skeleton__rec-card">
      <div className="video-card-cover">
        <Skeleton className="detail-skeleton__rec-cover" />
      </div>
      <div className="video-card-info">
        <div className="video-card-title-wrap">
          <Skeleton className="detail-skeleton__rec-title" />
        </div>
      </div>
    </div>
  );
}

export default function DetailSkeleton() {
  const cols = useGridCols('--card-cols', 7);

  /** hero 两列等高（镜像真实页 index.tsx 的 sync 逻辑，同一公式同一上限）：
   *  RO 量文本区高写 --poster-w = 高×2/3 → 海报列永远 2:3、宽高同变零裁切。
   *  骨架若不跑同款测量，海报列停在视口回退值（1440 下 245px），info 列偏宽
   *  → 文字换行少 → 骨架比真实页矮，数据到达时高度跳变。 */
  const heroInfoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const info = heroInfoRef.current;
    const hero = info?.closest('.detail-hero') as HTMLElement | null;
    if (!info || !hero) return;
    const sync = () => {
      const h = info.clientHeight;
      if (h <= 0) return;
      const w = Math.round(Math.min(330, Math.max(160, (h * 2) / 3)));
      const cur = parseInt(hero.style.getPropertyValue('--poster-w'), 10);
      if (!Number.isFinite(cur) || Math.abs(cur - w) > 2) {
        hero.style.setProperty('--poster-w', `${w}px`);
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(info);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="detail-skeleton skeleton-scope" role="status" aria-label="加载中">
      {/* ── hero 对开：海报列 | 文本区（真实 .detail-hero 两列几何自动生效）── */}
      <div className="detail-hero detail-skeleton__hero">
        <div className="detail-hero-poster detail-skeleton__poster">
          <Skeleton className="detail-skeleton__poster-img" />
        </div>
        <div ref={heroInfoRef} className="detail-hero-info detail-skeleton__hero-info">
          <div className="detail-hero-body">
            <div className="detail-hero-topline">
              <Skeleton className="detail-skeleton__kicker" />
            </div>
            <Skeleton className="detail-skeleton__title" />
            <Skeleton className="detail-skeleton__meta" />
            <Skeleton className="detail-skeleton__meta detail-skeleton__meta--short" />
            <div className="detail-skeleton__overview-list">
              {Array.from({ length: OVERVIEW_LINES }, (_, i) => (
                <Skeleton
                  key={i}
                  className={`detail-skeleton__overview${i === OVERVIEW_LINES - 1 ? ' detail-skeleton__overview--short' : ''}`}
                />
              ))}
            </div>
            <div className="detail-skeleton__btn-row">
              <Skeleton className="detail-skeleton__btn detail-skeleton__btn--play" />
              <Skeleton className="detail-skeleton__btn" />
              <Skeleton className="detail-skeleton__btn" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 资料区：tab 槽 + 基础信息表 + 演员 + 剧照 ── */}
      <div className="detail-facts">
        {/* tab 条：外壳复用真实 .detail-tabs-wrap / .detail-tabs / .detail-tab /
            .tab-underline（padding / 下划线几何单真源）；图标槽 + 标签槽均为骨架方框 */}
        <div className="detail-tabs-wrap">
          <div className="detail-tabs">
            {TAB_ITEMS.map((tab) => (
              <span
                key={tab.key}
                className="tab-underline detail-tab detail-skeleton__tab"
                aria-hidden="true"
              >
                <Skeleton className="detail-skeleton__tab-icon" />
                <Skeleton
                  className={`detail-skeleton__tab-label${tab.wide ? ' detail-skeleton__tab-label--wide' : ''}`}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="detail-content">
          <div className="detail-info">
            <h2 className="detail-section-title">基础信息</h2>
            <div className="detail-genres detail-skeleton__chips">
              {Array.from({ length: GENRE_CHIP_COUNT }, (_, i) => (
                <Skeleton key={i} className="detail-skeleton__chip" />
              ))}
            </div>
            <div className="detail-facts-grid detail-skeleton__facts-grid">
              {Array.from({ length: INFO_CELL_COUNT }, (_, i) => (
                <div key={i} className="detail-fact detail-skeleton__fact">
                  <Skeleton className="detail-skeleton__fact-label" />
                  <Skeleton className="detail-skeleton__fact-value" />
                </div>
              ))}
              {Array.from({ length: FULL_ROW_COUNT }, (_, i) => (
                <div key={`full-${i}`} className="detail-fact detail-fact--full detail-skeleton__fact-full">
                  <Skeleton className="detail-skeleton__fact-label" />
                  <Skeleton className="detail-skeleton__side-line" />
                </div>
              ))}
            </div>

            <h3 className="detail-section-subtitle">演员</h3>
            <div className="detail-cast-row detail-cast-row--collapsed detail-skeleton__cast">
              {Array.from({ length: CAST_SLOTS }, (_, i) => (
                <div key={i} className="detail-cast-item detail-skeleton__cast-item">
                  <Skeleton className="detail-skeleton__cast-avatar" />
                  <Skeleton className="detail-skeleton__cast-name" />
                  <Skeleton className="detail-skeleton__cast-role" />
                </div>
              ))}
            </div>

            <h3 className="detail-section-subtitle">剧照</h3>
            <div className="detail-stills-grid">
              {Array.from({ length: STILL_COUNT }, (_, i) => (
                <div key={i} className="detail-stills-skeleton" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 两个推荐行（真实位于页面最底部，各 slice(0,12)；标题为静态配置，渲染真实文字）── */}
      {RECOMMEND_SECTIONS.map((label) => (
        <section key={label} className="detail-recommend detail-skeleton__recommend">
          <h2 className="detail-recommend-title">{label}</h2>
          <div className="detail-recommend-row detail-skeleton__recommend-row">
            {Array.from({ length: Math.min(RECOMMEND_MAX_ITEMS, cols * 2) }, (_, i) => (
              <div key={i} className="detail-recommend-card">
                <RecommendCardSkeleton />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
