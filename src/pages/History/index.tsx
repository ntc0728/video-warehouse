/**
 * 观看历史页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、日期分组、多选删除、清除全部
 */
import { useState, useMemo, useEffect } from 'react';
import { useVideoStore, useUserStore, useIPTVStore, useNavStore } from '@/stores';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton } from '@/components/common';
import { Search, X, Trash2, CheckSquare, Square } from 'lucide-react';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { Video } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { HistoryRecord } from '@/types/store';
import type { IPTVPlayRecord } from '@/stores/useIPTVStore';
import './History.css';

const PAGE_SIZE = 30;

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
}

function getDateGroup(ts: number): string {
  const d = new Date(ts); const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= today) return '今天';
  if (d.getTime() >= today - 86400000) return '昨天';
  if (d.getTime() >= today - 7 * 86400000) return '本周';
  return '更早';
}

type Tab = 'video' | 'iptv';

export default function HistoryPage() {
  const { videos } = useVideoStore();
  const { history: watchHistory, removeHistory, clearHistory } = useUserStore();
  const { playHistory, channels: iptvChannels, clearPlayHistory, removePlayRecord } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('history');

  const [activeTab, setActiveTab] = useState<Tab>((saved?.tab as Tab) || 'video');
  const [search, setSearch] = useState(saved?.search || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('history');

  useEffect(() => {
    return () => { saveState('history', { tab: activeTab, search }); };
  }, [activeTab, search, saveState]);

  useEffect(() => { setSearch(saved?.search || ''); setSelected(new Set()); }, [activeTab, saved?.search]);

  // 切 tab / 搜索变化时,重置 visibleCount 到首屏
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, search]);

  // ── 影视历史 ─────────────────────────────────
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
    if (search.trim()) { const kw = search.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    return list;
  }, [watchHistory, videos, search]);

  // ── IPTV 历史 ────────────────────────────────
  const iptvHistory = useMemo<HistoryChannelItem[]>(() => {
    let list: HistoryChannelItem[] = [...playHistory]
      .reverse()
      .map((r: IPTVPlayRecord): HistoryChannelItem => {
        const ch = iptvChannels.find((c) => c.id === r.channelId);
        return ch ?? {
          id: r.channelId,
          name: r.channelName,
          logo: r.channelLogo,
          group: r.channelGroup,
          url: '',
        };
      });
    if (search.trim()) { const kw = search.toLowerCase(); list = list.filter((c) => c.name?.toLowerCase().includes(kw)); }
    return list;
  }, [playHistory, iptvChannels, search]);

  const currentList: HistoryVideoItem[] | HistoryChannelItem[] = activeTab === 'video' ? historyVideos : iptvHistory;

  // ── 懒加载切片 ─────────────────────────────────
  const displayedList = useMemo(
    () => (currentList as (HistoryVideoItem | HistoryChannelItem)[]).slice(0, visibleCount),
    [currentList, visibleCount],
  );
  const hasMore = visibleCount < currentList.length;
  const loadMore = () => {
    setVisibleCount((v) => Math.min(v + PAGE_SIZE, currentList.length));
  };

  // 哨兵由 useInfiniteScroll 自带;rootMargin 与 IPTV 保持一致
  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: false,
    onLoadMore: loadMore,
    rootMargin: '100px',
    scrollContainerRef,
  });

  // 影视按日期分组(基于懒加载切片,保证分组只包含已展示项)
  const grouped = useMemo<Record<string, HistoryVideoItem[]>>(() => {
    if (activeTab !== 'video') return {};
    const g: Record<string, HistoryVideoItem[]> = {};
    (displayedList as HistoryVideoItem[]).forEach((v) => {
      const k = getDateGroup(v._histTime);
      if (!g[k]) g[k] = [];
      g[k].push(v);
    });
    return g;
  }, [displayedList, activeTab]);

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

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>观看历史</h1>
        <button className="history-btn history-btn--danger" onClick={clearAll}><Trash2 size={16} /> 清除全部</button>
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
              placeholder="搜索…"
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
        {selected.size > 0 && (
          <button className="history-btn history-btn--danger" onClick={deleteSelected}><Trash2 size={14} /> 删除选中 ({selected.size})</button>
        )}
      </div>

      {currentList.length > 0 && (
        <div className="history-select-all" onClick={selectAll}>
          {selected.size === currentList.length ? <CheckSquare size={16} /> : <Square size={16} />}<span>全选</span>
        </div>
      )}

      {currentList.length === 0 ? (
        <Empty title="暂无观看记录" description="看一部影片，记录从这里开始" />
      ) : activeTab === 'video' ? (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="history-group">
            <h2 className="history-group-title">{group}</h2>
            <div className="video-card-grid">
              {items.map((video) => (
                <div key={video.id} className={`history-card ${selected.has(video.id) ? 'selected' : ''}`}>
                  <button className="history-card-check" onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }}>
                    {selected.has(video.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <button className="history-card-del" onClick={(e) => { e.stopPropagation(); removeHistory(video._histId); }} title="删除"><Trash2 size={14} /></button>
                  <VideoCard video={video} hideFavorite />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="iptv-channel-grid">
          {activeTab === 'iptv' && (displayedList as HistoryChannelItem[]).map((ch) => (
            <IPTVChannelCard key={ch.id} channel={ch as IPTVChannel} hideFavorite />
          ))}
        </div>
      )}

      {/* 懒加载:哨兵 + 文字态(与 IPTV 风格一致) */}
      {currentList.length > 0 && (
        <>
          <div ref={sentinelRef} aria-hidden="true" />
          <div className="load-more-hint">
            {hasMore
              ? `已加载 ${displayedList.length} / ${currentList.length}`
              : `已加载 ${displayedList.length} / ${currentList.length} · 已显示全部`}
          </div>
        </>
      )}

      <BackToTopButton />
    </div>
  );
}
