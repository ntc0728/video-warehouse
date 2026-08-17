/**
 * 观看历史页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、日期分组、多选删除、清除全部
 * 通用左侧竖向时间轴导航（桌面/平板）+ 顶部横向时间轴（移动）
 */
import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserStore, useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton } from '@/components/common';
import { ConfirmDialog } from '@/components/ui';
import { type TimelineItem } from '@/components/ui';
import { Trash2, CheckSquare, Square, LayoutGrid, Eye, CheckCircle2, ListChecks } from 'lucide-react';
import RecordShell from '@/components/RecordShell';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useBackdropLoader } from '@/hooks/useBackdropLoader';
import { useDocumentTitle } from '@/hooks';

import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { getCachedEPGData, buildEPGChannelIndex } from '@/services/epgService';
import type { EPGChannelIndex } from '@/services/epgService';
import type { Video } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { HistoryRecord } from '@/types/store';
import type { IPTVPlayRecord } from '@/types';
import './History.css';
import { Icon } from "@/components/ui/Icon";

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
  _histEpisodeLabel?: string;
  _histSeasonNumber?: number;
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

/** 构建横版封面左上角标签：CMS 源名称 + 集数 */
function getOverlayLabel(video: HistoryVideoItem): string {
  const parts: string[] = [];
  if (video._histCmsSourceName) parts.push(video._histCmsSourceName);
  if (video._histSeasonNumber && video._histEpisodeLabel) {
    parts.push(`第${video._histSeasonNumber}季 ${video._histEpisodeLabel}`);
  } else if (video._histEpisodeLabel) {
    parts.push(video._histEpisodeLabel);
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}

type Tab = 'video' | 'iptv';
type VideoStatus = 'all' | 'unfinished' | 'finished';

type ConfirmType = 'single' | 'batch' | 'clearAll';

const STATUS_CONFIG: Record<VideoStatus, { label: string; icon: typeof LayoutGrid; color: string }> = {
  all: { label: '全部', icon: LayoutGrid, color: 'var(--color-text-tertiary)' },
  unfinished: { label: '未看完', icon: Eye, color: '#d97706' },
  finished: { label: '已看完', icon: CheckCircle2, color: '#22c55e' },
};

export default function HistoryPage() {
  const { history: watchHistory, removeHistoryByVideo, clearHistory } = useUserStore();
  const { playHistory, channels: iptvChannels, clearPlayHistory, removePlayRecord } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('history');

  useDocumentTitle();
  const pageRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>((saved?.tab as Tab) || 'video');
  const [statusFilter, setStatusFilter] = useState<VideoStatus>('all');
  const [searchByTab, setSearchByTab] = useState<{ video: string; iptv: string }>({ video: '', iptv: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeGroupKey, setActiveGroupKey] = useState<GroupKey | null>(null);

  // 确认对话框状态
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>('single');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
  useScrollRestore('history', undefined, location.pathname === '/history');

  // backdrop 自动补全（仅 video tab）
  useBackdropLoader(watchHistory, activeTab === 'video');

  // 离开页面时清空筛选状态
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = location.pathname;
    if (prev === '/history' && location.pathname !== '/history') {
      setActiveTab('video');
      setStatusFilter('all');
      setSearchByTab({ video: '', iptv: '' });
      setBatchMode(false);
      setSelected(new Set());
    }
  }, [location.pathname]);

  const search = searchByTab[activeTab];
  const setSearch = useCallback((v: string) => {
    setSearchByTab((prev) => ({ ...prev, [activeTab]: v }));
  }, [activeTab]);

  const searchByTabRef = useRef(searchByTab);
  searchByTabRef.current = searchByTab;

  useEffect(() => {
    return () => {
      saveState('history', {
        tab: activeTab,
        search: searchByTabRef.current[activeTab] || '',
        filter: { searchByTab: { ...searchByTabRef.current } },
      });
    };
  }, [activeTab, saveState]);

  useEffect(() => { setSelected(new Set()); setBatchMode(false); }, [activeTab]);

  // 注册顶部导航栏搜索回调（仅当前路由匹配时注册，防止 Keep-Alive 下离开页面后重注册）
  useEffect(() => {
    if (location.pathname !== '/history') return;
    const store = usePageSearchStore.getState();
    const placeholder = activeTab === 'video' ? '搜索影视剧...' : '搜索频道...';
    store.setPageSearch(search, setSearch, placeholder);
    return () => { store.clearPageSearch(); };
  }, [search, setSearch, activeTab, location.pathname]);

  // IPTV tab 首次激活时从 IndexedDB 缓存加载频道数据（静默）。
  // [2026-08-13] 守卫：仅当 store 中无频道数据时才触发。原实现每次切到 IPTV tab 都调
  // loadFromCache()——即使数据已在内存，也会重新 setState channels → 联动 IPTV 页
  // （Keep-Alive 常驻，订阅同一 useIPTVStore）在 display:none 下整批重渲染 = 卡顿来源之一。
  useEffect(() => {
    if (activeTab === 'iptv' && useIPTVStore.getState().channels.length === 0) {
      useIPTVStore.getState().loadFromCache();
    }
  }, [activeTab]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchByTab.video, searchByTab.iptv, statusFilter]);

  /** [2026-08-13] 每个 videoId 的最新记录观看状态，一次性构建（O(n)）。
   *  原 getVideoWatchStatus 对每个视频 filter 整个 watchHistory（O(n²)），且
   *  historyVideos / statusCounts 各遍历一遍——历史量大时明显卡顿。改为 Map 预计算。 */
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

  const historyVideos = useMemo<HistoryVideoItem[]>(() => {
    // 按 videoId 去重：同一剧集（不同集）只保留最新一条，避免历史列表重复
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
        return { ...base, _histTime: h.updatedAt, _histBackdrop: h.backdrop, _histProgress: h.progress, _histDuration: h.duration, _histCmsSourceName: h.cmsSourceName, _histEpisodeLabel: h.episodeLabel, _histSeasonNumber: h.seasonNumber };
      });
    if (searchByTab.video.trim()) { const kw = searchByTab.video.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    if (statusFilter !== 'all') {
      list = list.filter((v) => statusMap.get(v.id) === statusFilter);
    }
    return list;
  }, [watchHistory, searchByTab.video, statusFilter, statusMap]);

  /** 状态标签的计数（在状态筛选之前） */
  const statusCounts = useMemo(() => {
    // 按 videoId 去重，与 historyVideos 保持一致；状态直接查 statusMap（O(1)）
    const seenVideo = new Set<string>();
    let list = [...watchHistory]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((h) => {
        if (seenVideo.has(h.videoId)) return false;
        seenVideo.add(h.videoId);
        return true;
      })
      .map(h => ({ id: h.videoId, title: h.title, status: statusMap.get(h.videoId) ?? 'unfinished' }));
    if (searchByTab.video.trim()) {
      const kw = searchByTab.video.toLowerCase();
      list = list.filter((h) => h.title?.toLowerCase().includes(kw));
    }
    const counts: Record<VideoStatus, number> = { all: list.length, unfinished: 0, finished: 0 };
    list.forEach(h => { counts[h.status]++; });
    return counts;
  }, [watchHistory, searchByTab.video, statusMap]);

  const iptvHistory = useMemo<HistoryChannelItem[]>(() => {
    // 按 channelId 去重：同一频道只保留最新一条
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
    if (searchByTab.iptv.trim()) { const kw = searchByTab.iptv.toLowerCase(); list = list.filter((c) => c.name?.toLowerCase().includes(kw)); }
    return list;
  }, [playHistory, iptvChannels, searchByTab.iptv]);

  const currentList: HistoryVideoItem[] | HistoryChannelItem[] = activeTab === 'video' ? historyVideos : iptvHistory;
  const currentListLenRef = useRef(currentList.length);
  currentListLenRef.current = currentList.length;

  const displayedList = useMemo(
    () => (currentList as (HistoryVideoItem | HistoryChannelItem)[]).slice(0, visibleCount),
    [currentList, visibleCount],
  );
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

  /** 算珠定位：bead.y = max(pileY_i, groupTrack_i)
   *  pileY_i  = 第 i 颗珠在堆叠中的槽位（面板顶往下）
   *  groupTrack_i = 分组头相对面板顶的当前位置
   *  珠始终跟随其分组移动，直到越过自身堆叠槽位后被「吸」入堆叠（逐颗累加、
   *  保持间距、无重叠）；向上滚动时 track 重新超过槽位则跟随分组恢复。 */
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
  // Keep-Alive 下离开页面即解绑（后台零开销），回来时随 pathname 变化重新绑定并立即定位。
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

  // 根据确认类型执行删除
  // 视频历史：single/batch 均按 videoId 删除该视频全部记录（电影多线路 / 剧集多季多集），
  // 否则只删单条记录会导致「已删除的视频仍显示在历史页」或批量删除完全失效。
  const executeDelete = useCallback(() => {
    if (confirmType === 'single' && pendingDeleteId) {
      if (activeTab === 'video') removeHistoryByVideo(pendingDeleteId);
      else removePlayRecord(pendingDeleteId);
    } else if (confirmType === 'batch') {
      if (activeTab === 'video') selected.forEach(id => removeHistoryByVideo(id));
      else selected.forEach(id => removePlayRecord(id));
      setSelected(new Set());
    } else if (confirmType === 'clearAll') {
      if (activeTab === 'video') clearHistory();
      else clearPlayHistory();
    }
    setPendingDeleteId(null);
  }, [confirmType, pendingDeleteId, selected, activeTab, removeHistoryByVideo, removePlayRecord, clearHistory, clearPlayHistory]);

  // 打开确认对话框
  const handleSingleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
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


  return (
    <RecordShell
      containerRef={pageRef}
      pageClassName="history-page"
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab)}
      statusTabs={activeTab === 'video'
        ? (Object.keys(STATUS_CONFIG) as VideoStatus[]).map((key) => ({
            key,
            label: STATUS_CONFIG[key].label,
            icon: STATUS_CONFIG[key].icon,
            color: STATUS_CONFIG[key].color,
            count: statusCounts[key],
          }))
        : undefined}
      activeStatus={statusFilter}
      onStatusChange={(key) => setStatusFilter(key as VideoStatus)}
    >
      <div className="record-edit-row">
        <button
          type="button"
          className={`record-edit-btn ${batchMode ? 'record-edit-btn--active' : ''}`}
          onClick={() => { setBatchMode(!batchMode); if (batchMode) setSelected(new Set()); }}
        >
          <Icon icon={ListChecks} size="xs" />
          {batchMode ? '退出管理' : '批量管理'}
        </button>
      </div>
      <div className="history-body">
        {/* key=activeTab：仅「影视↔IPTV」切换时整体重挂载，触发纯淡入；搜索/筛选/排序不重挂载、不误触发动画。
           仅在有数据时挂载容器：数据就绪才渲染 → animate-fade-in 在内容可见时播放（旧实现
           visibility:hidden 会在隐藏期播完动画，IPTV tab 数据异步到达后直接显示无动画） */}
        {currentList.length > 0 ? (
          <div key={activeTab} className="history-content animate-fade-in">
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
              {activeTab === 'video' ? (
                <div className="video-card-grid">
                  {(grouped[group] as HistoryVideoItem[]).map((video) => (
                    <div
                      key={video.id}
                      className={`record-card ${batchMode && selected.has(video.id) ? 'record-card--selected' : ''}`}
                      onClick={batchMode ? () => toggleSelect(video.id) : undefined}
                    >
                      {batchMode && (
                        <button className="record-card__check" onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }} aria-label={selected.has(video.id) ? '取消选择' : '选择'} aria-pressed={selected.has(video.id)}>
                          {selected.has(video.id) ? <Icon icon={CheckSquare} size="sm" /> : <Icon icon={Square} size="sm" />}
                        </button>
                      )}
                      <button className="record-card__delete" onClick={(e) => handleSingleDelete(video.id, e)} aria-label="删除"><Icon icon={Trash2} size="xs" /></button>
                      <VideoCard
                        video={video}
                        hideFavorite
                        batchMode={batchMode}
                        variant="landscape"
                        backdropSrc={video._histBackdrop}
                        timeLabel={formatPlayTime(video._histTime, group as GroupKey)}
                        overlayLabel={getOverlayLabel(video)}
                        progress={video._histProgress}
                        duration={video._histDuration}
                        navigateTo={`/play/${video.id}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="iptv-channel-grid">
                  {(grouped[group] as HistoryChannelItem[]).map((ch) => (
                    <div
                      key={ch.id}
                      className={`record-card ${batchMode && selected.has(ch.id) ? 'record-card--selected' : ''}`}
                      onClick={batchMode ? () => toggleSelect(ch.id) : undefined}
                    >
                      {batchMode && (
                        <button className="record-card__check" onClick={(e) => { e.stopPropagation(); toggleSelect(ch.id); }} aria-label={selected.has(ch.id) ? '取消选择' : '选择'} aria-pressed={selected.has(ch.id)}>
                          {selected.has(ch.id) ? <Icon icon={CheckSquare} size="sm" /> : <Icon icon={Square} size="sm" />}
                        </button>
                      )}
                      <button className="record-card__delete" onClick={(e) => handleSingleDelete(ch.id, e)} aria-label="删除"><Icon icon={Trash2} size="xs" /></button>
                      <IPTVChannelCard channel={ch as IPTVChannel} hideFavorite batchMode={batchMode} epgIndex={epgIndex} />
                      <span
                        className="record-card__time"
                        title={formatFullTime(ch._histTime)}
                      >
                        {formatPlayTime(ch._histTime, group as GroupKey)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
      {batchMode && (
        <div className="batch-action-bar">
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
    </RecordShell>
  );
}
