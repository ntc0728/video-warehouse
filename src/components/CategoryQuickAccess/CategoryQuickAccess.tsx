/**
 * CategoryQuickAccess — 分类快速入口
 * 两条渲染分支：
 *   · >1280 桌面（useIsWideDesktop，TV 恒排除）：方案 A2「频道导航 + 热门分类面板」——
 *     文字+图标导航条（chip 不跳转、展开下方面板）+ 默认「分类热度榜」（前 3 分类 ×
 *     右侧 top3 热门搜索值）+ 分类面板（子分类 chips + 3 行 × 3 列热门内容卡）。
 *     数据与图标方案见 changelogs/design-docs/2026-09-06-category-quick-access-a2-实施方案.md。
 *   · 其余端（≤1280 / app）：7 个固定彩色圆卡（现状不变），点击跳 browse。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Camera,
  Film,
  Flame,
  Home as HomeIcon,
  LayoutGrid,
  Mic2,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TMDBVideoItem } from '@/types/tmdb';
import { Icon } from '@/components/ui/Icon';
import LazyImage from '@/components/LazyImage/LazyImage';
import { buildImageUrl } from '@/services/tmdbService';
import { useTMDBStore } from '@/stores/useTMDBStore';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useIsWideDesktop } from '@/hooks/useIsWideDesktop';
import { useCustomNavigate } from '@/lib/navigation';
import {
  WIDE_CATEGORIES,
  aggregateCategoryHeat,
  fetchCategoryPanel,
  getGenreSubcategories,
  type WideCategoryKey,
  type WideSubCategory,
} from './categoryPanelData';
import './CategoryQuickAccess.css';

export type CategoryKey = 'all' | 'movie' | 'tv' | 'variety' | 'anime' | 'top' | 'documentary';

interface Category {
  key: CategoryKey;
  icon: typeof LayoutGrid;
  label: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { key: 'all', icon: LayoutGrid, label: '全部', color: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  { key: 'movie', icon: Film, label: '电影', color: 'linear-gradient(135deg, #ff4757, #ff6b81)' },
  { key: 'tv', icon: Tv, label: '剧集', color: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
  { key: 'variety', icon: Mic2, label: '综艺', color: 'linear-gradient(135deg, #f97316, #fb923c)' },
  { key: 'anime', icon: Sparkles, label: '动漫', color: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
  { key: 'documentary', icon: Camera, label: '纪录片', color: 'linear-gradient(135deg, #16a34a, #4ade80)' },
  { key: 'top', icon: Trophy, label: '排行榜', color: 'linear-gradient(135deg, #eab308, #facc15)' },
];

// 移动端只显示的分类
const MOBILE_CATEGORIES: CategoryKey[] = ['all', 'movie', 'tv', 'variety', 'anime', 'top'];

/** 宽屏导航图标映射（移动端圆卡维持 CATEGORIES 原映射，互不影响） */
const WIDE_NAV_ICONS: Record<string, LucideIcon> = {
  home: HomeIcon,
  movie: Film,
  tv: Tv,
  variety: Mic2,
  anime: Sparkles,
  documentary: Video,
  top: Trophy,
};

interface CategoryQuickAccessProps {
  onCategorySelect: (category: CategoryKey) => void;
}

export default function CategoryQuickAccess({ onCategorySelect }: CategoryQuickAccessProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const isWide = useIsWideDesktop();
  const navigate = useCustomNavigate();

  // ── 宽屏面板数据（hooks 恒序调用；非宽屏时 trending 聚合代价可忽略）──
  const trending = useTMDBStore((s) => s.trending);
  const heatBuckets = useMemo(() => aggregateCategoryHeat(trending), [trending]);
  const heatCount = useMemo(() => {
    const map: Partial<Record<WideCategoryKey, number>> = {};
    for (const b of heatBuckets) map[b.key] = b.count;
    return map;
  }, [heatBuckets]);

  const [activeKey, setActiveKey] = useState<WideCategoryKey>('home');
  const [subSel, setSubSel] = useState<Record<string, string | number>>({});
  const [genreSubs, setGenreSubs] = useState<Partial<Record<'movie' | 'tv', WideSubCategory[]>>>({});
  const [panelItems, setPanelItems] = useState<TMDBVideoItem[] | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeCat = useMemo(
    () => WIDE_CATEGORIES.find((c) => c.key === activeKey) ?? WIDE_CATEGORIES[0],
    [activeKey],
  );
  const currentSubs: WideSubCategory[] | null = useMemo(() => {
    const type = activeCat.genreListType;
    return activeCat.subgenres ?? (type ? genreSubs[type] : undefined) ?? null;
  }, [activeCat, genreSubs]);
  const currentSubId = subSel[activeCat.key] ?? currentSubs?.[0]?.id ?? 0;

  // 电影/剧集：懒加载全量 genre 子分类
  useEffect(() => {
    const type = activeCat.genreListType;
    if (!isWide || !type || genreSubs[type]) return;
    let cancelled = false;
    getGenreSubcategories(type)
      .then((list) => { if (!cancelled) setGenreSubs((prev) => ({ ...prev, [type]: list })); })
      .catch(() => { /* 子分类加载失败：面板仍可用「全部」以外的静态态？无静态态则保持空 chips */ });
    return () => { cancelled = true; };
  }, [isWide, activeCat, genreSubs]);

  // 面板数据：切换分类/子分类即取（缓存命中零请求；AbortController 防快速连点竞态）
  useEffect(() => {
    if (!isWide || activeCat.key === 'home' || !currentSubs) return;
    const sub = currentSubs.find((s) => s.id === currentSubId) ?? currentSubs[0];
    if (!sub) return;
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    setPanelLoading(true);
    fetchCategoryPanel(activeCat, sub.id, ctrl.signal)
      .then((items) => {
        if (ctrl.signal.aborted) return;
        setPanelItems(items);
        setPanelLoading(false);
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setPanelItems([]);
        setPanelLoading(false);
      });
    return () => ctrl.abort();
  }, [isWide, activeCat, currentSubs, currentSubId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const navigateDetail = useCallback(
    (id: string) => navigate(`/detail/${id}`),
    [navigate],
  );

  const selectSub = useCallback((key: string, id: string | number) => {
    setSubSel((prev) => ({ ...prev, [key]: id }));
  }, []);

  // ── 非宽屏（≤1280 / app）：7 彩色圆卡，现状不变 ──
  if (!isWide) {
    const displayCategories = isMobile
      ? CATEGORIES.filter((cat) => MOBILE_CATEGORIES.includes(cat.key))
      : CATEGORIES;
    return (
      <section className="category-quick-access">
        <div className="category-quick-access__inner">
          {displayCategories.map((cat) => {
            const CatIcon = cat.icon;
            return (
              <button
                key={cat.key}
                className="category-quick-access__card"
                onClick={() => onCategorySelect(cat.key)}
                aria-label={`分类：${cat.label}`}
              >
                <div className="category-quick-access__icon-wrap" style={{ background: cat.color }}>
                  <Icon icon={CatIcon} size={isMobile ? 'md' : isTV ? '2xl' : 'xl'} />
                </div>
                <span className="category-quick-access__label">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  // ── 宽屏（>1280 桌面，TV 已被 useIsWideDesktop 排除）：方案 A2 ──
  const top3 = heatBuckets.slice(0, 3);
  const maxHeat = top3[0]?.heat ?? 1;

  return (
    <section className="category-quick-access category-quick-access--wide">
      <nav className="cqa-nav" aria-label="分类导航">
        {WIDE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`cqa-nav__item${activeKey === cat.key ? ' cqa-nav__item--on' : ''}`}
            onClick={() => setActiveKey(cat.key)}
            aria-expanded={activeKey === cat.key}
          >
            <Icon icon={WIDE_NAV_ICONS[cat.key]} size="md" />
            <span>{cat.label}</span>
            {heatCount[cat.key] ? (
              <span className="cqa-nav__heat">
                <Icon icon={Flame} size="xs" />
                {heatCount[cat.key]}
              </span>
            ) : null}
          </button>
        ))}
        <button
          className="cqa-nav__item cqa-nav__more"
          onClick={() => onCategorySelect('all')}
        >
          <Icon icon={LayoutGrid} size="md" />
          <span>全部分类</span>
          <Icon icon={ChevronRight} size="xs" />
        </button>
      </nav>

      <div className="cqa-panel">
        {activeCat.key === 'home' ? (
          <>
            <div className="cqa-panel__head">
              <Icon icon={Flame} size="sm" />
              <span className="cqa-panel__title">分类热度榜</span>
              <span className="cqa-panel__sub">
                热度 = TMDB /trending/all/day 各分类 Σpopularity（实时）· 点击卡展开该分类
              </span>
            </div>
            {top3.length === 0 ? (
              <div className="cqa-panel__loading">正在聚合实时热度…</div>
            ) : (
              <div className="cqa-catgrid">
                {top3.map((bucket, i) => {
                  const cat = WIDE_CATEGORIES.find((c) => c.key === bucket.key);
                  if (!cat) return null;
                  return (
                    <div
                      key={bucket.key}
                      className="cqa-catcard"
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveKey(bucket.key as WideCategoryKey)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setActiveKey(bucket.key as WideCategoryKey);
                      }}
                    >
                      <div className="cqa-catcard__head">
                        <span className="cqa-catcard__rank">{i + 1}</span>
                        <Icon icon={WIDE_NAV_ICONS[cat.key]} size="md" />
                        <span className="cqa-catcard__name">{cat.label}</span>
                        <span className="cqa-catcard__heat">
                          <span className="n">{Math.round(bucket.heat)}</span>
                          <span className="l">分类热度 Σ</span>
                        </span>
                      </div>
                      <div className="cqa-catcard__bar">
                        <i style={{ width: `${((bucket.heat / maxHeat) * 100).toFixed(1)}%` }} />
                      </div>
                      <div className="cqa-catcard__list">
                        {bucket.top3.map((item, j) => (
                          <div
                            key={item.id}
                            className="cqa-catcard__row"
                            role="link"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); navigateDetail(item.id); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); navigateDetail(item.id); }
                            }}
                          >
                            <span className="cqa-catcard__idx">{j + 1}</span>
                            {buildImageUrl(item.backdropPath ?? null, 'w300') ? (
                              <LazyImage
                                src={buildImageUrl(item.backdropPath ?? null, 'w300') ?? ''}
                                alt={item.title}
                                className="cqa-catcard__poster"
                              />
                            ) : (
                              <span className="cqa-catcard__poster cqa-catcard__poster--empty thumbnail-skeleton-bg" />
                            )}
                            <span className="cqa-catcard__t">{item.title}</span>
                            <span className="cqa-catcard__h">
                              <Icon icon={Flame} size="xs" />
                              {(item.popularity || 0).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="cqa-panel__head">
              <Icon icon={WIDE_NAV_ICONS[activeCat.key]} size="sm" />
              <span className="cqa-panel__title">{activeCat.label} · 最热门搜索值</span>
              <span className="cqa-panel__sub">热度 = TMDB popularity（实时）· 点击卡进详情</span>
            </div>
            {currentSubs ? (
              <div className="cqa-subgenres">
                {currentSubs.map((s) => (
                  <button
                    key={s.id}
                    className={`cqa-subgenres__chip${currentSubId === s.id ? ' cqa-subgenres__chip--on' : ''}`}
                    onClick={() => selectSub(activeCat.key, s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="cqa-panel__loading">正在加载子分类…</div>
            )}
            {panelLoading ? (
              <div className="cqa-panel__loading">正在获取 {activeCat.label} 实时数据…</div>
            ) : (
              <div className="cqa-hotgrid">
                {(panelItems ?? []).map((item, i) => (
                  <div
                    key={item.id}
                    className="cqa-hotcard"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigateDetail(item.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateDetail(item.id); }}
                  >
                    <span className="cqa-hotcard__rank">{i + 1}</span>
                    {buildImageUrl(item.backdropPath ?? null, 'w300') ? (
                      <LazyImage
                        src={buildImageUrl(item.backdropPath ?? null, 'w300') ?? ''}
                        alt={item.title}
                        className="cqa-hotcard__poster"
                      />
                    ) : (
                      <span className="cqa-hotcard__poster cqa-hotcard__poster--empty thumbnail-skeleton-bg" />
                    )}
                    <div className="cqa-hotcard__body">
                      <div className="cqa-hotcard__t">{item.title}</div>
                      <div className="cqa-hotcard__m">
                        {item.year ?? '—'}
                        <span className="cqa-hotcard__star">
                          <Icon icon={Star} size="xs" />
                          {item.voteAverage.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="cqa-hotcard__heat">
                      <span className="n">
                        <Icon icon={Flame} size="xs" />
                        {(item.popularity || 0).toFixed(1)}
                      </span>
                      <span className="l">热度</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
