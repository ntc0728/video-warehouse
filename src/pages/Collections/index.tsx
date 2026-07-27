/**
 * 收藏页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、筛选、多选删除、清除全部
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useVideoStore, useUserStore, useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';
import { ConfirmDialog, Select } from '@/components/ui';
import { Trash2, CheckSquare, Square, LayoutGrid, PlayCircle, Eye, CheckCircle2, ListChecks } from 'lucide-react';
import RecordShell from '@/components/RecordShell';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useDocumentTitle } from '@/hooks';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import type { Video, VideoType } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { CollectionRecord } from '@/types/store';
import './Collections.css';

const PAGE_SIZE = 30;

type Tab = 'video' | 'iptv';
type VideoStatus = 'all' | 'unwatched' | 'watching' | 'watched';
type SortKey = 'recent' | 'oldest' | 'title-asc' | 'title-desc' | 'rating-desc' | 'rating-asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: '最近收藏' },
  { value: 'oldest', label: '最早收藏' },
  { value: 'title-asc', label: '名称A-Z' },
  { value: 'title-desc', label: '名称Z-A' },
  { value: 'rating-desc', label: '评分从高到低' },
  { value: 'rating-asc', label: '评分从低到高' },
];

interface CollectionVideoItem extends Video {
  _rating?: number;
  _status?: VideoStatus;
  _sourceIndex?: number;
  /** 收藏时间（用于排序） */
  _addedAt?: number;
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

  useDocumentTitle();
  const saved = getState('collections');
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>((saved?.tab as Tab) || 'video');
  const [statusFilter, setStatusFilter] = useState<VideoStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [searchByTab, setSearchByTab] = useState<{ video: string; iptv: string }>({ video: '', iptv: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>('single');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('collections', undefined, location.pathname === '/collections');

  // 离开页面时清空筛选状态
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = location.pathname;
    if (prev === '/collections' && location.pathname !== '/collections') {
      setActiveTab('video');
      setStatusFilter('all');
      setSortBy('recent');
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

  // 注册顶部导航栏搜索回调（仅当前路由匹配时注册，防止 Keep-Alive 下离开页面后重注册）
  useEffect(() => {
    if (location.pathname !== '/collections') return;
    const store = usePageSearchStore.getState();
    const placeholder = activeTab === 'video' ? '搜索影视剧...' : '搜索频道...';
    store.setPageSearch(search, setSearch, placeholder);
    return () => { store.clearPageSearch(); };
  }, [search, setSearch, activeTab, location.pathname]);

  // IPTV tab 首次激活时从 IndexedDB 缓存加载频道数据（静默）
  useEffect(() => {
    if (activeTab === 'iptv') {
      useIPTVStore.getState().loadFromCache();
    }
  }, [activeTab]);

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
        if (sv) return { ...sv, _rating: c.rating, _status: status, _sourceIndex: c.sourceIndex, _addedAt: c.addedAt };
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
          _sourceIndex: c.sourceIndex,
          _addedAt: c.addedAt,
        };
      });
    if (searchByTab.video.trim()) { const kw = searchByTab.video.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    if (statusFilter !== 'all') { list = list.filter((v) => v._status === statusFilter); }

    // 排序：默认最近收藏；名称按中文拼音序；评分缺失按 0 处理，同值时按收藏时间倒序兜底
    const byAddedDesc = (a: CollectionVideoItem, b: CollectionVideoItem) => (b._addedAt ?? 0) - (a._addedAt ?? 0);
    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => (a._addedAt ?? 0) - (b._addedAt ?? 0));
        break;
      case 'title-asc':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hans-CN') || byAddedDesc(a, b));
        break;
      case 'title-desc':
        list.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'zh-Hans-CN') || byAddedDesc(a, b));
        break;
      case 'rating-desc':
        list.sort((a, b) => ((b._rating ?? 0) - (a._rating ?? 0)) || byAddedDesc(a, b));
        break;
      case 'rating-asc':
        list.sort((a, b) => ((a._rating ?? 0) - (b._rating ?? 0)) || byAddedDesc(a, b));
        break;
      default:
        list.sort(byAddedDesc);
    }
    return list;
  }, [collections, videos, searchByTab.video, statusFilter, getVideoStatus, sortBy]);

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
    // 按最后播放时间倒序排列（最新的在前）
    list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return list;
  }, [iptvChannels, searchByTab.iptv]);

  const currentList: CollectionVideoItem[] | IPTVChannel[] = activeTab === 'video' ? collectedVideos : favoriteChannels;
  const currentListLenRef = useRef(currentList.length);
  currentListLenRef.current = currentList.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchByTab.video, searchByTab.iptv, statusFilter, sortBy]);

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
    <RecordShell
      pageClassName="collection-page"
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
        {activeTab === 'video' && (
          <div className="record-sort">
            <Select
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={(v) => setSortBy(v as SortKey)}
            />
          </div>
        )}
        <button
          type="button"
          className={`record-edit-btn ${batchMode ? 'record-edit-btn--active' : ''}`}
          onClick={() => { setBatchMode(!batchMode); if (batchMode) setSelected(new Set()); }}
        >
          <ListChecks size={14} />
          {batchMode ? '退出管理' : '批量管理'}
        </button>
      </div>
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
                <VideoCard video={video} rating={video._rating} hideFavorite batchMode={batchMode} navigateTo={video._sourceIndex !== undefined ? `/play/${video.id}` : undefined} navigateState={video._sourceIndex !== undefined ? { sourceIndex: video._sourceIndex } : undefined} />
              </div>
            ))}
          </div>
        ) : (
          <div className="iptv-channel-grid iptv-channel-grid--batch">
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
          <button
            type="button"
            className="batch-action-btn batch-action-btn--danger"
            onClick={handleClearAll}
          >
            <Trash2 size={16} /> 清除全部
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
