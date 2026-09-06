/**
 * CategoryQuickAccess — 分类入口（2026-09-06 融合方案甲，三分支）：
 *  · default export        ≤1280 / app：7 彩色圆卡（现状不变，点击跳 browse）
 *  · CategoryQuickAccessWide  >1280：渲染在 HeroBili 卡片内部的「频道导航带」，
 *    点击 chip 在导航带下缘展开 overlay 面板（覆盖 banner、不推挤文档流）。
 *    再点同一 chip / 点击面板与导航以外区域 / Esc 收起。
 *  · CategoryHeatRow       >1280：hero 下方常驻「分类热度榜」内容行（加载即显示，
 *    与 TMDBMovieRow 同层级），点分类卡打开对应 overlay 并回顶。
 * 数据与图标方案：changelogs/design-docs/2026-09-06-category-quick-access-a2-实施方案.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Film,
  Flame,
  Home as HomeIcon,
  Info,
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
import { create } from 'zustand';
import { Icon } from '@/components/ui/Icon';
import { TvMascot } from '@/components/ui/TvMascot/TvMascot';
import LazyImage from '@/components/LazyImage/LazyImage';
import { buildImageUrl } from '@/services/tmdbService';
import { useTMDBStore } from '@/stores/useTMDBStore';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useCustomNavigate } from '@/lib/navigation';
import { buildBrowseUrl } from '@/pages/Browse/urlState';
import {
  WIDE_CATEGORIES,
  aggregateCategoryHeat,
  fetchCategoryPanel,
  getGenreSubcategories,
  type WideCategoryKey,
  type WideSubCategory,
} from './categoryPanelData';
import './CategoryQuickAccess.css';

/** 面板每页条数（3 列 × 3 行，overlay 高度锁定不变） */
const PANEL_PAGE_SIZE = 9;

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

/** Σpopularity 徽标缩写：≥1000 以 k 为单位（1 位小数，去尾 .0），否则取整 */
function formatHeatSum(v: number | undefined): string {
  if (!v) return '';
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

// ── overlay 开合状态（热度榜常驻行与导航带共享；模块级，跨 Keep-Alive 复进保持）──
interface CategoryOverlayState {
  activeKey: WideCategoryKey | null;
  toggle: (key: WideCategoryKey) => void;
  close: () => void;
}
export const useCategoryOverlayStore = create<CategoryOverlayState>((set, get) => ({
  activeKey: null,
  toggle: (key) => set({ activeKey: get().activeKey === key ? null : key }),
  close: () => set({ activeKey: null }),
}));

interface CategoryQuickAccessProps {
  onCategorySelect: (category: CategoryKey) => void;
}

/** 口径说明 tooltip（Info 图标悬停/聚焦显示；内容经 Portal 渲染且 pointer-events:none，
 *  不拦截 mousedown → 不会触发 overlay 的「点击外部收起」） */
function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button type="button" className="cqa-info-tip" aria-label={label}>
            <Icon icon={Info} size="xs" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="cqa-info-tip__content" sideOffset={6} collisionPadding={8}>
            {text}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** ≤1280 / app：7 彩色圆卡（现状不变） */
export default function CategoryQuickAccess({ onCategorySelect }: CategoryQuickAccessProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();

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

/** 宽屏面板通用数据钩子：子分类 + 面板内容（缓存命中零请求；AbortController 防连点竞态） */
function useWideCategoryPanel(activeKey: WideCategoryKey | null) {
  const activeCat = useMemo(
    () => WIDE_CATEGORIES.find((c) => c.key === activeKey) ?? null,
    [activeKey],
  );
  const [subSel, setSubSel] = useState<Record<string, string | number>>({});
  const [genreSubs, setGenreSubs] = useState<Partial<Record<'movie' | 'tv', WideSubCategory[]>>>({});
  const [panelItems, setPanelItems] = useState<TMDBVideoItem[] | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelPage, setPanelPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const currentSubs: WideSubCategory[] | null = useMemo(() => {
    const type = activeCat?.genreListType;
    return activeCat?.subgenres ?? (type ? genreSubs[type] : undefined) ?? null;
  }, [activeCat, genreSubs]);
  const currentSubId = subSel[activeCat?.key ?? ''] ?? currentSubs?.[0]?.id ?? 0;

  // 电影/剧集：懒加载全量 genre 子分类
  useEffect(() => {
    const type = activeCat?.genreListType;
    if (!type || genreSubs[type]) return;
    let cancelled = false;
    getGenreSubcategories(type)
      .then((list) => { if (!cancelled) setGenreSubs((prev) => ({ ...prev, [type]: list })); })
      .catch(() => { /* 子分类加载失败保持空 chips */ });
    return () => { cancelled = true; };
  }, [activeCat, genreSubs]);

  // 面板数据：切换分类/子分类即取。
  // 切子分类保留旧网格（降沉 + 更新中徽标，视觉连续）；切分类清空走首载文案（避免闪现上一分类内容）。
  const prevCatKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeCat || activeCat.key === 'home' || !currentSubs) return;
    const sub = currentSubs.find((s) => s.id === currentSubId) ?? currentSubs[0];
    if (!sub) return;
    const catChanged = prevCatKeyRef.current !== activeCat.key;
    prevCatKeyRef.current = activeCat.key;
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    if (catChanged) setPanelItems(null);
    setPanelPage(1);
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
  }, [activeCat, currentSubs, currentSubId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectSub = useCallback((key: string, id: string | number) => {
    setSubSel((prev) => ({ ...prev, [key]: id }));
  }, []);

  return { activeCat, currentSubs, currentSubId, selectSub, panelItems, panelLoading, panelPage, setPanelPage };
}

/**
 * >1280：频道导航带（HeroBili 卡内首行）+ overlay 面板。
 * 本组件由 HeroBili 渲染；overlay 绝对定位于 hero 卡内、覆盖 banner 顶部。
 */
export function CategoryQuickAccessWide() {
  const navigate = useCustomNavigate();
  const trending = useTMDBStore((s) => s.trending);
  const heatBuckets = useMemo(() => aggregateCategoryHeat(trending), [trending]);
  const heatSum = useMemo(() => {
    const map: Partial<Record<WideCategoryKey, number>> = {};
    for (const b of heatBuckets) map[b.key] = b.heat;
    return map;
  }, [heatBuckets]);

  const activeKey = useCategoryOverlayStore((s) => s.activeKey);
  const toggle = useCategoryOverlayStore((s) => s.toggle);
  const close = useCategoryOverlayStore((s) => s.close);
  const { activeCat, currentSubs, currentSubId, selectSub, panelItems, panelLoading, panelPage, setPanelPage } =
    useWideCategoryPanel(activeKey);

  // 客户端分页：接口最多 20 条，每页 9（末页可能不满）
  const panelTotal = panelItems?.length ?? 0;
  const panelTotalPages = Math.max(1, Math.ceil(panelTotal / PANEL_PAGE_SIZE));
  const pageItems = panelItems?.slice(
    (panelPage - 1) * PANEL_PAGE_SIZE,
    panelPage * PANEL_PAGE_SIZE,
  ) ?? [];
  const currentSub = currentSubs?.find((s) => s.id === currentSubId) ?? currentSubs?.[0];

  // 末页「查看更多」：携带分类 + 当前子分类 genre 进 browse（面板只在非 home 分类下渲染）
  const goBrowseMore = useCallback(() => {
    if (!activeCat || activeCat.key === 'home') return;
    close();
    navigate(buildBrowseUrl(activeCat.key, currentSub?.genreIds ?? []));
  }, [activeCat, currentSub, close, navigate]);

  const navRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 点击导航/面板以外区域或 Esc → 收起
  useEffect(() => {
    if (!activeKey) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeKey, close]);

  return (
    <>
      <nav ref={navRef} className="cqa-nav" aria-label="分类导航">
        {WIDE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`cqa-nav__item${(cat.key === 'home' ? activeKey === null : activeKey === cat.key) ? ' cqa-nav__item--on' : ''}`}
            aria-expanded={activeKey === cat.key}
            onClick={() => (cat.key === 'home' ? close() : toggle(cat.key))}
          >
            <Icon icon={WIDE_NAV_ICONS[cat.key]} size="md" />
            <span>{cat.label}</span>
            {heatSum[cat.key] ? (
              <span className="cqa-nav__heat">
                <Icon icon={Flame} size="xs" />
                {formatHeatSum(heatSum[cat.key])}
              </span>
            ) : null}
          </button>
        ))}
        <button
          className="cqa-nav__item cqa-nav__more"
          onClick={() => {
            close();
            navigate(buildBrowseUrl('all'), { state: { fromCategory: true } });
          }}
        >
          <Icon icon={LayoutGrid} size="md" />
          <span>全部分类</span>
          <Icon icon={ChevronRight} size="xs" />
        </button>
      </nav>

      {activeCat && activeCat.key !== 'home' && (
        <div ref={panelRef} className="cqa-overlay" role="dialog" aria-label={`${activeCat.label}面板`}>
          <>
            <div className="cqa-panel__head">
              <Icon icon={WIDE_NAV_ICONS[activeCat.key]} size="sm" />
              <span className="cqa-panel__title">{activeCat.label} · 今日最热</span>
              <span className="cqa-panel__sub">按热度排序 · 点卡片看详情</span>
              <InfoTip label="热度口径说明" text="热度基于 TMDB 每日趋势数据（/trending/day 的 popularity 值）聚合，定期更新，非实时数值。" />
            </div>
            <div className="cqa-subgenres">
              {currentSubs
                ? currentSubs.map((s) => (
                    <button
                      key={s.id}
                      className={`cqa-subgenres__chip${currentSubId === s.id ? ' cqa-subgenres__chip--on' : ''}`}
                      onClick={() => selectSub(activeCat.key, s.id)}
                    >
                      {s.label}
                    </button>
                  ))
                : <span className="cqa-subgenres__loading">正在加载子分类…</span>}
            </div>
            {panelItems === null && panelLoading ? (
              <div className="cqa-panel__loading">
                <TvMascot blink size={44} />
                <span>正在获取 {activeCat.label} 数据…</span>
              </div>
            ) : (
              <>
                <div className={`cqa-panel__grid${panelLoading ? ' cqa-panel__grid--refreshing' : ''}`}>
                  <CategoryHotGrid items={pageItems} rankOffset={(panelPage - 1) * PANEL_PAGE_SIZE} />
                  {panelLoading && (
                    <div className="cqa-panel__refresh" role="status">
                      <TvMascot className="is-shaking" blink size={30} />
                      <span>更新中…</span>
                    </div>
                  )}
                </div>
                {panelTotal > 0 && (
                  <div className="cqa-panel__pager">
                    <button
                      type="button"
                      className="cqa-panel__pager__btn"
                      disabled={panelPage <= 1}
                      aria-label="上一页"
                      onClick={() => setPanelPage((p) => Math.max(1, p - 1))}
                    >
                      <Icon icon={ChevronLeft} size="xs" />
                      上一页
                    </button>
                    <span className="cqa-panel__pager__ind">{panelPage} / {panelTotalPages}</span>
                    {panelPage < panelTotalPages ? (
                      <button
                        type="button"
                        className="cqa-panel__pager__btn"
                        aria-label="下一页"
                        onClick={() => setPanelPage((p) => Math.min(panelTotalPages, p + 1))}
                      >
                        下一页
                        <Icon icon={ChevronRight} size="xs" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cqa-panel__pager__btn cqa-panel__pager__btn--more"
                        onClick={goBrowseMore}
                      >
                        查看更多
                        <Icon icon={ChevronRight} size="xs" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        </div>
      )}
    </>
  );
}

/** 面板 3×3 内容卡（rankOffset：分页时排名跨页续号） */
function CategoryHotGrid({ items, rankOffset = 0 }: { items: TMDBVideoItem[]; rankOffset?: number }) {
  const navigate = useCustomNavigate();
  const navigateDetail = useCallback(
    (id: string) => navigate(`/detail/${id}`),
    [navigate],
  );
  return (
    <div className="cqa-hotgrid">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="cqa-hotcard"
          role="link"
          tabIndex={0}
          onClick={() => navigateDetail(item.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateDetail(item.id); }}
        >
          <span className="cqa-hotcard__rank">{i + 1 + rankOffset}</span>
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
  );
}

/** 热度榜前 3 分类卡（常驻行）：分类卡 = 分类入口（跳 browse，与圆卡/全部分类同语义）；条目行 = 跳详情 */
function CategoryHeatCards({ buckets }: { buckets: ReturnType<typeof aggregateCategoryHeat> }) {
  const navigate = useCustomNavigate();
  const navigateDetail = useCallback(
    (id: string) => navigate(`/detail/${id}`),
    [navigate],
  );
  const top3 = buckets.slice(0, 3);
  const maxHeat = top3[0]?.heat ?? 1;
  return (
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
            onClick={() => navigate(buildBrowseUrl(bucket.key))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(buildBrowseUrl(bucket.key));
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
  );
}

/** >1280：hero 下方常驻「分类热度榜」内容行（加载即显示；点分类卡跳 browse 对应分类） */
export function CategoryHeatRow() {
  const trending = useTMDBStore((s) => s.trending);
  const heatBuckets = useMemo(() => aggregateCategoryHeat(trending), [trending]);
  if (heatBuckets.length === 0) return null;
  return (
    <section className="cqa-heat-row">
      <div className="cqa-heat-row__head">
        <Icon icon={Flame} size="sm" />
        <span className="cqa-heat-row__title">分类热度榜</span>
        <span className="cqa-heat-row__sub">今日各分类最热 · 点分类卡进入</span>
        <InfoTip
          label="分类热度口径说明"
          text="分类热度 = 该分类下今日 TMDB 趋势条目的 popularity 之和（多分类命中重复计入），基于每日趋势数据聚合，定期更新。"
        />
      </div>
      <CategoryHeatCards buckets={heatBuckets} />
    </section>
  );
}
