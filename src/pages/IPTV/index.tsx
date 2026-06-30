/**
 * IPTV 直播页面
 * 展示 IPTV 频道列表，支持分组筛选、关键词搜索、频道可用性检测和分页浏览
 *
 * 懒加载策略（v5 改造）：
 * - 移除所有 SkeletonCard 渲染（v3/v4 引入的灰色占位卡视作视觉噪音,本版本彻底移除）
 * - 触发懒加载 → setVisibleCount(v => v + IPTV_PAGE_SIZE) 立即同步追加真实频道
 * - 无 300ms 同步切片（切片目的就是"让用户先看清骨架",现在无骨架,切片无意义）
 * - 触发距离：100px = 距视口底 100px 时触发。比 200px 更接近底部，符合"几乎
 *   滚到底才加载"的体感,且 IO 缩小后 scroll 事件兜底仍能在 100px 范围内触达。
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavStore, useSettingsStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { getIPTVSources } from '@/services/sourceService';
import { getEPGCacheTime } from '@/services/epgService';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useIPTVAutoRefresh } from '@/hooks/useIPTVAutoRefresh';
import { AppLoading, Empty, BackToTopButton } from '@/components/common';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import GroupPicker from './GroupPicker';
import { useShallow } from 'zustand/react/shallow';
import { Search, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import './IPTV.css';

/** 防抖 Hook：延迟更新值，避免频繁触发搜索过滤 */
const MAX_VISIBLE_SOURCES = 6;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

/** 单次渲染的频道数；超过则通过哨兵滚动加载下一批 */
const IPTV_PAGE_SIZE = 60;

export default function IPTVPage() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  // 高频更新字段 (availabilityProgress) 与低频数据/动作分两组订阅,避免每频道
  // 检测时 progress 变化触发整页重渲染。
  const {
    channels,
    groups,
    isLoading,
    error,
    lastRefresh,
    refreshChannels,
    proxyUrl,
    aggregatorUrls,
    sourceNames,
    isCheckingAvailability,
    checkAvailability,
    abortAvailabilityCheck,
  } = useIPTVStore(
    useShallow((s) => ({
      channels: s.channels,
      groups: s.groups,
      isLoading: s.isLoading,
      error: s.error,
      lastRefresh: s.lastRefresh,
      refreshChannels: s.refreshChannels,
      proxyUrl: s.settings.proxyUrl,
      aggregatorUrls: s.settings.aggregatorUrls,
      sourceNames: s.settings.sourceNames,
      isCheckingAvailability: s.isCheckingAvailability,
      checkAvailability: s.checkAvailability,
      abortAvailabilityCheck: s.abortAvailabilityCheck,
    })),
  );
  // availabilityProgress 在检测时每频道回调一次,单独 selector 避免联动
  const availabilityProgress = useIPTVStore((s) => s.availabilityProgress);
  // 订阅 Settings 中的 IPTV 源索引，变化时同步 aggregatorUrls
  const iptvSourceIndices = useSettingsStore((s) => s.iptvSourceIndices);

  const { getState, saveState } = useNavStore();
  const saved = getState('iptv');
  const navigate = useNavigate();

  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    typeof saved?.filter?.group === 'string' ? saved.filter.group : null
  );
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState(saved?.search || '');
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [epgCacheTime, setEpgCacheTime] = useState<number | null>(null);

  useScrollRestore('iptv');
  const scrollContainerRef = useScrollContainer();

  useEffect(() => {
    return () => { saveState('iptv', { search: searchKeyword, filter: { group: selectedGroup } }); };
  }, [searchKeyword, selectedGroup, saveState]);

  // 优先从 IndexedDB 缓存加载（静默，不显示加载态）
  useEffect(() => {
    useIPTVStore.getState().loadFromCache();
  }, []);

  // 自动刷新频道列表
  useIPTVAutoRefresh();

  // 获取节目单缓存时间
  useEffect(() => {
    getEPGCacheTime().then(setEpgCacheTime);
  }, []);

  // 页面卸载时中止检测
  useEffect(() => {
    return () => {
      useIPTVStore.getState().abortAvailabilityCheck();
    };
  }, []);

  const debouncedKeyword = useDebounce(searchKeyword, 300);

  // 筛选变化时重置滚动到顶部
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedGroup, debouncedKeyword, scrollContainerRef]);

  const [visibleCount, setVisibleCount] = useState(IPTV_PAGE_SIZE);
  const [needCollapse, setNeedCollapse] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const groupsRef = useRef<HTMLDivElement>(null);

  /** 按分组、数据源和关键词筛选频道 */
  const filteredChannels = useMemo(() => {
    let result = channels;

    if (selectedSource) {
      result = result.filter(ch => ch.sourceId === selectedSource);
    }

    if (selectedGroup) {
      result = result.filter(ch => ch.group === selectedGroup);
    }

    if (debouncedKeyword) {
      const keyword = debouncedKeyword.toLowerCase();
      result = result.filter(ch => ch.name.toLowerCase().includes(keyword));
    }

    return result;
  }, [channels, selectedGroup, selectedSource, debouncedKeyword]);

  /** 按数据源筛选分组：选中特定源时只显示该源的分组 */
  const filteredGroups = useMemo(() => {
    if (!selectedSource) return groups;
    const sourceChannels = channels.filter(ch => ch.sourceId === selectedSource);
    const groupsMap = new Map<string, number>();
    sourceChannels.forEach(ch => {
      const g = ch.group || '未分组';
      groupsMap.set(g, (groupsMap.get(g) || 0) + 1);
    });
    return Array.from(groupsMap.entries()).map(([name, count]) => ({ name, count, channels: [] }));
  }, [channels, groups, selectedSource]);

  /** 每个数据源是否有频道数据 */
  const sourceHasChannels = useMemo(() => {
    if (!aggregatorUrls) return [];
    return aggregatorUrls.map((_, index) => {
      const sourceId = `source-${index}`;
      return channels.some(ch => ch.sourceId === sourceId);
    });
  }, [aggregatorUrls, channels]);

  /** 实际渲染的子集，由 useInfiniteScroll 滚动哨兵分批追加 */
  const displayedChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );
  const hasMore = visibleCount < filteredChannels.length;

  /** 检测分组标签区域是否溢出，需要折叠（通过 offsetTop 实测行数） */
  const checkGroupsOverflow = useCallback(() => {
    const el = groupsRef.current;
    if (!el || groups.length === 0) {
      setNeedCollapse(false);
      setCollapsedHeight(null);
      return;
    }

    const tags = el.querySelectorAll<HTMLElement>('.group-tag');
    if (tags.length === 0) {
      setNeedCollapse(false);
      setCollapsedHeight(null);
      return;
    }

    const rowTops = new Set<number>();
    tags.forEach(tag => rowTops.add(tag.offsetTop));
    const sortedTops = Array.from(rowTops).sort((a, b) => a - b);
    const rowCount = sortedTops.length;

    if (rowCount <= 2) {
      setNeedCollapse(false);
      setCollapsedHeight(null);
      return;
    }

    setNeedCollapse(true);
    setCollapsedHeight(sortedTops[2]);
  }, [groups.length]);

  useEffect(() => {
    const el = groupsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => checkGroupsOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkGroupsOverflow]);

  useEffect(() => {
    checkGroupsOverflow();
  }, [filteredGroups, checkGroupsOverflow]);

  /** Settings 中 IPTV 源索引变化时，同步更新 IPTV store 的 aggregatorUrls */
  useEffect(() => {
    if (!iptvSourceIndices || iptvSourceIndices.length === 0) return;
    getIPTVSources().then((sources) => {
      const validIndices = iptvSourceIndices.filter(i => sources[i]?.url);
      const urls = validIndices.map(i => sources[i]!.url);
      const names = validIndices.map(i => sources[i]!.name || `源 ${i + 1}`);
      const current = useIPTVStore.getState().settings;
      if (
        urls.length !== current.aggregatorUrls?.length ||
        urls.some((u, i) => u !== current.aggregatorUrls?.[i])
      ) {
        useIPTVStore.getState().setSettings({
          aggregatorUrl: urls[0] || '',
          aggregatorUrls: urls,
          sourceNames: names,
        });
      }
    });
  }, [iptvSourceIndices]);

  // 切换分组 / 搜索 / 源刷新时,把已渲染数重置回单批大小
  useEffect(() => {
    setVisibleCount(IPTV_PAGE_SIZE);
  }, [selectedGroup, debouncedKeyword, channels.length]);

  const { sentinelRef, resetLoading } = useInfiniteScroll({
    hasMore,
    isLoading: false,
    onLoadMore: () => {
      setVisibleCount((v) => v + IPTV_PAGE_SIZE);
      resetLoading();
    },
    scrollContainerRef,
    canLoadMore: !isLoading && channels.length > 0,
    rootMargin: '100px',
  });

  const handleSearch = useCallback((keyword: string) => {
    setSearchKeyword(keyword);
  }, []);

  const handleGroupSelect = useCallback((groupName: string | null) => {
    setSelectedGroup(groupName);
  }, []);

  const handleSourceSelect = useCallback((sourceId: string | null) => {
    setSelectedSource(sourceId);
    setSelectedGroup(null);
    setGroupsExpanded(false);
    useIPTVStore.getState().abortAvailabilityCheck();
  }, []);

  const availableCount = useMemo(() => {
    return filteredChannels.filter(ch => ch.isAvailable === true).length;
  }, [filteredChannels]);

  const handleCheckAvailability = useCallback(() => {
    checkAvailability(selectedGroup);
  }, [checkAvailability, selectedGroup]);

  return (
    <div className="iptv-page">
      <div className="iptv-header">
        <div className="iptv-header-top">
          <div className="iptv-header-left">
            <h1 className="page-title">IPTV 直播</h1>
          </div>
          <div className="iptv-header-meta">
            {lastRefresh && (
              <span className="last-refresh">
                源: {new Date(lastRefresh).toLocaleTimeString()}
              </span>
            )}
            {epgCacheTime && (
              <span className="last-refresh">
                节目单: {new Date(epgCacheTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        {!proxyUrl && (
          <span className="iptv-proxy-warning-inline">
            <AlertCircle size={14} />
            <span>IPTV流代理未配置，频道可能无法正常播放，请在设置中</span>
            <button className="iptv-proxy-warning-link" onClick={() => navigate('/settings', { viewTransition: true })}>
              配置
            </button>
          </span>
        )}
      </div>

      <div className="iptv-toolbar">
        <div className="search-box-wrap search-box-wrap--iptv" role="search">
          <div className="search-box search-box--iptv">
            <Search size={16} className="search-box__icon" aria-hidden="true" />
            <input
              type="text"
              className="search-box__input"
              placeholder="搜索频道..."
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              aria-label="搜索"
            />
            <button
              type="button"
              className="search-box__clear"
              onClick={() => handleSearch('')}
              aria-label="清空搜索"
              tabIndex={-1}
              aria-hidden={!searchKeyword}
              data-empty={searchKeyword ? 'false' : 'true'}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        {isCheckingAvailability ? (
          <button className="refresh-btn checking" onClick={abortAvailabilityCheck}>
            取消 ({availabilityProgress?.checked}/{availabilityProgress?.total})
          </button>
        ) : (
          <button className="refresh-btn" onClick={handleCheckAvailability} disabled={channels.length === 0}>
            检测{selectedGroup || '全部'}
          </button>
        )}
        <button className="refresh-btn" onClick={() => refreshChannels()}>
          刷新
        </button>
      </div>

      {isCheckingAvailability && availabilityProgress && (
        <div className="availability-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(availabilityProgress.checked / availabilityProgress.total) * 100}%` }}
            />
          </div>
          <span className="progress-text">
            检测中: {availabilityProgress.checked}/{availabilityProgress.total}
          </span>
        </div>
      )}

      {filteredChannels.length > 0 && filteredChannels.some(ch => ch.isAvailable !== undefined) && (
        <div className="availability-stats">
          <span className="stat available"><CheckCircle2 size={12} /><span>{availableCount}</span></span>
          <span className="stat unavailable"><XCircle size={12} /><span>{filteredChannels.length - availableCount}</span></span>
          <span className="stat total">共 {filteredChannels.length} 个</span>
        </div>
      )}

      {aggregatorUrls && aggregatorUrls.length > 1 && (
        <div className="iptv-source-filter">
          <button
            className={`source-tag ${selectedSource === null ? 'active' : ''}`}
            onClick={() => handleSourceSelect(null)}
          >
            全部源
          </button>
          {(sourcesExpanded ? aggregatorUrls : aggregatorUrls.slice(0, MAX_VISIBLE_SOURCES)).map((_, index) => {
            const hasData = sourceHasChannels[index];
            return (
              <button
                key={index}
                className={`source-tag${selectedSource === `source-${index}` ? ' active' : ''}${!hasData ? ' disabled' : ''}`}
                onClick={() => hasData && handleSourceSelect(`source-${index}`)}
                disabled={!hasData}
                title={!hasData ? '该源无频道数据或加载失败' : undefined}
              >
                {sourceNames?.[index] || `源 ${index + 1}`}
              </button>
            );
          })}
          {aggregatorUrls.length > MAX_VISIBLE_SOURCES && (
            <button
              type="button"
              className={`source-tag source-tag--more`}
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
            >
              {sourcesExpanded ? '收起' : `+${aggregatorUrls.length - MAX_VISIBLE_SOURCES}`}
            </button>
          )}
        </div>
      )}

      {filteredGroups.length > 0 && (
        isMobile ? (
          <GroupPicker
            key={selectedSource ?? 'all'}
            groups={filteredGroups}
            totalCount={selectedSource
              ? channels.filter(ch => ch.sourceId === selectedSource).length
              : channels.length}
            selectedGroup={selectedGroup}
            onSelect={handleGroupSelect}
          />
        ) : (
          <>
            <div
              className={`iptv-groups${needCollapse && !groupsExpanded ? ' collapsed' : ''}`}
              style={
                needCollapse && !groupsExpanded && collapsedHeight !== null
                  ? { maxHeight: collapsedHeight }
                  : !needCollapse
                    ? { marginBottom: 16 }
                    : undefined
              }
              ref={groupsRef}
            >
              <button
                className={`group-tag ${selectedGroup === null ? 'active' : ''}`}
                onClick={() => handleGroupSelect(null)}
              >
                全部 ({selectedSource ? channels.filter(ch => ch.sourceId === selectedSource).length : channels.length})
              </button>
              {filteredGroups.map((group) => (
                <button
                  key={group.name}
                  className={`group-tag ${selectedGroup === group.name ? 'active' : ''}`}
                  onClick={() => handleGroupSelect(group.name)}
                >
                  {group.name} ({group.count})
                </button>
              ))}
            </div>
            {needCollapse && (
              <button
                className="groups-toggle"
                onClick={() => setGroupsExpanded(!groupsExpanded)}
              >
                {groupsExpanded ? '收起分类 ▲' : `展开全部分类 (${filteredGroups.length}) ▼`}
              </button>
            )}
          </>
        )
      )}

      {isLoading && channels.length === 0 && (
        <div className="iptv-content-loading">
          <AppLoading tip="加载频道列表…" showTip />
        </div>
      )}
      <div className="iptv-content">
        {!isLoading && channels.length === 0 ? (
          <Empty
            title="暂无频道数据"
            description={error || '请点击上方刷新按钮加载频道列表'}
            onRetry={() => refreshChannels()}
          />
        ) : filteredChannels.length === 0 ? (
          <Empty title="暂无频道" description="尝试切换分组或清空搜索关键词" />
        ) : (
          <>
            <div className="iptv-channel-grid">
              {displayedChannels.map((channel) => (
                <IPTVChannelCard
                  key={channel.id}
                  channel={channel}
                />
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true" />
          </>
        )}
      </div>

      <BackToTopButton />
    </div>
  );
}
