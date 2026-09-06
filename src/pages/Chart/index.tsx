/**
 * Chart — 热度榜页（2026-09-06 v2，设计 demo：changelogs/demos/demo-chart-page-2026-09-06.html）
 *
 * 路由 /chart?category=movie|tv|variety|anime|documentary|trend（&window=day|week 限趋势榜）。
 * 定位与分工：/chart = 沉浸式看完整榜单（排名 + 热度 + 无缝滚动加载全部）；
 * browse = 筛选探索页；首页 overlay 面板 = hero 内快速预览（20 条客户端分页）。
 *
 * 数据口径（用户拍板延续）：
 *   · 榜单统一 discover 口径（sort_by=popularity.desc + page 翻页）——trending 为趋势序
 *     不可控且综艺/动漫/纪录片无 trending 端点，仅「趋势榜」tab 用 trending（标注趋势序）；
 *   · discover 分页拉取间 popularity 漂移会产生边界乱序/重复（demo 实测抓到跨页重复），
 *     故每次追加后「按 id 去重 + 按 popularity 降序重排」（趋势榜只去重、保留趋势序）；
 *   · 封面失败兜底 = LazyImage 默认 fallbackVariant 'image'（MonitorPlay + kinoTV 品牌字），
 *     与全站卡片一致，页面不自写图片失败逻辑。
 *
 * 入口：首页「分类热度榜」三张分类卡 + 行标题「查看完整榜单」；面板「查看更多」仍跳 browse。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Camera,
  Film,
  Flame,
  Info,
  Mic2,
  Sparkles,
  Star,
  TrendingUp,
  Tv,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TMDBVideoItem } from '@/types/tmdb';
import { AppLoading } from '@/components/common';
import { Icon } from '@/components/ui/Icon';
import LazyImage from '@/components/LazyImage/LazyImage';
import { buildImageUrl, discoverCategory, fetchTrending } from '@/services/tmdbService';
import { mapMovieToVideoItem, mapTVToVideoItem, mapTrendingToVideoItem } from '@/stores/useTMDBStore';
import { useCustomNavigate } from '@/lib/navigation';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDocumentTitle } from '@/hooks';
import './Chart.css';

type ChartCategoryKey = 'movie' | 'tv' | 'variety' | 'anime' | 'documentary' | 'trend';
type TrendWindow = 'day' | 'week';

interface ChartTabDef {
  key: ChartCategoryKey;
  label: string;
  icon: LucideIcon;
  /** discover 分类（trend 为 undefined） */
  mediaType?: 'movie' | 'tv';
  genreIds?: number[];
}

const CHART_TABS: ChartTabDef[] = [
  { key: 'movie', label: '电影', icon: Film, mediaType: 'movie', genreIds: [] },
  { key: 'tv', label: '剧集', icon: Tv, mediaType: 'tv', genreIds: [] },
  { key: 'variety', label: '综艺', icon: Mic2, mediaType: 'tv', genreIds: [10764] },
  { key: 'anime', label: '动漫', icon: Sparkles, mediaType: 'tv', genreIds: [16] },
  { key: 'documentary', label: '纪录片', icon: Camera, mediaType: 'movie', genreIds: [99] },
  { key: 'trend', label: '趋势榜', icon: TrendingUp },
];

const TREND_WINDOWS: { key: TrendWindow; label: string }[] = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
];

function isChartCategoryKey(v: string | null): v is ChartCategoryKey {
  return CHART_TABS.some((t) => t.key === v);
}

// ── feed 缓存（模块级）：Keep-Alive 复进/跨页返回保留已加载数据与翻页进度 ──
interface ChartFeed {
  items: TMDBVideoItem[];
  /** 已加载到的页码（下一页 = page + 1） */
  page: number;
  exhausted: boolean;
}
const feedCache = new Map<string, ChartFeed>();
const feedKey = (tab: ChartCategoryKey, window: TrendWindow) =>
  tab === 'trend' ? `trend:${window}` : tab;

/** 追加一页：按 id 去重；discover 口径按 popularity 降序重排（修正分页漂移乱序），趋势榜保留趋势序 */
function mergePage(prev: TMDBVideoItem[], incoming: TMDBVideoItem[], tab: ChartCategoryKey): TMDBVideoItem[] {
  const seen = new Set(prev.map((it) => it.id));
  const merged = [...prev, ...incoming.filter((it) => !seen.has(it.id))];
  if (tab === 'trend') return merged;
  return merged.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}

async function fetchChartPage(
  tab: ChartTabDef,
  window: TrendWindow,
  page: number,
  signal?: AbortSignal,
): Promise<TMDBVideoItem[]> {
  if (tab.key === 'trend') {
    const resp = await fetchTrending('all', window, { signal, page });
    return resp.results.map(mapTrendingToVideoItem);
  }
  const resp = await discoverCategory(tab.mediaType!, tab.genreIds!, { signal }, page);
  return resp.results.map((r) =>
    tab.mediaType === 'movie' ? mapMovieToVideoItem(r as never) : mapTVToVideoItem(r as never),
  );
}

/** 口径说明 tooltip（与 CategoryQuickAccess InfoTip 同款：radix Tooltip + Portal + pointer-events:none） */
function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className="chart-info-tip" aria-label={label}>
          <Icon icon={Info} size="xs" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="chart-info-tip__content" sideOffset={6} collisionPadding={8}>
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export default function ChartPage() {
  useDocumentTitle('热度榜');
  const navigate = useCustomNavigate();
  const location = useLocation();
  const scrollContainer = useScrollContainer();

  // URL 驱动 tab：/chart?category=variety&window=week（可分享、可回退）
  const params = new URLSearchParams(location.search);
  const categoryParam = params.get('category');
  const activeTab: ChartCategoryKey = isChartCategoryKey(categoryParam) ? categoryParam : 'movie';
  const trendWindow: TrendWindow = params.get('window') === 'week' ? 'week' : 'day';

  const tabDef = useMemo(
    () => CHART_TABS.find((t) => t.key === activeTab) ?? CHART_TABS[0],
    [activeTab],
  );

  const [feed, setFeed] = useState<ChartFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 切 tab/时间窗：优先命中缓存（零请求即显），否则拉第 1 页
  const loadFeed = useCallback(
    (tabKey: ChartCategoryKey, window: TrendWindow, reset: boolean) => {
      const key = feedKey(tabKey, window);
      const cached = feedCache.get(key);
      if (cached && !reset) {
        setFeed(cached);
        setError(null);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const tab = CHART_TABS.find((t) => t.key === tabKey)!;
      setLoading(true);
      setError(null);
      fetchChartPage(tab, window, 1, ctrl.signal)
        .then((items) => {
          if (ctrl.signal.aborted) return;
          const next: ChartFeed = {
            items,
            page: 1,
            // 单页不足 20 条 = 接口已到底（真实接口末页可能 < 20）
            exhausted: items.length < 20,
          };
          feedCache.set(key, next);
          setFeed(next);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setError('榜单数据加载失败，请检查网络后重试');
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    loadFeed(activeTab, trendWindow, false);
    return () => abortRef.current?.abort();
  }, [activeTab, trendWindow, loadFeed]);

  // 无缝滚动加载下一页：去重后 0 新增视为到底（mock/漂移场景防死循环）
  const loadMore = useCallback(() => {
    if (loading || !feed || feed.exhausted || error) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const nextPage = feed.page + 1;
    setLoading(true);
    fetchChartPage(tabDef, trendWindow, nextPage, ctrl.signal)
      .then((incoming) => {
        if (ctrl.signal.aborted) return;
        setFeed((prev) => {
          if (!prev) return prev;
          const seen = new Set(prev.items.map((it) => it.id));
          const uniqueNew = incoming.filter((it) => !seen.has(it.id)).length;
          const items = mergePage(prev.items, incoming, tabDef.key);
          const next: ChartFeed = {
            items,
            page: nextPage,
            // 去重后 0 新增 = 无新数据（mock 恒返同页 / 接口分页漂移重复），防死循环
            exhausted: incoming.length < 20 || uniqueNew === 0,
          };
          feedCache.set(feedKey(tabDef.key, trendWindow), next);
          return next;
        });
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setError('加载更多失败，请重试');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [loading, feed, error, tabDef, trendWindow]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: !!feed && !feed.exhausted,
    isLoading: loading,
    onLoadMore: loadMore,
    scrollContainerRef: scrollContainer,
    rootMargin: '300px',
  });

  const switchTab = useCallback(
    (key: ChartCategoryKey) => {
      if (key === activeTab) return;
      navigate(key === 'trend' ? `/chart?category=trend&window=${trendWindow}` : `/chart?category=${key}`);
    },
    [activeTab, navigate, trendWindow],
  );

  const switchWindow = useCallback(
    (w: TrendWindow) => {
      if (w === trendWindow) return;
      navigate(`/chart?category=trend&window=${w}`);
    },
    [navigate, trendWindow],
  );

  const retry = useCallback(() => {
    feedCache.delete(feedKey(activeTab, trendWindow));
    loadFeed(activeTab, trendWindow, true);
  }, [activeTab, trendWindow, loadFeed]);

  const items = feed?.items ?? [];
  const showInitialLoading = loading && items.length === 0 && !error;
  const isTrend = activeTab === 'trend';

  return (
    <div className="page-padding chart-page">
      <section className="chart-card">
        <div className="chart-head">
          <h1 className="chart-head__title">热度榜</h1>
          <InfoTip
            label="热度口径说明"
            text={
              isTrend
                ? '趋势榜为 TMDB 趋势算法排序（/trending/all），非热度值排序；数据定期更新，非实时。'
                : '热度值 = TMDB popularity 原始值（discover 按热度降序，可翻页加载）。数据定期更新，非实时。'
            }
          />
          <span className="chart-head__sub">
            {isTrend ? 'TMDB 趋势算法排序 · 持续下滑加载更多' : '按热度排序 · 持续下滑加载更多'}
          </span>
        </div>

        <nav className="chart-tabs" aria-label="榜单分类">
          {CHART_TABS.map((t) => (
            <button
              key={t.key}
              className={`chart-tabs__tab${activeTab === t.key ? ' chart-tabs__tab--on' : ''}`}
              aria-current={activeTab === t.key ? 'page' : undefined}
              onClick={() => switchTab(t.key)}
            >
              <Icon icon={t.icon} size="xs" />
              <span>{t.label}</span>
            </button>
          ))}
          {isTrend && (
            <span className="chart-tabs__window" role="group" aria-label="趋势时间窗">
              {TREND_WINDOWS.map((w) => (
                <button
                  key={w.key}
                  className={trendWindow === w.key ? 'chart-tabs__window-btn--on' : 'chart-tabs__window-btn'}
                  onClick={() => switchWindow(w.key)}
                >
                  {w.label}
                </button>
              ))}
            </span>
          )}
        </nav>

        {showInitialLoading ? (
          <div className="chart-loading"><AppLoading /></div>
        ) : error && items.length === 0 ? (
          <div className="chart-error">
            <p>{error}</p>
            <button className="chart-error__retry" onClick={retry}>重试</button>
          </div>
        ) : (
          <div className="chart-list" role="list">
            {items.map((item, i) => (
              <ChartRow key={item.id} item={item} rank={i + 1} showBadge={isTrend} />
            ))}
            {loading && items.length > 0 && (
              <div className="chart-list__skeleton" aria-hidden="true">
                <i className="a" /><i className="b" /><i className="c" /><i className="d" />
              </div>
            )}
            {feed?.exhausted && (
              <div className="chart-list__end">已加载全部 {items.length} 条</div>
            )}
            <div ref={sentinelRef} aria-hidden="true" className="chart-sentinel" />
          </div>
        )}
      </section>
    </div>
  );
}

/** 榜单行：排名（top3 暖橙强调）+ 横版封面 + 标题/年份/类型徽标 + 热度值/评分 */
function ChartRow({ item, rank, showBadge }: { item: TMDBVideoItem; rank: number; showBadge: boolean }) {
  const navigate = useCustomNavigate();
  const openDetail = useCallback(() => navigate(`/detail/${item.id}`), [navigate, item.id]);
  const top = rank <= 3;
  return (
    <div
      className={`chart-row${top ? ' chart-row--top' : ''}`}
      role="link"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDetail(); }}
    >
      <span className="chart-row__rank">{rank}</span>
      <LazyImage
        src={buildImageUrl(item.backdropPath ?? null, 'w300') ?? ''}
        alt={item.title}
        className="chart-row__cover"
      />
      <div className="chart-row__body">
        <div className="chart-row__t">{item.title}</div>
        <div className="chart-row__m">
          {showBadge && <span className="chart-row__badge">{item.type === 'movie' ? '电影' : '剧集'}</span>}
          <span>{item.year ?? '—'}</span>
        </div>
        {item.description && <div className="chart-row__desc">{item.description}</div>}
      </div>
      <div className="chart-row__heat">
        <span className="n"><Icon icon={Flame} size="xs" />{(item.popularity || 0).toFixed(1)}</span>
        <span className="l">热度值</span>
        <span className="v"><Icon icon={Star} size="xs" />{(item.voteAverage || 0).toFixed(1)}</span>
      </div>
    </div>
  );
}
