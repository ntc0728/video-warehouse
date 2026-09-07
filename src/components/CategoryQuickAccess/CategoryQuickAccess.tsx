/**
 * CategoryQuickAccess — 分类入口（2026-09-06 顶栏融合方案，三分支）：
 *  · default export              ≤1280 / app：7 彩色圆卡（现状不变，点击跳 browse）
 *  · CategoryQuickAccessNav      >1280：分类 chips 融合进 StickyHeader（仅首页渲染），
 *    hover chip 打开面板；移出导航/面板延迟收起；页面滚动收起（滚离 hero 后悬停先回顶）。
 *  · CategoryQuickAccessPanel    >1280：mega 面板（HeroBili 卡顶渲染，贴 header 下缘），
 *    hover 期间常驻；热度 Σ 值显示在面板头「今日最热」右侧。
 *  · CategoryHeatRow             >1280：hero 下方常驻「分类热度榜」内容行。
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
import { useIsMobile, useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { useIsWideDesktop } from '@/hooks';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useLocation } from 'react-router-dom';
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

/** Σpopularity 面板头展示：取整（千位级由分类卡/徽标另行缩写） */
function formatHeatSum(v: number | undefined): string {
  if (!v) return '';
  return String(Math.round(v));
}

// ── overlay 开合状态（hover 语义：chips 在 StickyHeader、面板在 HeroBili 卡顶；
//    模块级 store 让两个组件共享开合，跨 Keep-Alive 复进保持）──
interface CategoryOverlayState {
  activeKey: WideCategoryKey | null;
  open: (key: WideCategoryKey) => void;
  close: () => void;
  /** 鼠标移出导航/面板时延迟收起（穿越 nav↔panel 的空隙缓冲） */
  scheduleClose: () => void;
  /** 鼠标进入导航/面板时取消延迟收起 */
  cancelClose: () => void;
}
let closeTimer: ReturnType<typeof setTimeout> | null = null;
export const useCategoryOverlayStore = create<CategoryOverlayState>((set) => ({
  activeKey: null,
  open: (key) => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    set({ activeKey: key });
  },
  close: () => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    set({ activeKey: null });
  },
  scheduleClose: () => {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { closeTimer = null; set({ activeKey: null }); }, 120);
  },
  cancelClose: () => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  },
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
 * >1280 桌面全页面：分类 chips（由 StickyHeader 中央渲染，搜索框左侧）。
 * 首页：hover chip → 打开 hero 卡顶的 mega 面板；移出导航 → 延迟收起；页面滚动 → 立即收起；
 *       滚离 hero 后悬停 chip → 先回顶再展开（回顶滚动期间豁免滚动收起）。
 * 全页面统一行为（2026-09-06 拍板）：hover chip → 开面板；点 chip → 开面板；
 * 「首页」chip → 收起面板；移出导航/面板延迟收起；页面滚动 / Esc / 点击外部 → 收起。
 * 面板由 AppLayout 全局挂载（fixed 于 header 正下方），不依赖首页 hero。
 */
export function CategoryQuickAccessNav() {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const activeKey = useCategoryOverlayStore((s) => s.activeKey);
  const open = useCategoryOverlayStore((s) => s.open);
  const close = useCategoryOverlayStore((s) => s.close);
  const scheduleClose = useCategoryOverlayStore((s) => s.scheduleClose);
  const cancelClose = useCategoryOverlayStore((s) => s.cancelClose);
  const scrollContainerRef = useScrollContainer();

  // 页面滚动 → 面板立即收起（AppLayout 滚动容器，全页面生效）
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => useCategoryOverlayStore.getState().close();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  // Esc / 点击导航与面板以外区域 → 收起（Nav 与 Panel 分处 header/页面层，用 closest 判定内侧）
  useEffect(() => {
    if (!activeKey) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('.cqa-nav, .cqa-overlay')) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [activeKey, close]);

  const handleChipEnter = useCallback((cat: (typeof WIDE_CATEGORIES)[number]) => {
    cancelClose();
    if (cat.key === 'home') { close(); return; }
    open(cat.key);
  }, [cancelClose, close, open]);

  const isChipOn = (key: WideCategoryKey) =>
    key === 'home' ? isHome && activeKey === null : activeKey === key;

  return (
    <nav
      className="cqa-nav"
      aria-label="分类导航"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {WIDE_CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          className={`cqa-nav__item${isChipOn(cat.key) ? ' cqa-nav__item--on' : ''}`}
          aria-expanded={activeKey === cat.key}
          onMouseEnter={() => handleChipEnter(cat)}
          onClick={() => {
            if (cat.key !== 'home') { open(cat.key); return; }
            // 「首页」chip：首页 = 收起面板；其他页 = 回首页
            close();
            if (!isHome) navigate('/');
          }}
        >
          <Icon icon={WIDE_NAV_ICONS[cat.key]} size="md" />
          <span>{cat.label}</span>
        </button>
      ))}
      <button
        className="cqa-nav__item cqa-nav__more"
        onMouseEnter={close}
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
  );
}

/**
 * >1280：mega 面板（AppLayout 全局挂载，fixed 于 header 正下方 = 跨页 mega-menu）。
 * 自门控：仅宽屏桌面（>1280 非 TV）且非移动布局渲染；移动端/TV 恒 null。
 * hover 常驻：进入面板取消延迟收起、移出面板延迟收起（与 Nav 的缓冲互补）。
 */
export function CategoryQuickAccessPanel() {
  const isWideDesktop = useIsWideDesktop();
  const isMobileLayout = useIsMobileLayout();
  const navigate = useCustomNavigate();
  const trending = useTMDBStore((s) => s.trending);
  const heatSum = useMemo(() => {
    const map: Partial<Record<WideCategoryKey, number>> = {};
    for (const b of aggregateCategoryHeat(trending)) map[b.key] = b.heat;
    return map;
  }, [trending]);

  const activeKey = useCategoryOverlayStore((s) => s.activeKey);
  const close = useCategoryOverlayStore((s) => s.close);
  const scheduleClose = useCategoryOverlayStore((s) => s.scheduleClose);
  const cancelClose = useCategoryOverlayStore((s) => s.cancelClose);
  const { activeCat, currentSubs, currentSubId, selectSub, panelItems, panelLoading, panelPage, setPanelPage } =
    useWideCategoryPanel(activeKey);

  // ⚠️ Rules of Hooks：useCallback 必须在所有提前 return 之前——
  // 原写在下方 `if (!activeCat...) return null` 之后，面板关闭→打开的
  // 下一帧会「Rendered more hooks than during the previous render」崩溃。
  const currentSub = currentSubs?.find((s) => s.id === currentSubId) ?? currentSubs?.[0];
  // 末页「查看更多」：携带分类 + 当前子分类 genre 进 browse（面板只在非 home 分类下渲染）
  const goBrowseMore = useCallback(() => {
    if (!activeCat || activeCat.key === 'home') return;
    close();
    navigate(buildBrowseUrl(activeCat.key, currentSub?.genreIds ?? []));
  }, [activeCat, currentSub, close, navigate]);

  if (!isWideDesktop || isMobileLayout) return null;

  // 客户端分页：接口最多 20 条，每页 9（末页可能不满）
  const panelTotal = panelItems?.length ?? 0;
  const panelTotalPages = Math.max(1, Math.ceil(panelTotal / PANEL_PAGE_SIZE));
  const pageItems = panelItems?.slice(
    (panelPage - 1) * PANEL_PAGE_SIZE,
    panelPage * PANEL_PAGE_SIZE,
  ) ?? [];

  if (!activeCat || activeCat.key === 'home') return null;

  return (
    <div
      className="cqa-overlay"
      role="dialog"
      aria-label={`${activeCat.label}面板`}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <div className="cqa-panel__head">
        <Icon icon={WIDE_NAV_ICONS[activeCat.key]} size="sm" />
        <span className="cqa-panel__title">{activeCat.label} · 今日最热</span>
        {heatSum[activeCat.key] ? (
          <span className="cqa-panel__heat">
            <Icon icon={Flame} size="xs" />
            {formatHeatSum(heatSum[activeCat.key])}
          </span>
        ) : null}
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
                <span>加载中…</span>
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
    </div>
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
            <HotCardTitle title={item.title} />
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

/** 卡片标题：溢出检测（ResizeObserver）+ 悬浮跑马灯（--marquee-x = 溢出宽度，非溢出不滚动） */
function HotCardTitle({ title }: { title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overflowX, setOverflowX] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const check = () => setOverflowX(Math.max(0, el.scrollWidth - el.clientWidth));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title]);

  return (
    <div className="cqa-hotcard__t" ref={wrapRef}>
      <span
        className={`cqa-hotcard__t-text${overflowX > 0 ? ' is-overflow' : ''}`}
        style={overflowX > 0 ? { '--marquee-x': `-${overflowX}px` } as React.CSSProperties : undefined}
      >
        {title}
      </span>
    </div>
  );
}

/** 热度榜前 3 分类卡（常驻行）：分类卡 = 榜单入口（v2 起跳 /chart 热度榜页对应分类，沉浸看完整榜单）；条目行 = 跳详情 */
function CategoryHeatCards({ buckets }: { buckets: ReturnType<typeof aggregateCategoryHeat> }) {
  const navigate = useCustomNavigate();
  const navigateDetail = useCallback(
    (id: string) => navigate(`/detail/${id}`),
    [navigate],
  );
  const navigateChart = useCallback(
    (key: CategoryKey) => navigate(`/chart?category=${key}`),
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
            onClick={() => navigateChart(bucket.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigateChart(bucket.key);
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

/** >1280：hero 下方常驻「分类热度榜」内容行（加载即显示；点分类卡进 /chart 对应分类榜单） */
export function CategoryHeatRow() {
  const navigate = useCustomNavigate();
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
        <button
          className="cqa-heat-row__more"
          onClick={() => navigate('/chart')}
          aria-label="查看完整热度榜"
        >
          查看完整榜单
          <Icon icon={ChevronRight} size="xs" />
        </button>
      </div>
      <CategoryHeatCards buckets={heatBuckets} />
    </section>
  );
}
