/**
 * 观看历史页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、日期分组、多选删除、清除全部
 * 通用左侧竖向时间轴导航（桌面/平板）+ 顶部横向时间轴（移动）
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVideoStore, useUserStore, useIPTVStore, useNavStore } from '@/stores';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton } from '@/components/common';
import { Timeline, type TimelineItem } from '@/components/ui';
import { Search, X, Trash2, CheckSquare, Square, ListChecks } from 'lucide-react';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { Video } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { HistoryRecord } from '@/types/store';
import type { IPTVPlayRecord } from '@/stores/useIPTVStore';
import './History.css';

const PAGE_SIZE = 30;

/** 9 段分组（按时间从新到旧） */
const GROUP_ORDER = [
  '今天',
  '昨天',
  '近一周',
  '一周前',
  '三周前',
  '一月前',
  '三月前',
  '半年前',
  '一年前',
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
  if (diff < 0) return '今天';
  if (diff < DAY_MS) return '昨天';
  if (diff < 7 * DAY_MS) return '近一周';
  if (diff < 14 * DAY_MS) return '一周前';
  if (diff < 30 * DAY_MS) return '三周前';
  if (diff < 60 * DAY_MS) return '一月前';
  if (diff < 180 * DAY_MS) return '三月前';
  if (diff < 365 * DAY_MS) return '半年前';
  return '一年前';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 格式化播放时间：今天→HH:mm, 昨天/近一周→MM-DD HH:mm, 其余→YYYY-MM-DD */
function formatPlayTime(ts: number, groupKey: GroupKey): string {
  const d = new Date(ts);
  const HH = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  if (groupKey === '今天') return `${HH}:${mm}`;
  if (groupKey === '昨天' || groupKey === '近一周') {
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${HH}:${mm}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatFullTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

type Tab = 'video' | 'iptv';

export default function HistoryPage() {
  const { videos } = useVideoStore();
  const { history: watchHistory, removeHistory, clearHistory } = useUserStore();
  const { playHistory, channels: iptvChannels, clearPlayHistory, removePlayRecord } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('history');
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<Tab>((saved?.tab as Tab) || 'video');
  // 搜索词按 tab 隔离（视频/iptv 各自独立，互不串扰）
  // 持久化到 filter.searchByTab（兼容旧持久化键：把 saved.search 作为 video tab 的初始值）
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

  // 切 tab 时重置 selected（id 域不同）+ 退出批量模式
  useEffect(() => { setSelected(new Set()); setBatchMode(false); }, [activeTab]);

  // 切 tab / 搜索变化时,重置 visibleCount 到首屏
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchByTab.video, searchByTab.iptv]);

  // ── 影视历史（仅受影视 tab 搜索词影响） ─────────────
  const historyVideos = useMemo<HistoryVideoItem[]>(() => {
    let list: HistoryVideoItem[] = [...watchHistory]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((h: HistoryRecord): HistoryVideoItem => {
        const sv = videos.find((v) => v.id === h.videoId);
        const base: Video = sv ?? {
          id: h.videoId,
          title: '未知',
          cover: '',
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
    return list;
  }, [watchHistory, videos, searchByTab.video]);

  // ── IPTV 历史（仅受 IPTV tab 搜索词影响） ──────────
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

  const currentList: HistoryVideoItem[] | HistoryChannelItem[] = activeTab === 'video' ? historyVideos : iptvHistory;
  const currentListLenRef = useRef(currentList.length);
  currentListLenRef.current = currentList.length;

  // ── 懒加载切片 ─────────────────────────────────
  const displayedList = useMemo(
    () => (currentList as (HistoryVideoItem | HistoryChannelItem)[]).slice(0, visibleCount),
    [currentList, visibleCount],
  );
  const hasMore = visibleCount < currentList.length;
  const loadMore = useCallback(() => {
    setVisibleCount((v) => Math.min(v + PAGE_SIZE, currentListLenRef.current));
  }, []);

  // 哨兵由 useInfiniteScroll 自带;rootMargin 与 IPTV 保持一致
  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: false,
    onLoadMore: loadMore,
    rootMargin: '100px',
    scrollContainerRef,
  });

  // ── 按日期分组(基于懒加载切片) ─────────────────────
  const grouped = useMemo<Record<string, (HistoryVideoItem | HistoryChannelItem)[]>>(() => {
    const g: Record<string, (HistoryVideoItem | HistoryChannelItem)[]> = {};
    displayedList.forEach((item) => {
      const k = getDateGroup(item._histTime);
      if (!g[k]) g[k] = [];
      g[k].push(item);
    });
    return g;
  }, [displayedList]);

  // ── 时间轴数据 ────────────────────────────────
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

  // ── group DOM 引用（用于点击节点平滑滚动 + IO 监听） ──
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setGroupRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    if (el) groupRefs.current[key] = el;
    else delete groupRefs.current[key];
  }, []);

  // ── IntersectionObserver 监听可视分组 → 更新 active ──
  useEffect(() => {
    if (groupedKeys.length === 0) {
      setActiveGroupKey(null);
      return;
    }
    // 默认激活第一个分组
    if (!activeGroupKey || !groupedKeys.includes(activeGroupKey)) {
      setActiveGroupKey(groupedKeys[0]);
    }
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 找到当前最靠近视口顶部的可见 group
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
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveGroupKey(key as GroupKey);
  }, []);

  const toggleSelect = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === currentList.length ? new Set() : new Set(currentList.map((v) => v.id)));
  const deleteSelected = () => {
    if (activeTab === 'video') selected.forEach(id => removeHistory(id));
    else selected.forEach(id => removePlayRecord(id));
    setSelected(new Set());
  };
  const clearAll = () => {
    if (activeTab === 'video') clearHistory();
    else clearPlayHistory();
  };

  const showTimeline = timelineItems.length > 0;
  const showSelectAllRow = currentList.length > 0;

  return (
    <div className={`history-page ${batchMode ? 'batch-mode' : ''}`}>
      <div className="history-header">
        <h1>观看历史</h1>
      </div>

      <div className="category-tabs">
        <button className={`category-tab ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>影视 ({historyVideos.length})</button>
        <button className={`category-tab ${activeTab === 'iptv' ? 'active' : ''}`} onClick={() => setActiveTab('iptv')}>IPTV ({iptvHistory.length})</button>
      </div>

      <div className="history-toolbar">
        <div className="search-box-wrap search-box-wrap--iptv" role="search">
          <div className="search-box search-box--iptv">
            <Search size={16} className="search-box__icon" aria-hidden="true" />
            <input
              type="text"
              className="search-box__input"
              placeholder={activeTab === 'video' ? '搜索影片、剧集...' : '搜索频道...'}
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
        <div className="toolbar-actions" style={{ visibility: showSelectAllRow ? 'visible' : 'hidden' }}>
          {batchMode && (
            <>
              <button
                type="button"
                className="toolbar-btn"
                onClick={selectAll}
                aria-pressed={selected.size === currentList.length && currentList.length > 0}
              >
                {selected.size === currentList.length && currentList.length > 0
                  ? <CheckSquare size={14} />
                  : <Square size={14} />}
                <span>全选</span>
              </button>
              {selected.size > 0 && (
                <button type="button" className="toolbar-btn toolbar-btn--danger" onClick={deleteSelected}>
                  <Trash2 size={14} /> 删除选中 ({selected.size})
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className={`toolbar-btn ${batchMode ? 'toolbar-btn--active' : ''}`}
            onClick={() => { setBatchMode(!batchMode); if (batchMode) setSelected(new Set()); }}
          >
            <ListChecks size={14} /> {batchMode ? '退出批量' : '批量操作'}
          </button>
          <button type="button" className="toolbar-btn toolbar-btn--danger" onClick={clearAll}>
            <Trash2 size={14} /> 清除全部
          </button>
        </div>
      </div>

      <div className="history-body">
        {showTimeline && (
          <aside className="history-timeline" aria-label="时间分组导航">
            <Timeline
              items={timelineItems}
              onItemClick={handleTimelineClick}
              variant={isMobile ? 'horizontal' : 'vertical'}
            />
          </aside>
        )}

        <div className="history-content" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }}>
          {groupedKeys.map((group) => (
            <div
              key={group}
              ref={setGroupRef(group)}
              data-group-key={group}
              className="history-group"
            >
              <h2 className="history-group-title">{group}</h2>
              {activeTab === 'video' ? (
                <div className="video-card-grid">
                  {(grouped[group] as HistoryVideoItem[]).map((video) => (
                    <div
                      key={video.id}
                      className={`history-card ${batchMode && selected.has(video.id) ? 'selected' : ''}`}
                      onClick={batchMode ? () => toggleSelect(video.id) : undefined}
                    >
                      {batchMode && (
                        <button className="history-card-check" onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }}>
                          {selected.has(video.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      )}
                      <button className="history-card-del" onClick={(e) => { e.stopPropagation(); removeHistory(video._histId); }} title="删除"><Trash2 size={14} /></button>
                      <VideoCard video={video} hideFavorite batchMode={batchMode} />
                      <span
                        className="history-card-time"
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
                      className={`history-channel-card-wrap ${batchMode && selected.has(ch.id) ? 'selected' : ''}`}
                      onClick={batchMode ? () => toggleSelect(ch.id) : undefined}
                    >
                      {batchMode && (
                        <button className="history-card-check" onClick={(e) => { e.stopPropagation(); toggleSelect(ch.id); }}>
                          {selected.has(ch.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      )}
                      <IPTVChannelCard channel={ch as IPTVChannel} hideFavorite batchMode={batchMode} />
                      <span
                        className="history-card-time"
                        title={formatFullTime(ch._histTime)}
                      >
                        {formatPlayTime(ch._histTime, group as GroupKey)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {currentList.length === 0 && (
        <Empty title="暂无观看记录" description="看一部影片，记录从这里开始" />
      )}

      {/* 懒加载:哨兵 + 文字态(与 IPTV 风格一致) */}
      <div ref={sentinelRef} aria-hidden="true" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }} />
      {createPortal(
        <div className="load-more-hint" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }}>
          {hasMore
            ? `已加载 ${displayedList.length} / ${currentList.length}`
            : `已加载 ${displayedList.length} / ${currentList.length} · 已显示全部`}
        </div>,
        document.getElementById('load-more-portal')!,
      )}

      <BackToTopButton />
    </div>
  );
}
