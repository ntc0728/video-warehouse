/**
 * 收藏页面（重构）
 * 融合 Tab（综合/视频/IPTV）+「更多筛选」面板（状态 chips + 排序）+ 批量管理
 * 综合 = 「影视」竖版海报墙分区 + 「直播」原项目 IPTV 卡分区（各用原生网格，
 *       卡片出场动画保留：.video-card-grid / .iptv-channel-grid 子项 stagger + key 重挂载）。
 * 状态筛选（未观看/正在看/已看完）仅作用于影视分区；直播分区恒全量。
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserStore, useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';
import { ConfirmDialog } from '@/components/ui';
import { Trash2, CheckSquare, Square, LayoutGrid, PlayCircle, Tv, ListChecks, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import RecordShell, { type RecordStatusTab } from '@/components/RecordShell';
import RecordFilterPanel from '@/components/RecordFilterPanel';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useDocumentTitle } from '@/hooks';

import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { getCachedEPGData, buildEPGChannelIndex } from '@/services/epgService';
import type { EPGChannelIndex } from '@/services/epgService';
import type { Video, VideoType } from '@/types/video';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import './Collections.css';
import { Icon } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';

const PAGE_SIZE = 30;

type MainTab = 'all' | 'video' | 'iptv';
type VideoStatus = 'all' | 'unwatched' | 'watching' | 'watched';
/** 实际观看状态（收藏页视频卡角标/筛选用），不含「全部」 */
type ConcreteVideoStatus = Exclude<VideoStatus, 'all'>;
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
  _status?: ConcreteVideoStatus;
  _sourceIndex?: number;
  /** 收藏时间（用于排序） */
  _addedAt?: number;
}

type ConfirmType = 'single' | 'batch' | 'clearAll';

/** 状态配置：label（面板 chips 文案）+ color（圆点色；全部=黑，不传走默认） */
const STATUS_CONFIG: Record<VideoStatus, { label: string; color?: string }> = {
  all: { label: '全部' },
  unwatched: { label: '未观看', color: '#3b82f6' },
  watching: { label: '正在看', color: '#d97706' },
  watched: { label: '已看完', color: '#22c55e' },
};

/** 融合 Tab 元数据：综合 / 视频 / IPTV（彩色圆点 + 计数，与历史页一致） */
const FUSED_TAB_META: { key: MainTab; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'all', label: '综合', icon: LayoutGrid, color: 'var(--color-primary)' },
  { key: 'video', label: '视频', icon: PlayCircle, color: 'var(--color-primary)' },
  { key: 'iptv', label: 'IPTV', icon: Tv, color: '#22c55e' },
];

export default function CollectionsPage() {
  const { collections, history, removeCollection, _loading: userLoading } = useUserStore();
  const { channels: iptvChannels, toggleFavorite, clearFavorites } = useIPTVStore();
  const { getState, saveState } = useNavStore();

  useDocumentTitle();
  const pageRef = useRef<HTMLDivElement>(null);
  const saved = getState('collections');
  const location = useLocation();

  const [mainTab, setMainTab] = useState<MainTab>((saved?.tab as MainTab) || 'all');
  const [statusFilter, setStatusFilter] = useState<VideoStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchByTab, setSearchByTab] = useState<{ all: string; video: string; iptv: string }>({ all: '', video: '', iptv: '' });
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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>('single');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; kind: 'video' | 'iptv' } | null>(null);

  // EPG 频道预索引（零网络读 IndexedDB 缓存）：IPTV 收藏卡台标二级回退（EPG XMLTV icon）
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
  useScrollRestore('collections', undefined, true, { restoreFrom: ['detail', 'play'] });

  // 下拉刷新：从 IndexedDB 重新读取收藏与历史
  usePullToRefresh(() => useUserStore.getState().reload());

  const search = searchByTab[mainTab];
  const setSearch = useCallback((v: string) => {
    setSearchByTab((prev) => ({ ...prev, [mainTab]: v }));
  }, [mainTab]);

  const searchByTabRef = useRef(searchByTab);
  searchByTabRef.current = searchByTab;

  useEffect(() => {
    return () => {
      saveState('collections', {
        tab: mainTab,
        search: searchByTabRef.current[mainTab] || '',
        filter: {
          searchByTab: { ...searchByTabRef.current },
        },
      });
    };
  }, [mainTab, saveState]);

  useEffect(() => { setSelected(new Set()); setBatchMode(false); }, [mainTab]);

  // 注册顶部导航栏搜索回调（仅当前路由匹配时注册，防止 Keep-Alive 下离开页面后重注册）
  useEffect(() => {
    if (location.pathname !== '/collections') return;
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
  // 综合 tab 也展示直播分区，故 mainTab !== 'video' 即需要频道数据。
  useEffect(() => {
    if (mainTab !== 'video' && useIPTVStore.getState().channels.length === 0) {
      useIPTVStore.getState().loadFromCache();
    }
  }, [mainTab]);

  /** 每个 videoId 的最新历史记录状态，一次性构建（O(n)）。 */
  const videoStatusMap = useMemo(() => {
    const map = new Map<string, ConcreteVideoStatus>();
    const latestById = new Map<string, HistoryRecord>();
    for (const h of history) {
      const cur = latestById.get(h.videoId);
      if (!cur || h.updatedAt > cur.updatedAt) latestById.set(h.videoId, h);
    }
    for (const latest of latestById.values()) {
      let status: ConcreteVideoStatus = 'unwatched';
      if (latest.duration > 0 && latest.progress >= latest.duration * 0.9) status = 'watched';
      else if (latest.progress > 0) status = 'watching';
      map.set(latest.videoId, status);
    }
    return map;
  }, [history]);

  const getVideoStatus = useCallback((videoId: string): ConcreteVideoStatus =>
    videoStatusMap.get(videoId) ?? 'unwatched',
  [videoStatusMap]);

  /** 视频收藏：应用搜索（综合用 all 关键词、视频 tab 用 video 关键词）+ 状态筛选 + 排序。
   *  状态筛选仅作用于影视项；直播分区恒全量。 */
  const collectedVideos = useMemo<CollectionVideoItem[]>(() => {
    let list: CollectionVideoItem[] = collections
      .filter((c: CollectionRecord) => c.type !== 'iptv')
      .map((c: CollectionRecord): CollectionVideoItem => {
        const status = getVideoStatus(c.videoId);
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
    const kw = searchByTab[mainTab === 'all' ? 'all' : 'video'] || '';
    if (kw.trim()) { const key = kw.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(key)); }
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
  }, [collections, searchByTab, mainTab, statusFilter, getVideoStatus, sortBy]);

  /** 直播收藏：应用搜索（综合用 all 关键词、iptv tab 用 iptv 关键词），按最后播放时间倒序。 */
  const favoriteChannels = useMemo(() => {
    let list = iptvChannels.filter(ch => ch.isFavorite);
    const kw = searchByTab[mainTab === 'all' ? 'all' : 'iptv'] || '';
    if (kw.trim()) { const key = kw.toLowerCase(); list = list.filter(ch => ch.name?.toLowerCase().includes(key)); }
    // 按最后播放时间倒序排列（最新的在前）
    list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return list;
  }, [iptvChannels, searchByTab, mainTab]);

  /** 视频收藏 ID 集合（综合 tab 批量删除时区分视频/IPTV 记录） */
  const videoIdSet = useMemo(() => new Set(collectedVideos.map((v) => v.id)), [collectedVideos]);

  /** 当前可见全集 ID（全选/批量栏计数用）：综合 = 视频 + IPTV 两类 id 全集 */
  const allIds = useMemo(
    () => [...collectedVideos.map((v) => v.id), ...favoriteChannels.map((c) => c.id)],
    [collectedVideos, favoriteChannels],
  );

  /** 融合 Tab 计数：综合 = 视频 + IPTV（视频已应用状态过滤与搜索）；视频/IPTV = 各自项数 */
  const fusedCounts = useMemo(() => ({
    all: collectedVideos.length + favoriteChannels.length,
    video: collectedVideos.length,
    iptv: favoriteChannels.length,
  }), [collectedVideos, favoriteChannels]);

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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [mainTab, searchByTab.all, searchByTab.video, searchByTab.iptv, statusFilter, sortBy]);

  // 综合下两分区各自懒加载分页；hasMore 取两区是否任一未加载完
  const displayedVideos = useMemo(() => collectedVideos.slice(0, visibleCount), [collectedVideos, visibleCount]);
  const displayedChannels = useMemo(() => favoriteChannels.slice(0, visibleCount), [favoriteChannels, visibleCount]);
  const hasMore = visibleCount < collectedVideos.length || visibleCount < favoriteChannels.length;
  const maxLenRef = useRef(0);
  maxLenRef.current = Math.max(collectedVideos.length, favoriteChannels.length);
  const loadMore = useCallback(() => {
    setVisibleCount((v) => Math.min(v + PAGE_SIZE, maxLenRef.current));
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
  const selectAll = () => setSelected(selected.size === allIds.length ? new Set() : new Set(allIds));

  // 根据确认类型执行删除（综合 tab 下 selected 跨两分区，按 id 归属分发）
  const executeDelete = useCallback(() => {
    if (confirmType === 'single' && pendingDelete) {
      if (pendingDelete.kind === 'video') removeCollection(pendingDelete.id);
      else toggleFavorite(pendingDelete.id);
    } else if (confirmType === 'batch') {
      selected.forEach((id) => {
        if (videoIdSet.has(id)) removeCollection(id);
        else toggleFavorite(id);
      });
      setSelected(new Set());
    } else if (confirmType === 'clearAll') {
      if (mainTab !== 'iptv') collections.filter((c) => c.type !== 'iptv').forEach((c) => removeCollection(c.videoId));
      if (mainTab !== 'video') clearFavorites();
    }
    setPendingDelete(null);
  }, [confirmType, pendingDelete, selected, mainTab, videoIdSet, removeCollection, toggleFavorite, clearFavorites, collections]);

  const handleSingleDelete = useCallback((id: string, kind: 'video' | 'iptv', e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDelete({ id, kind });
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
      ? `确定要删除选中的 ${selected.size} 个收藏吗？删除后无法恢复。`
      : '确定要清除所有收藏吗？此操作无法恢复。';

  // ── 顶部操作按钮组（更多筛选 / 清空收藏 / 批量管理） ─────────────────────
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
        <span className="action-btn__label">清空收藏</span>
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
      pageClassName="collection-page"
      fusedCategories={fusedCategories}
      actions={actions}
      isBatchMode={batchMode || batchIsExiting}
    >
      {/* 「更多筛选」折叠面板：状态 chips（仅影视）+ 排序（公共组件，与历史页一致） */}
      {filterOpen && (
        <RecordFilterPanel
          statusOptions={(['all', 'unwatched', 'watching', 'watched'] as VideoStatus[]).map((k) => ({
            key: k,
            label: STATUS_CONFIG[k].label,
            color: STATUS_CONFIG[k].color,
          }))}
          statusFilter={statusFilter}
          onStatusChange={(k) => setStatusFilter(k as VideoStatus)}
          sortOptions={SORT_OPTIONS}
          sortBy={sortBy}
          onSortChange={(v) => setSortBy(v as SortKey)}
        />
      )}
      {/* key=mainTab：仅「综合↔视频↔IPTV」切换时整体重挂载，触发卡片 stagger 出场动画重放；
         搜索/筛选/排序不重挂载、不误触发动画。综合 tab 下两分区各用原生网格，动画各自保留。 */}
      {userLoading ? (
        <div className="player-loading-wrap">
          <AppLoading tip="加载中…" showTip />
        </div>
      ) : allIds.length > 0 ? (
        <div key={mainTab} className="collection-content animate-fade-in">
          {mainTab !== 'iptv' && collectedVideos.length > 0 && (
            <section className="collection-section">
              <div className="collection-section-head">
                <span className="collection-section-head__title">影视</span>
                <span className="collection-section-head__count">共 {collectedVideos.length} 条</span>
              </div>
              <div className="video-card-grid">
                {displayedVideos.map((video) => (
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
                    <button className="record-card__delete" onClick={(e) => handleSingleDelete(video.id, 'video', e)} aria-label="删除"><Icon icon={Trash2} size="xs" /></button>
                    <VideoCard video={video} rating={video._rating} hideFavorite batchMode={batchMode} status={video._status} navigateTo={video._sourceIndex !== undefined ? `/play/${video.id}` : undefined} navigateState={video._sourceIndex !== undefined ? { sourceIndex: video._sourceIndex } : undefined} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {mainTab !== 'video' && favoriteChannels.length > 0 && (
            <section className="collection-section">
              <div className="collection-section-head">
                <span className="collection-section-head__title">直播</span>
                <span className="collection-section-head__count">共 {favoriteChannels.length} 个频道</span>
              </div>
              <div className="iptv-channel-grid iptv-channel-grid--batch">
                {displayedChannels.map((ch) => (
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
                    <button className="record-card__delete" onClick={(e) => handleSingleDelete(ch.id, 'iptv', e)} aria-label="删除"><Icon icon={Trash2} size="xs" /></button>
                    <IPTVChannelCard channel={ch} hideFavorite batchMode={batchMode} epgIndex={epgIndex} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <Empty
          title={statusFilter === 'all' ? '暂无收藏' : `暂无${STATUS_CONFIG[statusFilter].label}记录`}
          description={mainTab === 'video'
            ? '去首页发现喜欢的影片吧'
            : mainTab === 'iptv'
              ? '去 IPTV 页面收藏喜欢的频道吧'
              : '去首页发现喜欢的影片或频道吧'}
        />
      )}

      {allIds.length > 0 && <div ref={sentinelRef} aria-hidden="true" />}

      {(batchMode || batchIsExiting) && (
        <div className={`batch-action-bar${batchIsExiting ? ' batch-action-bar--exiting' : ''}`}>
          <button type="button" className="batch-action-btn" onClick={selectAll}>
            {selected.size === allIds.length && allIds.length > 0
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
