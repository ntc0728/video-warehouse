/**
 * 观看历史页面（重构）
 * 融合 Tab（综合/视频/IPTV）+「更多筛选」面板（状态 chips + 排序）+ 批量管理
 * 统一横版 RecordCard（视频/IPTV 同尺寸），时间轴分组/算珠联动逻辑保持不变
 */
import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserStore, useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { LayoutGrid, PlayCircle, Tv, Trash2, CheckSquare, Square, ListChecks, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Empty, BackToTopButton } from '@/components/common';
import { ConfirmDialog } from '@/components/ui';
import { type TimelineItem } from '@/components/ui';
import { Icon } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';
import RecordShell, { type RecordStatusTab } from '@/components/RecordShell';
import RecordFilterPanel from '@/components/RecordFilterPanel';
import { RecordCard, type RecordCardItem } from '@/components/RecordCard';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useBackdropLoader } from '@/hooks/useBackdropLoader';
import { useDocumentTitle } from '@/hooks';
import { useCmsSourceGuard } from '@/hooks/useCmsSourceGuard';
import CmsSourceBlockedModal from '@/components/common/CmsSourceBlockedModal';

import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { getCachedEPGData, buildEPGChannelIndex } from '@/services/epgService';
import type { EPGChannelIndex } from '@/services/epgService';
import { resolveChannelLogoCandidates } from '@/services/channelLogo';
import { buildChannelPlayUrl } from '@/services/iptvService';
import type { Video } from '@/types/video';
import type { HistoryRecord } from '@/types/store';
import type { IPTVPlayRecord } from '@/types';
import './History.css';

const PAGE_SIZE = 30;

/** 算珠面板：首珠顶部留白 / 珠间垂直步进（在珠高之上） */
const BEAD_PAD = 8;
const BEAD_GAP = 10;

/** 5 段分组（按时间从新到旧） */
const GROUP_ORDER = [
  '今天',
  '昨天',
  '本周',
  '本月',
  '更早',
] as const;

type GroupKey = (typeof GROUP_ORDER)[number];

interface HistoryVideoItem extends Video {
  _histTime: number;
  _histBackdrop?: string;
  _histProgress?: number;
  _histDuration?: number;
  _histCmsSourceName?: string;
  _histCmsSourceId?: string;
  _histEpisodeLabel?: string;
  _histSeasonNumber?: number;
  _histRating?: number;
}

interface HistoryChannelItem {
  id: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
  sourceId?: string;
  _histTime: number;
}

const DAY_MS = 86400000;

function getDateGroup(ts: number): GroupKey {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = todayStart - ts;

  // 今天
  if (diff < 0) return '今天';

  // 昨天（昨天 00:00 ~ 今天 00:00）
  if (diff < DAY_MS) return '昨天';

  // 本周（周一 00:00 ~ 昨天 00:00）
  const dayOfWeek = now.getDay() || 7; // 周日为 7
  const weekStart = todayStart - (dayOfWeek - 1) * DAY_MS;
  if (ts >= weekStart) return '本周';

  // 本月（1号 00:00 ~ 周一 00:00）
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (ts >= monthStart) return '本月';

  // 更早
  return '更早';
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const shortTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 格式化播放时间：今天→HH:mm, 昨天→昨天 HH:mm, 本周→周X HH:mm, 本月→M月D日, 更早→YYYY年M月D日 */
function formatPlayTime(ts: number, groupKey: GroupKey): string {
  if (groupKey === '今天') return shortTimeFormatter.format(ts);
  if (groupKey === '昨天') return `昨天 ${shortTimeFormatter.format(ts)}`;
  if (groupKey === '本周') {
    const date = new Date(ts);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${weekdays[date.getDay()]} ${shortTimeFormatter.format(ts)}`;
  }
  if (groupKey === '本月') {
    const date = new Date(ts);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  // 更早
  const date = new Date(ts);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullTime(ts: number): string {
  return timeFormatter.format(ts);
}

type MainTab = 'all' | 'video' | 'iptv';
type VideoStatus = 'all' | 'unfinished' | 'finished';
type SortKey = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'rating-desc' | 'rating-asc';

type ConfirmType = 'single' | 'batch' | 'clearAll';

const STATUS_CONFIG: Record<VideoStatus, { label: string }> = {
  all: { label: '全部' },
  unfinished: { label: '未看完' },
  finished: { label: '已看完' },
};

/** 状态 chip 圆点颜色（RecordFilterPanel 用）：全部=黑（默认，不传）、未看完=橙、已看完=绿 */
const STATUS_DOT: Partial<Record<VideoStatus, string>> = {
  unfinished: '#d97706',
  finished: 'var(--color-success)',
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: '最近观看' },
  { value: 'oldest', label: '最早观看' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
  { value: 'rating-desc', label: '评分高到低' },
  { value: 'rating-asc', label: '评分低到高' },
];

/** 融合 Tab 元数据：综合 / 视频 / IPTV（彩色圆点 + 计数） */
const FUSED_TAB_META: { key: MainTab; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'all', label: '综合', icon: LayoutGrid, color: 'var(--color-primary)' },
  { key: 'video', label: '视频', icon: PlayCircle, color: 'var(--color-primary)' },
  { key: 'iptv', label: 'IPTV', icon: Tv, color: '#22c55e' },
];

export default function HistoryPage() {
  const { history: watchHistory, removeHistoryByVideo, clearHistory } = useUserStore();
  const { playHistory, channels: iptvChannels, clearPlayHistory, removePlayRecord, channelAvailability } = useIPTVStore();
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
  const { getState, saveState } = useNavStore();
  const saved = getState('history');
  // CMS 源启用守卫：视频历史点击跳转前校验所选源是否启用，未启用则拦截并弹窗
  const cmsSourceGuard = useCmsSourceGuard();

  useDocumentTitle();
  const pageRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const [mainTab, setMainTab] = useState<MainTab>((saved?.tab as MainTab) || 'all');
  const [statusFilter, setStatusFilter] = useState<VideoStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchByTab, setSearchByTab] = useState<Record<MainTab, string>>({ all: '', video: '', iptv: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [batchIsExiting, setBatchIsExiting] = useState(false);
  const toggleBatchMode = useCallback(() => {
    if (batchMode) {
      setBatchIsExiting(true);
      setTimeout(() => {
        setBatchMode(false);
        setSelected(new Set());
        setBatchIsExiting(false);
      }, 180);
    } else {
      setBatchMode(true);
    }
  }, [batchMode, setSelected]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeGroupKey, setActiveGroupKey] = useState<GroupKey | null>(null);

  // 确认对话框状态
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>('single');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; kind: 'video' | 'iptv' } | null>(null);

  // EPG 频道预索引（零网络读 IndexedDB 缓存）：IPTV 历史卡台标二级回退（EPG XMLTV icon）
  const [epgIndex, setEpgIndex] = useState<EPGChannelIndex | undefined>(undefined);
  useEffect(() => {
    let disposed = false;
    getCachedEPGData()
      .then((data) => {
        if (!disposed && data.channels.length > 0) {
          setEpgIndex(buildEPGChannelIndex(data.channels));
        }
      })
      .catch(() => { /* 无 EPG 缓存时跳过，卡片走字母占位 */ });
    return () => { disposed = true; };
  }, []);

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('history', undefined, true, { restoreFrom: ['play'] });

  // 下拉刷新：从 IndexedDB 重新读取观看历史
  usePullToRefresh(() => useUserStore.getState().reload());

  // backdrop 自动补全（视频卡展示时启用：综合/视频 tab）
  useBackdropLoader(watchHistory, mainTab !== 'iptv');

  const search = searchByTab[mainTab];
  const setSearch = useCallback((v: string) => {
    setSearchByTab((prev) => ({ ...prev, [mainTab]: v }));
  }, [mainTab]);

  const searchByTabRef = useRef(searchByTab);
  searchByTabRef.current = searchByTab;

  useEffect(() => {
    return () => {
      saveState('history', {
        tab: mainTab,
        search: searchByTabRef.current[mainTab] || '',
        filter: { searchByTab: { ...searchByTabRef.current } },
      });
    };
  }, [mainTab, saveState]);

  useEffect(() => { setSelected(new Set()); setBatchMode(false); }, [mainTab]);

  // 注册顶部导航栏搜索回调（仅当前路由匹配时注册，防止 Keep-Alive 下离开页面后重注册）
  useEffect(() => {
    if (location.pathname !== '/history') return;
    const store = usePageSearchStore.getState();
    const placeholder = mainTab === 'video'
      ? '搜索影视剧...'
      : mainTab === 'iptv'
        ? '搜索频道...'
        : '搜索影视或频道...';
    store.setPageSearch(search, setSearch, placeholder);
    return () => { store.clearPageSearch(); };
  }, [search, setSearch, mainTab, location.pathname]);

  // IPTV 数据首次需要时从 IndexedDB 缓存加载频道数据（静默）。
  useEffect(() => {
    if (mainTab !== 'video' && useIPTVStore.getState().channels.length === 0) {
      useIPTVStore.getState().loadFromCache();
    }
  }, [mainTab]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [mainTab, searchByTab.all, searchByTab.video, searchByTab.iptv, statusFilter, sortBy]);

  /** 每个 videoId 的最新记录观看状态，一次性构建（O(n)）。 */
  const statusMap = useMemo(() => {
    const map = new Map<string, VideoStatus>();
    const latestById = new Map<string, HistoryRecord>();
    for (const h of watchHistory) {
      const cur = latestById.get(h.videoId);
      if (!cur || h.updatedAt > cur.updatedAt) latestById.set(h.videoId, h);
    }
    for (const latest of latestById.values()) {
      map.set(
        latest.videoId,
        latest.duration > 0 && latest.progress >= latest.duration * 0.9 ? 'finished' : 'unfinished',
      );
    }
    return map;
  }, [watchHistory]);

  /** 视频历史：按 videoId 去重（同一剧集只保留最新一条），应用搜索 + 状态筛选。
   *  状态筛选仅作用于视频项；IPTV 不涉及观看进度，恒显示。 */
  const historyVideos = useMemo<HistoryVideoItem[]>(() => {
    const seenVideo = new Set<string>();
    let list: HistoryVideoItem[] = [...watchHistory]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((h) => {
        if (seenVideo.has(h.videoId)) return false;
        seenVideo.add(h.videoId);
        return true;
      })
      .map((h: HistoryRecord): HistoryVideoItem => {
        const base: Video = {
          id: h.videoId,
          title: h.title || '未知',
          cover: h.cover || '',
          type: 'movie',
          tags: [],
          actors: [],
          sources: [],
          createdAt: 0,
          updatedAt: 0,
        };
        return { ...base, _histTime: h.updatedAt, _histBackdrop: h.backdrop, _histProgress: h.progress, _histDuration: h.duration, _histCmsSourceName: h.cmsSourceName, _histCmsSourceId: h.cmsSourceId, _histEpisodeLabel: h.episodeLabel, _histSeasonNumber: h.seasonNumber, _histRating: h.rating };
      });
    const kw = searchByTab[mainTab === 'all' ? 'all' : 'video'] || '';
    if (kw.trim()) { const key = kw.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(key)); }
    if (statusFilter !== 'all') {
      list = list.filter((v) => statusMap.get(v.id) === statusFilter);
    }
    return list;
  }, [watchHistory, searchByTab, mainTab, statusFilter, statusMap]);

  /** IPTV 历史：按 channelId 去重（同一频道只保留最新一条），应用搜索。 */
  const iptvHistory = useMemo<HistoryChannelItem[]>(() => {
    const seenChannel = new Set<string>();
    let list: HistoryChannelItem[] = [...playHistory]
      .sort((a, b) => b.playedAt - a.playedAt)
      .filter((r) => {
        if (seenChannel.has(r.channelId)) return false;
        seenChannel.add(r.channelId);
        return true;
      })
      .map((r: IPTVPlayRecord): HistoryChannelItem => {
        const ch = iptvChannels.find((c) => c.id === r.channelId);
        return {
          id: r.channelId,
          name: ch?.name ?? r.channelName,
          logo: ch?.logo ?? r.channelLogo,
          group: ch?.group ?? r.channelGroup,
          url: ch?.url ?? '',
          sourceId: ch?.sourceId,
          _histTime: r.playedAt,
        };
      });
    const kw = searchByTab[mainTab === 'all' ? 'all' : 'iptv'] || '';
    if (kw.trim()) { const key = kw.toLowerCase(); list = list.filter((c) => c.name?.toLowerCase().includes(key)); }
    return list;
  }, [playHistory, iptvChannels, searchByTab, mainTab]);

  /** 融合 Tab 计数：综合 = 视频 + IPTV（均已应用「更多筛选」状态过滤与搜索）；视频/IPTV = 各自项数 */
  const fusedCounts = useMemo(() => ({
    all: historyVideos.length + iptvHistory.length,
    video: historyVideos.length,
    iptv: iptvHistory.length,
  }), [historyVideos, iptvHistory]);

  const fusedCategories = useMemo<{ tabs: RecordStatusTab[]; active: string; onChange: (k: string) => void }>(() => ({
    tabs: FUSED_TAB_META.map((t) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      color: t.color,
      count: fusedCounts[t.key],
    })),
    active: mainTab,
    onChange: (k: string) => setMainTab(k as MainTab),
  }), [fusedCounts, mainTab]);

  /** 视频历史 ID 集合（删除时区分视频/IPTV 记录） */
  const videoIdSet = useMemo(() => new Set(historyVideos.map((v) => v.id)), [historyVideos]);

  /** 当前列表：mainTab 混合视频 + IPTV（按 _histTime），或单类。排序：时间/名称/评分 */
  const currentList = useMemo<(HistoryVideoItem | HistoryChannelItem)[]>(() => {
    const list: (HistoryVideoItem | HistoryChannelItem)[] =
      mainTab === 'video' ? [...historyVideos]
        : mainTab === 'iptv' ? [...iptvHistory]
          : [...historyVideos, ...iptvHistory];
    const titleOf = (item: HistoryVideoItem | HistoryChannelItem) =>
      ('title' in item ? (item as HistoryVideoItem).title : (item as HistoryChannelItem).name) || '';
    const ratingOf = (item: HistoryVideoItem | HistoryChannelItem) =>
      'cover' in item ? ((item as HistoryVideoItem)._histRating ?? 0) : 0;
    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => a._histTime - b._histTime);
        break;
      case 'name-asc':
        list.sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'zh'));
        break;
      case 'name-desc':
        list.sort((a, b) => titleOf(b).localeCompare(titleOf(a), 'zh'));
        break;
      case 'rating-desc':
        list.sort((a, b) => ratingOf(b) - ratingOf(a));
        break;
      case 'rating-asc':
        list.sort((a, b) => ratingOf(a) - ratingOf(b));
        break;
      default:
        list.sort((a, b) => b._histTime - a._histTime);
    }
    return list;
  }, [mainTab, historyVideos, iptvHistory, sortBy]);

  const currentListLenRef = useRef(currentList.length);
  currentListLenRef.current = currentList.length;

  const displayedList = useMemo(() => currentList.slice(0, visibleCount), [currentList, visibleCount]);
  const hasMore = visibleCount < currentList.length;
  const loadMore = useCallback(() => {
    setVisibleCount((v) => Math.min(v + PAGE_SIZE, currentListLenRef.current));
  }, []);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: false,
    onLoadMore: loadMore,
    rootMargin: '100px',
    scrollContainerRef,
  });

  const grouped = useMemo<Record<string, (HistoryVideoItem | HistoryChannelItem)[]>>(() => {
    const g: Record<string, (HistoryVideoItem | HistoryChannelItem)[]> = {};
    displayedList.forEach((item) => {
      const k = getDateGroup(item._histTime);
      if (!g[k]) g[k] = [];
      g[k].push(item);
    });
    return g;
  }, [displayedList]);

  const groupedKeys = useMemo(
    () => GROUP_ORDER.filter((k) => grouped[k] && grouped[k].length > 0),
    [grouped],
  );

  const timelineItems: TimelineItem[] = useMemo(
    () => groupedKeys.map((k) => ({
      key: k,
      label: k,
      count: grouped[k]?.length ?? 0,
      active: activeGroupKey === k,
    })),
    [groupedKeys, grouped, activeGroupKey],
  );

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setGroupRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    if (el) groupRefs.current[key] = el;
    else delete groupRefs.current[key];
  }, []);

  const clickScrollingRef = useRef(false);

  useEffect(() => {
    if (groupedKeys.length === 0) {
      setActiveGroupKey(null);
      return;
    }
    if (!activeGroupKey || !groupedKeys.includes(activeGroupKey)) {
      setActiveGroupKey(groupedKeys[0]);
    }
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (clickScrollingRef.current) return;
        let bestKey: GroupKey | null = null;
        let bestTop = -Infinity;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const top = entry.boundingClientRect.top;
            if (top > bestTop) {
              bestTop = top;
              bestKey = (entry.target as HTMLElement).dataset.groupKey as GroupKey;
            }
          }
        });
        if (bestKey) setActiveGroupKey(bestKey);
      },
      {
        root: container,
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      },
    );

    groupedKeys.forEach((k) => {
      const el = groupRefs.current[k];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [groupedKeys, activeGroupKey, scrollContainerRef]);

  const handleTimelineClick = useCallback((key: string) => {
    const el = groupRefs.current[key];
    if (!el) return;
    clickScrollingRef.current = true;
    setActiveGroupKey(key as GroupKey);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { clickScrollingRef.current = false; }, 500);
  }, []);

  // ── 左侧算珠面板：sticky 常驻 + 算珠随滚动逐颗累加 ─────────────────────────
  const timelineRef = useRef<HTMLDivElement>(null);
  const beadRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const setBeadRef = useCallback((key: string) => (el: HTMLButtonElement | null) => {
    if (el) beadRefs.current[key] = el;
    else delete beadRefs.current[key];
  }, []);

  /** 堆叠步长（珠高 + 间距），分组/数据变化时重新测量 */
  const beadStepRef = useRef(BEAD_PAD);
  const beadRafRef = useRef<number | null>(null);

  const updateBeadPositions = useCallback(() => {
    beadRafRef.current = null;
    const timeline = timelineRef.current;
    if (!timeline) return;
    const panelRect = timeline.getBoundingClientRect();
    if (panelRect.width <= 0) return; // 面板隐藏（移动端）时跳过

    const keys = GROUP_ORDER.filter((k) => groupRefs.current[k] && beadRefs.current[k]);
    // 先批量读分组位置，再写 transform，避免读-写交替触发布局抖动
    const tops: number[] = keys.map((key) => {
      const g = groupRefs.current[key];
      return g ? g.getBoundingClientRect().top : 0;
    });
    const step = beadStepRef.current;
    keys.forEach((key, i) => {
      const bead = beadRefs.current[key];
      if (!bead) return;
      const pileY = BEAD_PAD + i * step;
      const trackY = tops[i] - panelRect.top;
      bead.style.transform = `translateY(${Math.max(pileY, trackY)}px)`;
    });
  }, []);

  const scheduleBeadUpdate = useCallback(() => {
    if (beadRafRef.current != null) return;
    beadRafRef.current = requestAnimationFrame(updateBeadPositions);
  }, [updateBeadPositions]);

  // 重新测量珠高 → 堆叠步长（分组/数据变化后；面板隐藏时跳过测量）
  useLayoutEffect(() => {
    const keys = GROUP_ORDER.filter((k) => beadRefs.current[k]);
    const firstBead = keys.length > 0 ? beadRefs.current[keys[0]] : null;
    if (firstBead) {
      const h = firstBead.getBoundingClientRect().height;
      if (h > 0) beadStepRef.current = h + BEAD_GAP;
    }
  }, [groupedKeys]);

  // 滚动监听 + 尺寸监听：同步首帧定位（无闪烁），滚动时 rAF 节流重算。
  useLayoutEffect(() => {
    if (location.pathname !== '/history') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    updateBeadPositions();

    container.addEventListener('scroll', scheduleBeadUpdate, { passive: true });
    const ro = new ResizeObserver(() => scheduleBeadUpdate());
    if (timelineRef.current) ro.observe(timelineRef.current);
    ro.observe(container);

    return () => {
      container.removeEventListener('scroll', scheduleBeadUpdate);
      ro.disconnect();
      if (beadRafRef.current != null) {
        cancelAnimationFrame(beadRafRef.current);
        beadRafRef.current = null;
      }
    };
  }, [updateBeadPositions, scheduleBeadUpdate, scrollContainerRef, location.pathname, groupedKeys]);

  const toggleSelect = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === currentList.length ? new Set() : new Set(currentList.map((v) => v.id)));

  // ── RecordCard 数据组装 ───────────────────────────────────────────────
  const iptvChannelMap = useMemo(() => new Map(iptvChannels.map((c) => [c.id, c])), [iptvChannels]);

  /** 台标候选链（三级回退）：M3U tvg-logo → EPG icon → 在线台标库 */
  const iptvLogoCandidates = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of iptvHistory) {
      const ch = iptvChannelMap.get(item.id);
      const base = ch ?? { name: item.name, logo: item.logo, tvgId: undefined };
      map.set(item.id, resolveChannelLogoCandidates(base, undefined, undefined, epgIndex));
    }
    return map;
  }, [iptvHistory, iptvChannelMap, epgIndex]);

  const buildIptvNav = useCallback((item: HistoryChannelItem): { to: string; state: Record<string, unknown> } => {
    const ch = iptvChannelMap.get(item.id);
    const playUrl = buildChannelPlayUrl(ch ?? { url: item.url }, proxyUrl, proxyPattern);
    const params = new URLSearchParams({ url: encodeURIComponent(playUrl) });
    params.set('id', item.id);
    params.set('name', item.name);
    return { to: `/iptv/play?${params.toString()}`, state: { from: location.pathname } };
  }, [iptvChannelMap, proxyUrl, proxyPattern, location.pathname]);

  const buildRecordCardItem = useCallback((item: HistoryVideoItem | HistoryChannelItem, group: GroupKey): RecordCardItem => {
    const timeText = formatPlayTime(item._histTime, group);
    const timeTitle = formatFullTime(item._histTime);
    if ('cover' in item) {
      const v = item as HistoryVideoItem;
      const finished = v._histProgress !== undefined && v._histDuration !== undefined && v._histDuration > 0 && v._histProgress >= v._histDuration * 0.9;
      return {
        id: v.id,
        kind: 'video',
        title: v.title || '未知',
        media: v._histBackdrop || v.cover,
        source: v._histCmsSourceName,
        episode: v._histEpisodeLabel ? (v._histSeasonNumber ? `第${v._histSeasonNumber}季 ${v._histEpisodeLabel}` : v._histEpisodeLabel) : undefined,
        status: finished ? 'finished' : 'unfinished',
        timeText,
        timeTitle,
        progress: v._histProgress,
        duration: v._histDuration,
        navigateTo: `/play/${v.id}`,
        onBeforeNavigate: () => cmsSourceGuard.requestNavigate(v._histCmsSourceId, v._histCmsSourceName),
      };
    }
    const ch = item as HistoryChannelItem;
    const candidates = iptvLogoCandidates.get(ch.id) ?? [];
    const nav = buildIptvNav(ch);
    return {
      id: ch.id,
      kind: 'iptv',
      title: ch.name,
      media: candidates[0],
      logoCandidates: candidates.slice(1),
      source: ch.group,
      status: undefined,
      // 后台预检测结果（channelAvailability）：false → RecordCard 红色「无法观看」；
      // undefined（未检测）→ 默认 LIVE。修复：此前漏传导致历史 iptv 卡恒显 LIVE（2026-09-03）
      available: channelAvailability[ch.id],
      timeText,
      timeTitle,
      navigateTo: nav.to,
      navState: nav.state,
    };
  }, [iptvLogoCandidates, buildIptvNav, cmsSourceGuard.requestNavigate, channelAvailability]);

  // 根据确认类型执行删除
  const executeDelete = useCallback(() => {
    if (confirmType === 'single' && pendingDelete) {
      if (pendingDelete.kind === 'video') removeHistoryByVideo(pendingDelete.id);
      else removePlayRecord(pendingDelete.id);
    } else if (confirmType === 'batch') {
      selected.forEach((id) => {
        const isVideo = mainTab === 'video' || (mainTab === 'all' && videoIdSet.has(id));
        if (isVideo) removeHistoryByVideo(id);
        else removePlayRecord(id);
      });
      setSelected(new Set());
    } else if (confirmType === 'clearAll') {
      if (mainTab !== 'iptv') clearHistory();
      if (mainTab !== 'video') clearPlayHistory();
    }
    setPendingDelete(null);
  }, [confirmType, pendingDelete, selected, mainTab, videoIdSet, removeHistoryByVideo, removePlayRecord, clearHistory, clearPlayHistory]);

  // 打开确认对话框
  const handleSingleDelete = useCallback((item: RecordCardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDelete({ id: item.id, kind: item.kind });
    setConfirmType('single');
    setConfirmOpen(true);
  }, []);

  const handleBatchDelete = useCallback(() => {
    setConfirmType('batch');
    setConfirmOpen(true);
  }, []);

  const handleClearAll = useCallback(() => {
    setConfirmType('clearAll');
    setConfirmOpen(true);
  }, []);

  // 确认对话框内容
  const confirmTitle = confirmType === 'single'
    ? '确认删除'
    : confirmType === 'batch'
      ? '批量删除'
      : '清除全部';

  const confirmDescription = confirmType === 'single'
    ? '确定要删除这条记录吗？删除后无法恢复。'
    : confirmType === 'batch'
      ? `确定要删除选中的 ${selected.size} 条记录吗？删除后无法恢复。`
      : '确定要清除所有观看记录吗？此操作无法恢复。';

  // ── 顶部操作按钮组（更多筛选 / 清空历史 / 批量管理） ─────────────────────
  const actions = (
    <>
      <button
        type="button"
        className={`action-btn action-btn--filter${filterOpen ? ' is-active' : ''}`}
        onClick={() => setFilterOpen((v) => !v)}
        aria-expanded={filterOpen}
      >
        <Icon icon={SlidersHorizontal} size="sm" />
        <span className="action-btn__label">更多筛选</span>
      </button>
      <button type="button" className="action-btn action-btn--clear" onClick={handleClearAll}>
        <Icon icon={Trash2} size="sm" />
        <span className="action-btn__label">清空历史</span>
      </button>
      <button
        type="button"
        className={`action-btn action-btn--batch${batchMode ? ' is-active' : ''}`}
        onClick={toggleBatchMode}
      >
        <Icon icon={ListChecks} size="sm" />
        <span className="action-btn__label">{batchMode ? '退出管理' : '批量管理'}</span>
      </button>
    </>
  );

  return (
    <RecordShell
      containerRef={pageRef}
      pageClassName="history-page"
      fusedCategories={fusedCategories}
      actions={actions}
      isBatchMode={batchMode || batchIsExiting}
    >
      {/* 「更多筛选」折叠面板：状态 chips（仅视频）+ 排序（公共组件，收藏页复用） */}
      {filterOpen && (
        <RecordFilterPanel
          statusOptions={(['all', 'unfinished', 'finished'] as VideoStatus[]).map((k) => ({
            key: k,
            label: STATUS_CONFIG[k].label,
            color: STATUS_DOT[k],
          }))}
          statusFilter={statusFilter}
          onStatusChange={(k) => setStatusFilter(k as VideoStatus)}
          sortOptions={SORT_OPTIONS}
          sortBy={sortBy}
          onSortChange={(v) => setSortBy(v as SortKey)}
        />
      )}
      <div className="history-body">
        {/* key=mainTab：仅「综合↔视频↔IPTV」切换时整体重挂载，触发纯淡入；搜索/筛选/排序不重挂载 */}
        {currentList.length > 0 ? (
          <div key={`${mainTab}-${statusFilter}-${sortBy}`} className="history-content animate-fade-in">
            {/* 左侧算珠时间轴（桌面端 sticky 常驻，算珠随滚动逐颗累加；移动端隐藏，保留内联节点） */}
            <div className="history-timeline" ref={timelineRef}>
              <span className="history-timeline__rail" aria-hidden="true" />
              <div className="history-timeline__beads">
                {timelineItems.map((ti) => (
                  <button
                    key={ti.key}
                    type="button"
                    ref={setBeadRef(ti.key)}
                    className={`history-timeline__bead${ti.active ? ' is-active' : ''}`}
                    onClick={() => handleTimelineClick(ti.key)}
                    aria-label={`跳转到${ti.label}`}
                  >
                    <span className="history-timeline__dot" aria-hidden="true" />
                    <span className="history-timeline__label">{ti.label}</span>
                    {ti.count !== undefined && ti.count > 0 && <span className="history-timeline__count">{ti.count}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="history-groups">
              {groupedKeys.map((group, idx) => {
                const ti = timelineItems.find((t) => t.key === group);
                const isFirst = idx === 0;
                const isLast = idx === groupedKeys.length - 1;
                return (
                  <div
                    key={group}
                    ref={setGroupRef(group)}
                    data-group-key={group}
                    className={`history-group${ti?.active ? ' history-group--active' : ''}`}
                  >
                    <div className="history-node-col">
                      {!isFirst && <span className="history-rail" aria-hidden="true" />}
                      <div
                        className="history-node"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleTimelineClick(group)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTimelineClick(group); } }}
                        aria-label={`跳转到${group}`}
                      >
                        <span className="history-dot" aria-hidden="true" />
                        <span className="history-node-label">{group}</span>
                        {ti && (ti.count ?? 0) > 0 && <span className="history-node-count">{ti.count}</span>}
                      </div>
                      {!isLast && <span className="history-rail" aria-hidden="true" />}
                    </div>
                    <div className="history-group-body">
                      <div className="history-grid">
                        {(grouped[group] as (HistoryVideoItem | HistoryChannelItem)[]).map((item) => {
                          const card = buildRecordCardItem(item, group as GroupKey);
                          return (
                            <RecordCard
                              key={card.id}
                              item={card}
                              batchMode={batchMode}
                              selected={selected.has(card.id)}
                              onToggleSelect={() => toggleSelect(card.id)}
                              onDelete={(e) => handleSingleDelete(card, e)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      {currentList.length === 0 && (
        <Empty
          title={statusFilter === 'all' ? '暂无观看记录' : `暂无${STATUS_CONFIG[statusFilter].label}记录`}
          description="看一部影片，记录从这里开始"
        />
      )}

      {currentList.length > 0 && <div ref={sentinelRef} aria-hidden="true" />}

      {/* 批量模式胶囊浮动栏 */}
      {(batchMode || batchIsExiting) && (
        <div className={`batch-action-bar${batchIsExiting ? ' batch-action-bar--exiting' : ''}`}>
          <button type="button" className="batch-action-btn" onClick={selectAll}>
            {selected.size === currentList.length && currentList.length > 0
              ? <Icon icon={CheckSquare} size="sm" />
              : <Icon icon={Square} size="sm" />}
            <span>全选</span>
          </button>
          <button
            type="button"
            className="batch-action-btn batch-action-btn--danger"
            disabled={selected.size === 0}
            onClick={handleBatchDelete}
          >
            <Icon icon={Trash2} size="sm" /> 删除{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button
            type="button"
            className="batch-action-btn batch-action-btn--danger"
            onClick={handleClearAll}
          >
            <Icon icon={Trash2} size="sm" /> 清除全部
          </button>
        </div>
      )}

      <BackToTopButton />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmText="删除"
        variant="danger"
        onConfirm={executeDelete}
      />

      <CmsSourceBlockedModal
        visible={cmsSourceGuard.modalVisible}
        sourceName={cmsSourceGuard.blockedSourceName ?? ''}
        onClose={cmsSourceGuard.closeModal}
      />
    </RecordShell>
  );
}