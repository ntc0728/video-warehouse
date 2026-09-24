/**
 * 详情页专属骨架 — 与真实页面**逐区块**同构（2026-09-18 补齐缺失区块；2026-09-24 按用户要求
 * 把 tab 标签也改回骨架方框、右栏 info-card 高度对齐真实单行）。
 *
 * 旧实现只镜像了 `.detail-top` + 一段简介，缺 tabs / 演员 / 剧照 / 两个推荐行 →
 * 骨架高度远小于真实页，数据到达时整页高度突变（明显 CLS）。
 * 现按 Detail/index.tsx 的真实渲染顺序逐块镜像：
 *
 *   .detail-top（≥1024 两栏 1.4fr/1fr；<1024 / App / TV 堆叠，右栏隐藏）
 *     section.detail-hero      16:9 + 底部标题/元信息/简介行
 *     aside.detail-hero-side   类型 chips + 基础信息网格（2 列）
 *   .detail-tabs-wrap          2 个 tab 槽（图标 + 标签均为骨架方框，不渲染真实文字；
 *                              外壳仍用真实 .detail-tab / .tab-underline 保证 padding/下划线几何）
 *   .detail-content
 *     演员        .detail-cast-row--collapsed（右侧默认折叠 2 行，与真实首屏一致）
 *     简介        若干行（末行短）
 *     剧照        .detail-stills-grid + .detail-stills-skeleton（与真实页自身剧照骨架同值 6 张）
 *   相关推荐 / 你可能还喜欢      各 1 行网格（真实 `slice(0, 12)` → 上限 12 张）
 *
 * 「已知常量不当未知」（2026-09-18 用户要求）：区块**数量**与**顺序**都是确定的
 * （tabs 2/3、推荐区 2、剧照 6、推荐上限 12），骨架按真实常量渲染，不用「随便来几块」糊弄。
 * 唯一在数据到达前不可知的是「条件项是否出现」（真实基础信息有 13 个条件项，
 * 单部作品典型命中 6–9 个）→ 取典型值 INFO_CARD_COUNT 并在此注明。
 *
 * 2026-09-24 用户修正：① tab「概览/播放列表」**不要直接显示真实文字**，改用方框（图标槽 +
 * 标签槽两块 skeleton），但外壳仍复用 .detail-tab 使上下 padding/下划线与真实元素一致；
 * ② 右栏 .detail-skeleton__info-card 旧 height 3.25em 远大于真实单行 info-card，
 * 改为与真实 .detail-info-card 同行高（--text-sm 行高量级）。
 *
 * 视口差异化走 CSS 断点（width >= 1024px + html[data-device] 门控，与 Detail.css 同口径），不用 JS。
 */
import Skeleton from '@/components/common/Skeleton';
import { useGridCols } from '@/hooks';
import './DetailSkeleton.css';

/** tabs：真实前两项恒为概览/播放列表（TV 多一个「季信息」，骨架取公共最小 2）；
    图标/标签均改骨架方框（2026-09-24），wide 区分标签槽宽度档（2 字 vs 4 字） */
const TAB_ITEMS = [
  { key: 'info', wide: false },
  { key: 'sources', wide: true },
] as const;
/** 类型 chips：真实 = genres.length（TMDB 典型 2–5） */
const GENRE_CHIP_COUNT = 4;
/** 基础信息卡（仅 grid 内；评分/国家/发行已改全宽 side-line）：
    真实条件项最多 13，单部电影 grid 典型 7（发行时间/状态/时长/语言/导演/预算/票房）→ 取 7 */
const INFO_CARD_COUNT = 7;
/** 全宽 side-line：评分 + 国家 + 发行（与真实 .detail-info-row 三条对齐） */
const INFO_ROW_COUNT = 3;
/** 演员卡槽：真实 `.detail-cast-row--collapsed`（auto-fill minmax(6rem,1fr)，折叠 2 行） */
const CAST_SLOTS = 12;
/** 简介行数：真实为一段文本，桌面典型 3 行 */
const OVERVIEW_LINES = 3;
/** 剧照：与真实页自身剧照加载骨架同值（Detail/index.tsx 的 6 个 .detail-stills-skeleton） */
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

  return (
    <div className="detail-skeleton skeleton-scope" role="status" aria-label="加载中">
      {/* ── hero + 右侧信息卡 ── */}
      <div className="detail-skeleton__top">
        <div className="detail-skeleton__hero">
          <Skeleton className="detail-skeleton__hero-bg" />
          <div className="detail-skeleton__hero-content">
            <Skeleton className="detail-skeleton__title" />
            <Skeleton className="detail-skeleton__meta" />
            <Skeleton className="detail-skeleton__meta detail-skeleton__meta--short" />
          </div>
        </div>
        <aside className="detail-hero-side detail-skeleton__side">
          <h2 className="detail-section-title">基础信息</h2>
          <div className="detail-skeleton__chips">
            {Array.from({ length: GENRE_CHIP_COUNT }, (_, i) => (
              <Skeleton key={i} className="detail-skeleton__chip" />
            ))}
          </div>
          <div className="detail-skeleton__info-grid">
            {Array.from({ length: INFO_CARD_COUNT }, (_, i) => (
              <Skeleton key={i} className="detail-skeleton__info-card" />
            ))}
          </div>
          {Array.from({ length: INFO_ROW_COUNT }, (_, i) => (
            <Skeleton key={i} className="detail-skeleton__side-line" />
          ))}
        </aside>
      </div>

      {/* ── Tab 导航：外壳复用真实 .detail-tabs-wrap / .detail-tabs / .detail-tab /
           .tab-underline（padding / 下划线 / gap 几何与真实一致）；
           图标槽 + 标签槽均为骨架方框，不渲染「概览/播放列表」真实文字（2026-09-24 用户要求）── */}
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

      {/* ── 概览 tab：演员 → 简介 → 剧照（内层 .detail-info 复用真实页内壳：
           padding / 块级流 / 标题 margin 全部单真源，骨架不再自己搭 flex 间距）── */}
      <div className="detail-content">
        <div className="detail-info">
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

          <h3 className="detail-section-subtitle">简介</h3>
          <div className="detail-skeleton__overview-list">
            {Array.from({ length: OVERVIEW_LINES }, (_, i) => (
              <Skeleton
                key={i}
                className={`detail-skeleton__overview${i === OVERVIEW_LINES - 1 ? ' detail-skeleton__overview--short' : ''}`}
              />
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
