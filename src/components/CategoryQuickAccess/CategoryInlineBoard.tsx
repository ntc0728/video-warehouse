/**
 * CategoryInlineBoard — 首页「合集」推荐行（2026-09-29，类名保留 cqa-board 前缀）
 *
 * 演进：原「chip + 今日最热排名面板」经用户多轮反馈后改造为「6 张合集卡」——
 * 用户原话「看看能不能显示成合集之类的，动作电影合集、怀旧动画合集之类的，
 * 取 6 个就行，然后跟随首页缓存更新，不固定显示相关合集」。
 *
 * 数据链（核心约束：**零新增网络请求**，全部从首页缓存派生）：
 *  · 来源 = useTMDBStore 的 8 个首页数据桶（trending / nowPlaying / popularMovies /
 *    topRatedMovies / upcomingMovies / popularTv / topRatedTv / airingTodayTv，
 *    首页首屏档 + LazyBlock 懒加载的既有缓存，不在此重复拉取、不碰 fetchAllHomeData）；
 *  · 派生规则：按源表顺序遍历（内容优先级固定，避免刷新跳变），桶非空且至少有
 *    1 张可拼贴封面才入选，取前 6 个——缓存不足 6 个桶就显示实际数量；
 *  · 命名 = 缓存桶语义 ×「合集」后缀（如「热门电影合集」「高分剧集合集」）；
 *    全仓无静态 genre id→名称映射（genre 名仅 TMDB API 可得，被禁请求），
 *    故无法产出「动作电影合集」式 genre 维度命名，见问题清单；
 *  · 跟随首页缓存更新：合集由 useMemo 从订阅的桶数组派生，首页数据刷新
 *    （TTL / 下拉刷新）后自动重算，不固定。
 *
 * 交互：点击合集卡 → onCollectionSelect(browseKey)，由首页 handleCategorySelect
 * → buildBrowseUrl 跳对应分类（复用现有跳转协议，不自造参数）。
 *
 * 视口懒加载：useInViewport（+200px 提前量）滚入前渲染等高骨架（6 张合集卡占位），
 * once 保持解锁（Keep-Alive 二次进入不回退骨架）。
 *
 * 生效范围：仅桌面 ≥1024 非 TV —— 由首页 isWide（useIsWideDesktop）分支渲染，
 * CSS 侧再以 @media(width>=1024px) + html:not([data-device="tv"]) 双重隔离。
 */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { HomeBlockKey } from '@/stores/useTMDBStore';
import { useTMDBStore } from '@/stores/useTMDBStore';
import type { TMDBVideoItem } from '@/types/tmdb';
import LazyImage from '@/components/LazyImage/LazyImage';
import { buildImageUrl } from '@/services/tmdbService';
import { useInViewport } from '@/hooks/useInViewport';
import type { CategoryKey } from './CategoryQuickAccess';
import './CategoryInlineBoard.css';

/** 每张合集卡的封面拼贴张数（不足时按实际数量，1 张也渲染） */
const COLLECTION_COVER_COUNT = 4;
/** 合集卡上限（用户拍板「取 6 个就行」） */
const COLLECTION_MAX = 6;

/** 合集候选源：block = 首页缓存桶；root = 桶语义词根（命名 ×「合集」后缀）；
 *  browseKey = 现有 Browse 分类协议 key（点击跳转映射，不自造参数） */
interface CollectionSource {
  block: HomeBlockKey;
  root: string;
  browseKey: CategoryKey;
}

const COLLECTION_SOURCES: CollectionSource[] = [
  { block: 'nowPlaying', root: '正在热映', browseKey: 'movie' },
  { block: 'popularMovies', root: '热门电影', browseKey: 'movie' },
  { block: 'topRatedMovies', root: '高分电影', browseKey: 'movie' },
  { block: 'upcomingMovies', root: '即将上映', browseKey: 'movie' },
  { block: 'popularTv', root: '热门剧集', browseKey: 'tv' },
  { block: 'topRatedTv', root: '高分剧集', browseKey: 'tv' },
  { block: 'airingTodayTv', root: '今日播出', browseKey: 'tv' },
  { block: 'trending', root: '今日趋势', browseKey: 'all' },
];

/** 单张合集卡数据（全部由缓存派生，无任何请求） */
interface BoardCollection {
  key: string;
  title: string;
  browseKey: CategoryKey;
  /** 可拼贴的真实封面（backdrop 16:9，w300 档），popularity 降序取前 4 */
  covers: string[];
  count: number;
}

function buildCollections(
  buckets: Record<HomeBlockKey, TMDBVideoItem[]>,
): BoardCollection[] {
  const out: BoardCollection[] = [];
  for (const { block, root, browseKey } of COLLECTION_SOURCES) {
    const items = buckets[block];
    // 缓存桶为空（未滚入懒加载 / 失败冷却期）→ 该合集不渲染、不占位、不发请求
    if (!items || items.length === 0) continue;
    const sorted = [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const covers = sorted
      .map((it) => buildImageUrl(it.backdropPath ?? null, 'w300'))
      .filter((src): src is string => !!src)
      .slice(0, COLLECTION_COVER_COUNT);
    // 桶有数据但一张可拼贴封面都没有（极端脏数据）→ 同样不渲染
    if (covers.length === 0) continue;
    out.push({
      key: block,
      title: `${root}合集`,
      browseKey,
      covers,
      count: items.length,
    });
    if (out.length >= COLLECTION_MAX) break;
  }
  return out;
}

export function CategoryInlineBoard({
  onCollectionSelect,
}: {
  onCollectionSelect: (browseKey: CategoryKey) => void;
}) {
  // 订阅 8 个首页缓存桶：任一桶刷新（TTL / 下拉刷新）→ 合集自动重算
  const buckets = useTMDBStore(
    useShallow((s) => ({
      trending: s.trending,
      nowPlaying: s.nowPlaying,
      popularMovies: s.popularMovies,
      topRatedMovies: s.topRatedMovies,
      upcomingMovies: s.upcomingMovies,
      popularTv: s.popularTv,
      topRatedTv: s.topRatedTv,
      airingTodayTv: s.airingTodayTv,
    })),
  );
  // 视口懒加载：once=true 命中后保持解锁（Keep-Alive 二次进入不回退骨架）
  const { ref, inView } = useInViewport<HTMLDivElement>({ rootMargin: '200px' });

  const collections = useMemo(() => buildCollections(buckets), [buckets]);

  // 未滚入视口：等高骨架占位（6 张合集卡）
  if (!inView) {
    return (
      <section ref={ref} className="cqa-board" aria-hidden="true">
        <CategoryBoardSkeletonCards />
      </section>
    );
  }

  // 已滚入但缓存全部为空（首页数据尚未就绪/全部失败）→ 不占位（首页自身有整体空态）
  if (collections.length === 0) {
    return <section ref={ref} className="cqa-board" />;
  }

  return (
    <section ref={ref} className="cqa-board" aria-label="合集推荐">
      <div className="cqa-board__collections">
        {collections.map((col) => (
          <button
            key={col.key}
            type="button"
            className="cqa-board__collection"
            aria-label={`${col.title}，共 ${col.count} 部`}
            onClick={() => onCollectionSelect(col.browseKey)}
          >
            <span className="cqa-board__collage">
              {col.covers.map((src, i) => (
                <LazyImage
                  key={src}
                  src={src}
                  alt=""
                  className={`cqa-board__collage-img${
                    col.covers.length === 3 && i === 2 ? ' cqa-board__collage-img--span' : ''
                  }`}
                />
              ))}
            </span>
            <span className="cqa-board__caption">
              <span className="cqa-board__name">{col.title}</span>
              <span className="cqa-board__count">{col.count} 部</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** 合集卡骨架：复用真实类名（__collection/__collage/__caption）承载几何，
 *  只把内容换成 shimmer 灰块/灰条 —— 不引入第二套几何模型（历史教训：骨架/真实漂移） */
function CategoryBoardSkeletonCards() {
  return (
    <div className="cqa-board__collections">
      {Array.from({ length: COLLECTION_MAX }).map((_, i) => (
        <span key={i} className="cqa-board__collection cqa-board__collection--skeleton">
          <span className="cqa-board__collage cqa-board__sk" />
          <span className="cqa-board__caption">
            <span className="cqa-board__sk cqa-board__sk-line cqa-board__sk-line--name" />
            <span className="cqa-board__sk cqa-board__sk-line cqa-board__sk-line--count" />
          </span>
        </span>
      ))}
    </div>
  );
}

/** 首页整页骨架用：与真实合集行同构等高（6 张骨架卡，无固定 min-height） */
export function CategoryInlineBoardSkeleton() {
  return (
    <section className="cqa-board cqa-board--skeleton" aria-hidden="true">
      <CategoryBoardSkeletonCards />
    </section>
  );
}
