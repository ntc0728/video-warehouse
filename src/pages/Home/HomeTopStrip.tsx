/**
 * HomeTopStrip — 首页顶部过渡带（2026-09-10 大屏整改补强之二）
 *
 * 位置：StickyHeader 与 HeroBanner 之间，仅在宽屏桌面（≥1024，与 HeroBili 同条件）渲染。
 * 目的：原布局里 header 结束就直接顶上一张大图，导航与首屏内容之间没有任何缓冲；
 *       本组件补一条过渡带，同时给大屏一个信息锚点
 *       （今日趋势条数 / 最热分类 / 个人内容计数 / 热度榜入口）。
 *
 * 首项文案：2026-09-10 用户要求由「首页」改为「公告」
 *       （home-topstrip__crumb 类名沿用旧名，语义上已是「公告」标签而非面包屑；
 *        改类名会牵动 CSS 且无功能收益，故保留类名 + 此处说明）。
 *
 * 视觉：通栏底色 + 底边框，内容宽度与 `.home-page__content` 同为 2200 封顶居中
 *       （与「顶栏对齐」补强同一契约）。
 */
import { useMemo } from 'react';
import { Flame, ChevronRight } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { useCustomNavigate } from '@/lib/navigation';
import { useTMDBStore } from '@/stores';
import {
  aggregateCategoryHeat,
  WIDE_CATEGORIES,
} from '@/components/CategoryQuickAccess';

interface HomeTopStripProps {
  /** 「继续观看」条数（无则整块不渲染） */
  continueCount: number;
  /** 收藏条数（无则整块不渲染） */
  favoriteCount: number;
}

export default function HomeTopStrip({ continueCount, favoriteCount }: HomeTopStripProps) {
  const navigate = useCustomNavigate();
  const trending = useTMDBStore((s) => s.trending);

  // 最热分类：复用「分类热度榜」同一套桶聚合口径，避免两处热度算法漂移
  const topCategoryLabel = useMemo(() => {
    const first = aggregateCategoryHeat(trending)[0];
    if (!first) return null;
    return WIDE_CATEGORIES.find((c) => c.key === first.key)?.label ?? null;
  }, [trending]);

  const hasPersonal = continueCount > 0 || favoriteCount > 0;

  return (
    <div className="home-topstrip">
      <div className="home-topstrip__inner">
        <span className="home-topstrip__crumb">公告</span>
        {trending.length > 0 && (
          <>
            <span className="home-topstrip__sep" aria-hidden="true" />
            <span className="home-topstrip__stat">
              今日趋势 <b>{trending.length}</b> 条
            </span>
          </>
        )}
        {topCategoryLabel && (
          <>
            <span className="home-topstrip__sep" aria-hidden="true" />
            <span className="home-topstrip__stat">
              <Icon icon={Flame} size="xs" className="home-topstrip__flame" />
              最热分类 <b>{topCategoryLabel}</b>
            </span>
          </>
        )}
        <div className="home-topstrip__right">
          {hasPersonal && (
            <>
              {continueCount > 0 && (
                <span className="home-topstrip__pill">继续观看 {continueCount}</span>
              )}
              {favoriteCount > 0 && (
                <span className="home-topstrip__pill">收藏 {favoriteCount}</span>
              )}
            </>
          )}
          <button
            className="home-topstrip__more"
            onClick={() => navigate('/chart')}
            aria-label="查看完整热度榜"
          >
            完整热度榜
            <Icon icon={ChevronRight} size="xs" />
          </button>
        </div>
      </div>
    </div>
  );
}
