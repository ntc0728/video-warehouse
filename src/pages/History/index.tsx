/**
 * 观看历史页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、日期分组、多选删除、清除全部
 * 通用左侧竖向时间轴导航（桌面/平板）+ 顶部横向时间轴（移动）
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVideoStore, useUserStore, useIPTVStore, useNavStore } from '@/stores';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton } from '@/components/common';
import { ConfirmDialog } from '@/components/ui';
import { type TimelineItem } from '@/components/ui';
import { Search, X, Trash2, CheckSquare, Square, ListChecks, LayoutGrid, Eye, CheckCircle2 } from 'lucide-react';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { Video } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { HistoryRecord } from '@/types/store';
import type { IPTVPlayRecord } from '@/types';
import './History.css';

const PAGE_SIZE = 30;

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
  _histId: string;
}

interface HistoryChannelItem {
  id: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
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

type Tab = 'video' | 'iptv';
type VideoStatus = 'all' | 'unfinished' | 'finished';

type ConfirmType = 'single' | 'batch' | 'clearAll';

const STATUS_CONFIG: Record<VideoStatus, { label: string; icon: typeof LayoutGrid; color: string }> = {
  all: { label: '全部', icon: LayoutGrid, color: 'var(--color-text-tertiary)' },
  unfinished: { label: '未看完', icon: Eye, color: '#f59e0b' },
  finished: { label: '已看完', icon: CheckCircle2, color: '#22c55e' },
};

export default function HistoryPage() {
  const { videos } = useVideoStore();
  const { history: watchHistory, removeHistory, clearHistory } = useUserStore();
  const { playHistory, channels: iptvChannels, clearPlayHistory, removePlayRecord } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('history');

  const [activeTab, setActiveTab] = useState<Tab>((saved?.tab as Tab) || 'video');
  const [statusFilter, setStatusFilter] = useState<VideoStatus>('all');
  const [searchByTab, setSearchByTab] = useState<{ video: string; iptv: string }>(() => {
    const fromNew = (saved?.filter as { searchByTab?: { video?: string; iptv?: string } } | undefined)?.searchByTab;
    if (fromNew) {
      return { video: fromNew.video || '', iptv: fromNew.iptv || '' };
    }
    return { video: saved?.search || '', iptv: '' };
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeGroupKey, setActiveGroupKey] = useState<GroupKey | null>(null);

  // 确认对话框状态
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>('single');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('history');

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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchByTab.video, searchByTab.iptv, statusFilter]);

  /** 判断历史视频的观看状态 */
  const getVideoWatchStatus = useCallback((videoId: string): VideoStatus => {
    const records = watchHistory.filter(h => h.videoId === videoId);
    if (records.length === 0) return 'unfinished';
    const latest = records.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b);
    if (latest.duration > 0 && latest.progress >= latest.duration * 0.9) return 'finished';
    return 'unfinished';
  }, [watchHistory]);

  const historyVideos = useMemo<HistoryVideoItem[]>(() => {
    let list: HistoryVideoItem[] = [...watchHistory]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((h: HistoryRecord): HistoryVideoItem => {
        const sv = videos.find((v) => v.id === h.videoId);
        const base: Video = sv ?? {
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
        return { ...base, _histTime: h.updatedAt, _histId: h.id };
      });
    if (searchByTab.video.trim()) { const kw = searchByTab.video.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    if (statusFilter !== 'all') {
      list = list.filter((v) => {
        const status = getVideoWatchStatus(v.id);
        return status === statusFilter;
      });
    }
    return list;
  }, [watchHistory, videos, searchByTab.video, statusFilter, getVideoWatchStatus]);

  /** 状态标签的计数（在状态筛选之前） */
  const statusCounts = useMemo(() => {
    let list = [...watchHistory].map(h => ({ id: h.videoId, status: getVideoWatchStatus(h.videoId) }));
    if (searchByTab.video.trim()) {
      const kw = searchByTab.video.toLowerCase();
      list = list.filter((h) => {
        const sv = videos.find(v => v.id === h.id);
        return sv?.title?.toLowerCase().includes(kw);
      });
    }
    const counts: Record<VideoStatus, number> = { all: list.length, unfinished: 0, finished: 0 };
    list.forEach(h => { counts[h.status]++; });
    return counts;
  }, [watchHistory, videos, searchByTab.video, getVideoWatchStatus]);

  const iptvHistory = useMemo<HistoryChannelItem[]>(() => {
    let list: HistoryChannelItem[] = [...playHistory]
      .sort((a, b) => b.playedAt - a.playedAt)
      .map((r: IPTVPlayRecord): HistoryChannelItem => {
        const ch = iptvChannels.find((c) => c.id === r.channelId);
        return {
          id: r.channelId,
          name: ch?.name ?? r.channelName,
          logo: ch?.logo ?? r.channelLogo,
          group: ch?.group ?? r.channelGroup,
          url: ch?.url ?? '',
          _histTime: r.playedAt,
        };
      });
    if (searchByTab.iptv.trim()) { const kw = searchByTab.iptv.toLowerCase(); list = list.filter((c) => c.name?.toLowerCase().includes(kw)); }
    return list;
  }, [playHistory, iptvChannels, searchByTab.iptv]);

  /** 原始数据量（进入页面时获取，不受搜索/状态筛选影响） */
  const rawVideoCount = watchHistory.length;
  const rawIptvCount = playHistory.length;
  const hasRawData = activeTab === 'video' ? rawVideoCount > 0 : rawIptvCount > 0;

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

  const toggleSelect = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === currentList.length ? new Set() : new Set(currentList.map((v) => v.id)));

  // 根据确认类型执行删除
  const executeDelete = useCallback(() => {
    if (confirmType === 'single' && pendingDeleteId) {
      if (activeTab === 'video') removeHistory(pendingDeleteId);
      else removePlayRecord(pendingDeleteId);
    } else if (confirmType === 'batch') {
      if (activeTab === 'video') selected.forEach(id => removeHistory(id));
      else selected.forEach(id => removePlayRecord(id));
      setSelected(new Set());
    } else if (confirmType === 'clearAll') {
      if (activeTab === 'video') clearHistory();
      else clearPlayHistory();
    }
    setPendingDeleteId(null);
  }, [confirmType, pendingDeleteId, selected, activeTab, removeHistory, removePlayRecord, clearHistory, clearPlayHistory]);

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
    <div className={`history-page ${batchMode ? 'batch-mode' : ''}`}>
      <div className="history-header">
        <h1>观看历史 <span className="header-count">共 {activeTab === 'video' ? historyVideos.length : iptvHistory.length} 项</span></h1>
      </div>

      {activeTab === 'video' && (
        <div className="status-tabs">
          {(Object.keys(STATUS_CONFIG) as VideoStatus[]).map((key) => {
            const cfg = STATUS_CONFIG[key];
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                type="button"
                className={`status-tab ${statusFilter === key ? 'status-tab--active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                <Icon size={14} style={{ color: statusFilter === key ? cfg.color : undefined }} />
                <span>{cfg.label}</span>
                <span className="status-tab__count">{statusCounts[key]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="history-toolbar">
        <div className="category-tabs category-tabs-mobile">
          <button className={`category-tab ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>影视 ({historyVideos.length})</button>
          <button className={`category-tab ${activeTab === 'iptv' ? 'active' : ''}`} onClick={() => setActiveTab('iptv')}>IPTV ({iptvHistory.length})</button>
        </div>
        {hasRawData && (
          <div className="search-box-wrap search-box-wrap--iptv" role="search">
            <div className="search-box search-box--iptv">
              <Search size={16} className="search-box__icon" aria-hidden="true" />
              <input
                type="text"
                className="search-box__input"
                placeholder={activeTab === 'video' ? '搜索影视剧...' : '搜索频道...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="搜索"
              />
              <button
                type="button"
                className="search-box__clear"
                onClick={() => setSearch('')}
                aria-label="清空搜索"
                tabIndex={-1}
                aria-hidden={!search}
                data-empty={search ? 'false' : 'true'}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {hasRawData && (
          <div className="toolbar-actions">
            <button
              type="button"
              className={`toolbar-btn ${batchMode ? 'toolbar-btn--active' : ''}`}
              disabled={search.trim() !== '' && currentList.length === 0}
              onClick={() => { setBatchMode(!batchMode); if (batchMode) setSelected(new Set()); }}
            >
              <ListChecks size={14} /> {batchMode ? '退出批量' : '批量操作'}
            </button>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--danger"
              disabled={search.trim() !== '' && currentList.length === 0}
              onClick={handleClearAll}
            >
              <Trash2 size={14} /> 清除全部
            </button>
          </div>
        )}
      </div>

      <div className="history-body">
        <div className="history-content" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }}>
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
                <div
                  className="history-node-col"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTimelineClick(group)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTimelineClick(group); } }}
                  aria-label={`跳转到${group}`}
                >
                  {!isFirst && <span className="history-rail" aria-hidden="true" />}
                  <div className="history-node">
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
                          {selected.has(video.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      )}
                      <button className="record-card__delete" onClick={(e) => handleSingleDelete(video._histId, e)} aria-label="删除"><Trash2 size={14} /></button>
                      <VideoCard video={video} hideFavorite batchMode={batchMode} />
                      <span
                        className="record-card__time"
                        title={formatFullTime(video._histTime)}
                      >
                        {formatPlayTime(video._histTime, group as GroupKey)}
                      </span>
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
                          {selected.has(ch.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      )}
                      <button className="record-card__delete" onClick={(e) => handleSingleDelete(ch.id, e)} aria-label="删除"><Trash2 size={14} /></button>
                      <IPTVChannelCard channel={ch as IPTVChannel} hideFavorite batchMode={batchMode} />
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
      {currentList.length === 0 && (
        <Empty title="暂无观看记录" description="看一部影片，记录从这里开始" />
      )}

      <div ref={sentinelRef} aria-hidden="true" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }} />

      {/* 批量模式胶囊浮动栏 */}
      {batchMode && (
        <div className="batch-action-bar">
          <button type="button" className="batch-action-btn" onClick={selectAll}>
            {selected.size === currentList.length && currentList.length > 0
              ? <CheckSquare size={16} />
              : <Square size={16} />}
            <span>全选</span>
          </button>
          <button
            type="button"
            className="batch-action-btn batch-action-btn--danger"
            disabled={selected.size === 0}
            onClick={handleBatchDelete}
          >
            <Trash2 size={16} /> 删除{selected.size > 0 ? ` (${selected.size})` : ''}
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
    </div>
  );
}
