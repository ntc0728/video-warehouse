/**
 * 收藏页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、筛选、多选删除、清除全部
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVideoStore, useUserStore, useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';
import { ConfirmDialog } from '@/components/ui';
import { Search, X, Trash2, CheckSquare, Square, ListChecks, LayoutGrid, PlayCircle, Eye, CheckCircle2 } from 'lucide-react';
import StatusTabs from '@/components/StatusTabs';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { Video, VideoType } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { CollectionRecord } from '@/types/store';
import './Collections.css';

const PAGE_SIZE = 30;

type Tab = 'video' | 'iptv';
type VideoStatus = 'all' | 'unwatched' | 'watching' | 'watched';

interface CollectionVideoItem extends Video {
  _rating?: number;
  _status?: VideoStatus;
}

type ConfirmType = 'single' | 'batch' | 'clearAll';

const STATUS_CONFIG: Record<VideoStatus, { label: string; icon: typeof LayoutGrid; color: string }> = {
  all: { label: '全部', icon: LayoutGrid, color: 'var(--color-text-tertiary)' },
  unwatched: { label: '未观看', icon: PlayCircle, color: '#3b82f6' },
  watching: { label: '正在看', icon: Eye, color: '#d97706' },
  watched: { label: '已看完', icon: CheckCircle2, color: '#22c55e' },
};

export default function CollectionsPage() {
  const { videos } = useVideoStore();
  const { collections, history, removeCollection, _loading: userLoading } = useUserStore();
  const { channels: iptvChannels, toggleFavorite, clearFavorites } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('collections');

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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>('single');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('collections');

  const search = searchByTab[activeTab];
  const setSearch = useCallback((v: string) => {
    setSearchByTab((prev) => ({ ...prev, [activeTab]: v }));
  }, [activeTab]);

  const searchByTabRef = useRef(searchByTab);
  searchByTabRef.current = searchByTab;

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

  useEffect(() => { setSelected(new Set()); setBatchMode(false); }, [activeTab]);

  /** Determine watch status for a video based on history records */
  const getVideoStatus = useCallback((videoId: string): VideoStatus => {
    const records = history.filter(h => h.videoId === videoId);
    if (records.length === 0) return 'unwatched';
    const latest = records.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b);
    if (latest.duration > 0 && latest.progress >= latest.duration * 0.9) return 'watched';
    if (latest.progress > 0) return 'watching';
    return 'unwatched';
  }, [history]);

  const collectedVideos = useMemo<CollectionVideoItem[]>(() => {
    let list: CollectionVideoItem[] = collections
      .filter((c: CollectionRecord) => c.type !== 'iptv')
      .map((c: CollectionRecord): CollectionVideoItem => {
        const sv = videos.find((v) => v.id === c.videoId);
        const status = getVideoStatus(c.videoId);
        if (sv) return { ...sv, _rating: c.rating, _status: status };
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
          _status: status,
        };
      });
    if (searchByTab.video.trim()) { const kw = searchByTab.video.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    if (statusFilter !== 'all') { list = list.filter((v) => v._status === statusFilter); }
    return list;
  }, [collections, videos, searchByTab.video, statusFilter, getVideoStatus]);

  /** Counts for status tabs (before status filter, only search filter applied) */
  const statusCounts = useMemo(() => {
    let list = collections
      .filter((c: CollectionRecord) => c.type !== 'iptv')
      .map((c) => ({ id: c.videoId, status: getVideoStatus(c.videoId) }));
    if (searchByTab.video.trim()) {
      const kw = searchByTab.video.toLowerCase();
      list = list.filter((c) => {
        const sv = videos.find(v => v.id === c.id);
        return sv?.title?.toLowerCase().includes(kw);
      });
    }
    const counts: Record<VideoStatus, number> = { all: list.length, unwatched: 0, watching: 0, watched: 0 };
    list.forEach(c => { counts[c.status]++; });
    return counts;
  }, [collections, videos, searchByTab.video, getVideoStatus]);

  const favoriteChannels = useMemo(() => {
    let list = iptvChannels.filter(ch => ch.isFavorite);
    if (searchByTab.iptv.trim()) { const kw = searchByTab.iptv.toLowerCase(); list = list.filter(ch => ch.name?.toLowerCase().includes(kw)); }
    return list;
  }, [iptvChannels, searchByTab.iptv]);

  /** 原始数据量（进入页面时获取，不受搜索/状态筛选影响） */
  const rawVideoCount = useMemo(() => collections.filter((c: CollectionRecord) => c.type !== 'iptv').length, [collections]);
  const rawIptvCount = useMemo(() => iptvChannels.filter(ch => ch.isFavorite).length, [iptvChannels]);
  const hasRawData = activeTab === 'video' ? rawVideoCount > 0 : rawIptvCount > 0;

  const currentList: CollectionVideoItem[] | IPTVChannel[] = activeTab === 'video' ? collectedVideos : favoriteChannels;
  const currentListLenRef = useRef(currentList.length);
  currentListLenRef.current = currentList.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchByTab.video, searchByTab.iptv, statusFilter]);

  const displayedList = useMemo(
    () => (currentList as (CollectionVideoItem | IPTVChannel)[]).slice(0, visibleCount),
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

  const toggleSelect = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === currentList.length ? new Set() : new Set(currentList.map((v) => v.id)));

  const executeDelete = useCallback(() => {
    if (confirmType === 'single' && pendingDeleteId) {
      if (activeTab === 'video') removeCollection(pendingDeleteId);
      else toggleFavorite(pendingDeleteId);
    } else if (confirmType === 'batch') {
      if (activeTab === 'video') selected.forEach(id => removeCollection(id));
      else selected.forEach(id => toggleFavorite(id));
      setSelected(new Set());
    } else if (confirmType === 'clearAll') {
      if (activeTab === 'video') collections.filter(c => c.type !== 'iptv').forEach(c => removeCollection(c.videoId));
      else clearFavorites();
    }
    setPendingDeleteId(null);
  }, [confirmType, pendingDeleteId, selected, activeTab, removeCollection, toggleFavorite, clearFavorites, collections]);

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

  const confirmTitle = confirmType === 'single' ? '确认删除' : confirmType === 'batch' ? '批量删除' : '清除全部';
  const confirmDescription = confirmType === 'single'
    ? '确定要删除这个收藏吗？删除后无法恢复。'
    : confirmType === 'batch'
      ? `确定要删除选中的 ${selected.size} 个项目吗？删除后无法恢复。`
      : '确定要清除所有收藏吗？此操作无法恢复。';

  return (
    <div className={`collection-page ${batchMode ? 'batch-mode' : ''}`}>
      {/* Row 1: 标题 + 分类 segmented + 搜索 + 操作按钮 */}
      <div className="collection-filter-bar record-filter-bar">
        <div className="record-filter-bar__left">
          <h1 className="record-filter-bar__title">我的收藏</h1>
          <div className="category-segmented">
            <button className={`category-segmented__item ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>影视</button>
            <button className={`category-segmented__item ${activeTab === 'iptv' ? 'active' : ''}`} onClick={() => setActiveTab('iptv')}>IPTV</button>
          </div>
        </div>
        {hasRawData && (
          <div className="record-filter-bar__actions">
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
            <div className="toolbar-actions">
              <button
                type="button"
                className={`toolbar-btn toolbar-btn--icon ${batchMode ? 'toolbar-btn--active' : ''}`}
                disabled={search.trim() !== '' && currentList.length === 0}
                onClick={() => { setBatchMode(!batchMode); if (batchMode) setSelected(new Set()); }}
                aria-label={batchMode ? '退出批量' : '批量操作'}
              >
                <ListChecks size={16} />
                <span className="toolbar-btn__label">{batchMode ? '退出批量' : '批量操作'}</span>
              </button>
              <button
                type="button"
                className="toolbar-btn toolbar-btn--danger toolbar-btn--icon"
                disabled={search.trim() !== '' && currentList.length === 0}
                onClick={handleClearAll}
                aria-label="清除全部"
              >
                <Trash2 size={16} />
                <span className="toolbar-btn__label">清除全部</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: StatusTabs pill chips（仅 video tab 时显示） */}
      {activeTab === 'video' && (
        <StatusTabs
          tabs={(Object.keys(STATUS_CONFIG) as VideoStatus[]).map((key) => ({
            key,
            label: STATUS_CONFIG[key].label,
            icon: STATUS_CONFIG[key].icon,
            color: STATUS_CONFIG[key].color,
            count: statusCounts[key],
          }))}
          activeKey={statusFilter}
          onChange={(key) => setStatusFilter(key as VideoStatus)}
        />
      )}

      <div className="collection-content" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }}>
        {activeTab === 'video' ? (
          <div className="video-card-grid">
            {(displayedList as CollectionVideoItem[]).map((video) => (
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
                <button className="record-card__delete" onClick={(e) => handleSingleDelete(video.id, e)} aria-label="删除"><Trash2 size={14} /></button>
                <VideoCard video={video} rating={video._rating} hideFavorite batchMode={batchMode} />
              </div>
            ))}
          </div>
        ) : (
          <div className="iptv-channel-grid">
            {(displayedList as IPTVChannel[]).map((ch) => (
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
                <IPTVChannelCard channel={ch} hideFavorite batchMode={batchMode} />
              </div>
            ))}
          </div>
        )}
      </div>
      {userLoading ? (
        <div className="player-loading-wrap">
          <AppLoading tip="加载中…" showTip />
        </div>
      ) : currentList.length === 0 ? (
        <Empty
          title={statusFilter === 'all' ? '暂无收藏' : `暂无${STATUS_CONFIG[statusFilter].label}记录`}
          description={activeTab === 'video' ? '去首页发现喜欢的影片吧' : '去 IPTV 页面收藏喜欢的频道吧'}
        />
      ) : null}

      <div ref={sentinelRef} aria-hidden="true" style={{ visibility: currentList.length > 0 ? 'visible' : 'hidden' }} />

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
