/**
 * CategoryInlineBoard — 首页「合集」推荐行（2026-09-30 用户定稿：独立接口 + 横滚排列）
 *
 * 数据链（2026-09-30 起与首页 8 桶脱钩——那与下方推荐行同接口同数据，用户明确不用；
 * 独立取数的目的 = 首页性能解耦：首屏关键请求只 trending/nowPlaying 两个，合集行
 * 不再要求 8 桶凑齐才渲染）：
 *  · 定义单真源 = useTMDBStore 的 HOME_COLLECTION_DEFS（6 组 genre 维度合集，
 *    discover 口径与 CQA 面板 / Chart 页一致：popularity 降序）；
 *  · 拉取时机 = 首页挂载（ensureHomeCollections，**不等本行滚入视口**——用户明确要求），
 *    内存 TTL 60min、不落 LS；6 组受限并发（mapWithConcurrency），
 *    **全到齐才一次写 state**（用户拍板「全到齐再显示」，期间恒显骨架）；
 *  · 封面 = 每组 popularity 前 4 张 backdrop（w300），占位性质（用户确认
 *    「每组选几个封面显示即可或者使用固定图片占位」）；
 *  · 点击合集卡 → /chart?collection=<key>（Chart 页合集直达榜，本组件内导航，
 *    与 CategoryQuickAccess 的 chart 跳转同款先例）。
 *
 * UI 排列（用户拍板「排列占位与继续观看保持一致，不是恒定显示 6 个」）：
 *  · 复用 TMDBMovieRow 的 continue 横滚外壳类名（.tmdb-movierow--continue，
 *    几何唯一真源），真实卡/骨架卡均追加 tmdb-movierow-card 类吃同款
 *    --continue-cols 卡宽公式（TMDBMovieRow.css）；
 *  · 骨架（2026-10-09 用户澄清）：**排列**参考继续观看 —— 张数
 *    ceil(useGridCols('--continue-cols') × 1.5) 动态派生（同 SkeletonCards 公式）、
 *    逐卡错峰 shimmer；**内部结构保持合集真实卡的 2×2 拼贴形状不变**（用户明确
 *    「其 2×2 的布局不要变」）—— 拼贴灰块网格与真实卡同构，天然等高防布局位移；
 *  · 行标题「合集推荐」对齐其余内容行的 .tmdb-movierow-title 样式（用户指出缺标题）；
 *  · 不显示条数（2026-10-09 用户拍板）：discover 首页仅 20 条，卡上「N 部」是假数据；
 *  · 数量由数据决定：有几组显示几张。
 *
 * 生效范围：仅桌面 ≥1024 非 TV —— 由首页 isWide（useIsWideDesktop）分支渲染，
 * CSS 侧再以 @media(width>=1024px) + html:not([data-device="tv"]) 双重隔离。
 */
import { useShallow } from 'zustand/react/shallow';
import { useTMDBStore } from '@/stores/useTMDBStore';
import { useGridCols } from '@/hooks/useGridCols';
import LazyImage from '@/components/LazyImage/LazyImage';
import { useCustomNavigate } from '@/lib/navigation';
import './CategoryInlineBoard.css';

export function CategoryInlineBoard() {
  const navigate = useCustomNavigate();
  const skeletonCount = useSkeletonCount();
  const { homeCollections, loadingHomeCollections } = useTMDBStore(
    useShallow((s) => ({
      homeCollections: s.homeCollections,
      loadingHomeCollections: s.loadingHomeCollections,
    })),
  );

  // 加载结束仍为空 = 全部 6 组失败 → 不占位（首页自身有整体空态与错误提示）
  if (!loadingHomeCollections && homeCollections.length === 0) return null;

  return (
    <section className="cqa-board" aria-label="合集推荐">
      {/* 外壳类名复用 TMDBMovieRow continue 行（几何同源），不加行级入场动画（skipAnimations 口径） */}
      <div className="tmdb-movierow tmdb-movierow--continue cqa-board__row">
        <div className="tmdb-movierow-header">
          <h2 className="tmdb-movierow-title">合集推荐</h2>
        </div>
        <div className="tmdb-movierow-wrapper">
          <div className="tmdb-movierow-scroll">
            {loadingHomeCollections ? (
              <CategoryBoardSkeletonCards count={skeletonCount} />
            ) : (
              homeCollections.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  /* tmdb-movierow-card：吃 continue 行同款卡宽公式（TMDBMovieRow.css :328），
                     cursor pointer 由下方合集卡自有规则覆盖（合集卡是点击跳转、无行拖拽） */
                  className="tmdb-movierow-card cqa-board__collection"
                  aria-label={col.title}
                  onClick={() => navigate(`/chart?collection=${col.key}`)}
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
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** 骨架张数：与继续观看行骨架（SkeletonCards landscape）完全同款派生公式
 *  ceil(--continue-cols × 1.5)，列数真源仍是 CSS token（useGridCols 只读），
 *  非恒 6（用户拍板「不是恒定显示 6 个」）。 */
function useSkeletonCount(): number {
  const cols = useGridCols('--continue-cols', 7);
  return Math.ceil(cols * 1.5);
}

/** 合集卡骨架：排列与继续观看骨架同源（张数派生公式 + tmdb-movierow-card 卡宽 +
 *  逐卡错峰 delay (i%4)×0.2s），**内部保持真实合集卡的 2×2 拼贴形状**（用户澄清
 *  「2×2 的布局不要变」）——拼贴灰块网格与真实卡同构（每格 16:9），天然等高，
 *  数据到齐切换时零布局位移。历史教训：骨架/真实漂移。 */
function CategoryBoardSkeletonCards({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="tmdb-movierow-card cqa-board__collection cqa-board__collection--skeleton"
          aria-hidden="true"
        >
          <span className="cqa-board__collage">
            {Array.from({ length: 4 }).map((__, j) => (
              <span
                key={j}
                className="cqa-board__collage-img cqa-board__sk"
                style={{ animationDelay: `${(i % 4) * 0.2}s` }}
              />
            ))}
          </span>
          <span className="cqa-board__caption">
            <span className="cqa-board__sk cqa-board__sk-line cqa-board__sk-line--name" />
          </span>
        </span>
      ))}
    </>
  );
}

/** 首页整页骨架用：与真实合集行同构（真标题 + 2×2 拼贴形状骨架卡，无固定 min-height） */
export function CategoryInlineBoardSkeleton() {
  const skeletonCount = useSkeletonCount();
  return (
    <section className="cqa-board cqa-board--skeleton" aria-hidden="true">
      <div className="tmdb-movierow tmdb-movierow--continue cqa-board__row">
        <div className="tmdb-movierow-header">
          <h2 className="tmdb-movierow-title">合集推荐</h2>
        </div>
        <div className="tmdb-movierow-wrapper">
          <div className="tmdb-movierow-scroll">
            <CategoryBoardSkeletonCards count={skeletonCount} />
          </div>
        </div>
      </div>
    </section>
  );
}
