/**
 * 收藏页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、筛选、多选删除、清除全部
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVideoStore, useUserStore, useIPTVStore, useNavStore } from '@/stores';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton } from '@/components/common';
import { Search, X, Trash2, CheckSquare, Square, ListChecks } from 'lucide-react';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { Video, VideoType } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { CollectionRecord } from '@/types/store';
import './Collections.css';

const PAGE_SIZE = 30;

type Tab = 'video' | 'iptv';

interface CollectionVideoItem extends Video {
  _rating?: number;
}

export default function CollectionsPage() {
  const { videos } = useVideoStore();
  const { collections, removeCollection } = useUserStore();
  const { channels: iptvChannels, toggleFavorite, clearFavorites } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('collections');

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

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('collections');

  const search = searchByTab[activeTab];
  const setSearch = useCallback((v: string) => {
    setSearchByTab((prev) => ({ ...prev, [activeTab]: v }));
  }, [activeTab]);

  // 用 ref 追踪最新 search 值，确保 cleanup 始终保存最新值而非闭包捕获的过期值
  const searchByTabRef = useRef(searchByTab);
  searchByTabRef.current = searchByTab;

  // 离开时保存状态（cleanup 中读 ref 而非闭包变量，避免保存过期值导致 store 状态抖动）
  useEffect(() => {
    return () => {
      saveState('collections', {
        tab: activeTab,
        search: searchByTabRef.current[activeTab] || '',
        filter: {
          searchByTab: { ...searchByTabRef.current },
        },
      });
    };
  }, [activeTab, saveState]);

  // 切 tab 时 selected 集合重置（id 域不同）+ 退出批量模式
  useEffect(() => { setSelected(new Set()); setBatchMode(false); }, [activeTab]);

  // ── 影视收藏（仅受影视 tab 搜索词影响） ─────────────
  const collectedVideos = useMemo<CollectionVideoItem[]>(() => {
    let list: CollectionVideoItem[] = collections
      .filter((c: CollectionRecord) => c.type !== 'iptv')
      .map((c: CollectionRecord): CollectionVideoItem => {
        const sv = videos.find((v) => v.id === c.videoId);
        if (sv) return { ...sv, _rating: c.rating };
        return {
          id: c.videoId,
          title: c.title || '',
          cover: c.cover || '',
          type: (c.type as VideoType) || 'movie',
          year: c.year,
          tags: [],
          actors: [],
          sources: [],
          createdAt: c.addedAt,
          updatedAt: c.addedAt,
          _rating: c.rating,
        };
      });
    if (searchByTab.video.trim()) { const kw = searchByTab.video.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    return list;
  }, [collections, videos, searchByTab.video]);

  // ── IPTV 收藏（仅受 IPTV tab 搜索词影响） ──────────
  const favoriteChannels = useMemo(() => {
    let list = iptvChannels.filter(ch => ch.isFavorite);
    if (searchByTab.iptv.trim()) { const kw = searchByTab.iptv.toLowerCase(); list = list.filter(ch => ch.name?.toLowerCase().includes(kw)); }
    return list;
  }, [iptvChannels, searchByTab.iptv]);

  const currentList: CollectionVideoItem[] | IPTVChannel[] = activeTab === 'video' ? collectedVideos : favoriteChannels;
  const currentListLenRef = useRef(currentList.length);
  currentListLenRef.current = currentList.length;

  // 切 tab / 搜索 / 筛选变化时,重置 visibleCount 到首屏
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchByTab.video, searchByTab.iptv]);

  // ── 懒加载切片 ─────────────────────────────────
  const displayedList = useMemo(
    () => (currentList as (CollectionVideoItem | IPTVChannel)[]).slice(0, visibleCount),
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

  const toggleSelect = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === currentList.length ? new Set() : new Set(currentList.map((v) => v.id)));
  const deleteSelected = () => {
    if (activeTab === 'video') selected.forEach(id => removeCollection(id));
    else selected.forEach(id => toggleFavorite(id));
    setSelected(new Set());
  };
  const clearAll = () => {
    if (activeTab === 'video') collections.filter(c => c.type !== 'iptv').forEach(c => removeCollection(c.videoId));
    else clearFavorites();
  };

  return (
    <div className={`collection-page ${batchMode ? 'batch-mode' : ''}`}>
      <div className="collection-header">
        <h1>我的收藏</h1>
      </div>

      {/* Tab 切换 */}
      <div className="category-tabs">
        <button className={`category-tab ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>影视 ({collectedVideos.length})</button>
        <button className={`category-tab ${activeTab === 'iptv' ? 'active' : ''}`} onClick={() => setActiveTab('iptv')}>IPTV ({favoriteChannels.length})</button>
      </div>

      {/* 搜索 + 操作按钮 */}
      <div className="collection-toolbar">
        <div className="search-box-wrap search-box-wrap--iptv" role="search">
          <div className="search-box search-box--iptv">
            <Search size={16} className="search-box__icon" aria-hidden="true" />
            <input
              type="text"
              className="search-box__input"
              placeholder="搜索频道..."
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
        <div className="toolbar-actions" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }}>
          {batchMode && (
            <>
              <button type="button" className="toolbar-btn" onClick={selectAll}>
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

      {/* 内容 */}
      <div className="collection-content" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }}>
        {activeTab === 'video' ? (
          <div className="video-card-grid">
            {(displayedList as CollectionVideoItem[]).map((video) => (
              <div
                key={video.id}
                className={`collection-card ${batchMode && selected.has(video.id) ? 'selected' : ''}`}
                onClick={batchMode ? () => toggleSelect(video.id) : undefined}
              >
                {batchMode && (
                  <button className="collection-card-check" onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }}>
                    {selected.has(video.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                )}
                <button className="collection-card-del" onClick={(e) => { e.stopPropagation(); removeCollection(video.id); }} title="删除"><Trash2 size={14} /></button>
                <VideoCard video={video} rating={video._rating} hideFavorite batchMode={batchMode} />
              </div>
            ))}
          </div>
        ) : (
          <div className="iptv-channel-grid">
            {(displayedList as IPTVChannel[]).map((ch) => (
              <div
                key={ch.id}
                className={`collection-card ${batchMode && selected.has(ch.id) ? 'selected' : ''}`}
                onClick={batchMode ? () => toggleSelect(ch.id) : undefined}
              >
                {batchMode && (
                  <button className="collection-card-check" onClick={(e) => { e.stopPropagation(); toggleSelect(ch.id); }}>
                    {selected.has(ch.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                )}
                <button className="collection-card-del" onClick={(e) => { e.stopPropagation(); toggleFavorite(ch.id); }} title="删除"><Trash2 size={14} /></button>
                <IPTVChannelCard channel={ch} hideFavorite batchMode={batchMode} />
              </div>
            ))}
          </div>
        )}
      </div>
      {currentList.length === 0 && (
        <Empty title="暂无收藏" description={activeTab === 'video' ? '去首页发现喜欢的影片吧' : '去 IPTV 页面收藏喜欢的频道吧'} />
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
