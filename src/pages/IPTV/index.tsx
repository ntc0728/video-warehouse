/**
 * IPTV 直播页面
 * 展示 IPTV 频道列表，支持分组筛选、关键词搜索、频道可用性检测和分页浏览
 *
 * 懒加载策略（v5 改造）：
 * - 移除所有 SkeletonCard 渲染（v3/v4 引入的灰色占位卡视作视觉噪音,本版本彻底移除）
 * - 触发懒加载 → setVisibleCount(v => v + IPTV_PAGE_SIZE) 立即同步追加真实频道
 * - 无 300ms 同步切片（切片目的就是"让用户先看清骨架",现在无骨架,切片无意义）
 * - hint 文字态：
 *     有更多 → "已加载 X / Y"（继续滚动触发下一批）
 *     全部展示 → "已加载 X / Y · 已显示全部"
 * - 触发距离：100px = 距视口底 100px 时触发。比 200px 更接近底部，符合"几乎
 *   滚到底才加载"的体感,且 IO 缩小后 scroll 事件兜底仍能在 100px 范围内触达。
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIPTVStore, useNavStore, useSettingsStore } from '@/stores';
import { getIPTVSources } from '@/services/sourceService';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { Empty, AppLoading, BackToTopButton } from '@/components/common';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { useShallow } from 'zustand/react/shallow';
import { Search, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import './IPTV.css';

/** 防抖 Hook：延迟更新值，避免频繁触发搜索过滤 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

/** 从 URL 中提取主机名用于显示 */
function getDisplayHostname(url: string): string {
  if (url.startsWith('/')) {
    const match = url.match(/^\/([^/]+)/);
    return match ? match[1] : url;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 会话内"是否访问过 /iptv 页"标记。
 * useIPTVStore 用 localStorage 跨会话缓存了 channels 和 loadedUrl,
 * 仅靠"channels.length === 0"判断首次进入在有缓存时不会触发 refreshChannels。
 * 用 sessionStorage 显式追踪会话内首次进入,保证按当前 aggregatorUrl 拉一次。
 */
const IPTV_SESSION_KEY = 'iptv-page-visited-this-session';

/** 单次渲染的频道数；超过则通过哨兵滚动加载下一批 */
const IPTV_PAGE_SIZE = 60;

export default function IPTVPage() {
  // 高频更新字段 (availabilityProgress) 与低频数据/动作分两组订阅,避免每频道
  // 检测时 progress 变化触发整页重渲染。
  const {
    channels,
    groups,
    isLoading,
    error,
    lastRefresh,
    loadedUrl,
    refreshChannels,
    settings,
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
      loadedUrl: s.loadedUrl,
      refreshChannels: s.refreshChannels,
      settings: s.settings,
      isCheckingAvailability: s.isCheckingAvailability,
      checkAvailability: s.checkAvailability,
      abortAvailabilityCheck: s.abortAvailabilityCheck,
    })),
  );
  // availabilityProgress 在检测时每频道回调一次,单独 selector 避免联动
  const availabilityProgress = useIPTVStore((s) => s.availabilityProgress);

  const { getState, saveState } = useNavStore();
  const saved = getState('iptv');
  const navigate = useNavigate();

  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    typeof saved?.filter?.group === 'string' ? saved.filter.group : null
  );
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState(saved?.search || '');
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  useScrollRestore('iptv');
  const scrollContainerRef = useScrollContainer();

  useEffect(() => {
    return () => { saveState('iptv', { search: searchKeyword, filter: { group: selectedGroup } }); };
  }, [searchKeyword, selectedGroup, saveState]);

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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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

    // 收集所有标签的 offsetTop，去重后即为实际行数
    const rowTops = new Set<number>();
    tags.forEach(tag => rowTops.add(tag.offsetTop));
    const sortedTops = Array.from(rowTops).sort((a, b) => a - b);
    const rowCount = sortedTops.length;

    if (rowCount <= 2) {
      setNeedCollapse(false);
      setCollapsedHeight(null);
      return;
    }

    // 超过 2 行：第 3 行的 offsetTop 即为前 2 行的完整高度
    setNeedCollapse(true);
    setCollapsedHeight(sortedTops[2]);
  }, [groups.length]);

  // 用 ResizeObserver 替代 window.resize 监听,只观察分组容器自身尺寸变化,
  // 减少每次窗口 resize 时对整页的影响,降低主线程压力。
  useEffect(() => {
    const el = groupsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => checkGroupsOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkGroupsOverflow]);

  /**
   * 数据加载调度（合并原"首次进入"和"源切换"两个 useEffect）
   *
   * 优先级：
   *   1. isLoading → 早退
   *   2. 会话内首次进入（!sessionStorage[IPTV_SESSION_KEY]）→ 写标记 + 先读缓存再后台刷新
   *   3. 源已匹配（loadedUrl === aggregatorUrl） → 早退（命中缓存）
   *   4. loadedUrl === null && channels.length === 0 → 早退（首装首次由步骤 2 处理）
   *   5. 源切换 → refreshChannels
   */
  useEffect(() => {
    if (isLoading || error) return;

    // 会话内首次进入：先读缓存，再后台刷新
    if (!sessionStorage.getItem(IPTV_SESSION_KEY)) {
      sessionStorage.setItem(IPTV_SESSION_KEY, '1');
      setIsInitialLoad(true);

      // aggregatorUrl 为空时，从源列表初始化
      if (!settings.aggregatorUrl) {
        const iptvSourceIndex = useSettingsStore.getState().iptvSourceIndex;
        getIPTVSources().then((sources) => {
          const url = sources[iptvSourceIndex]?.url || sources[0]?.url || '';
          if (url) {
            useIPTVStore.getState().setSettings({ aggregatorUrl: url });
          }
          // 先读缓存
          useIPTVStore.getState().loadFromCache().then((hitCache) => {
            if (hitCache) setIsInitialLoad(false);
            // 后台刷新
            refreshChannels();
          });
        });
        return;
      }

      // 先读缓存
      useIPTVStore.getState().loadFromCache().then((hitCache) => {
        if (hitCache) setIsInitialLoad(false);
        // 后台刷新
        refreshChannels();
      });
      return;
    }

    // 源未变：早退,沿用缓存
    if (loadedUrl === settings.aggregatorUrl) return;

    // 边缘场景:loadedUrl 仍为 null 但 channels 非空（理论不应发生,防御性早退）
    if (loadedUrl === null && channels.length === 0) return;

    // 源切换:刷新
    setIsInitialLoad(true);
    refreshChannels();
  }, [loadedUrl, settings.aggregatorUrl, isLoading, channels.length, refreshChannels, error]);

  /** 首次加载完成后标记 */
  useEffect(() => {
    if (!isLoading && channels.length > 0 && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isLoading, channels.length, isInitialLoad]);

  // 源切换后分组列表变化，若已选分组不再存在则重置为"全部"
  useEffect(() => {
    if (selectedGroup && groups.length > 0 && !groups.some(g => g.name === selectedGroup)) {
      setSelectedGroup(null);
    }
  }, [groups, selectedGroup]);

  // 切换分组 / 搜索 / 源刷新时,把已渲染数重置回单批大小,
  // 避免用户回到筛选结果时还停留在上一次滚动到的位置。
  useEffect(() => {
    setVisibleCount(IPTV_PAGE_SIZE);
  }, [selectedGroup, debouncedKeyword, channels.length]);

  const { sentinelRef, resetLoading } = useInfiniteScroll({
    hasMore,
    isLoading: false,           // 永远 false（v5: 懒加载追加真实频道是同步的,无 loading 中间态）
    onLoadMore: () => {
      // v5: 触发懒加载 → 立即追加真实频道（无 setTimeout 切片,无骨架）
      setVisibleCount((v) => v + IPTV_PAGE_SIZE);
      // 同步场景:onLoadMore 不经过异步,立刻释放 pageLoadingRef
      // 让哨兵再次可见时能继续触发下一批
      resetLoading();
    },
    scrollContainerRef,
    canLoadMore: !isLoading && !isInitialLoad,
    // 触发距离: 100px = "距视口底 100px 时就触发" 的预加载区
    // 太大(200px/400px)会让用户觉得"还没滚到就加载了"或"已经滚了一段才加载"。
    // 100px 接近底部,符合"滚到底前一点点就加载"的体感,scroll 事件兜底
    // (FALLBACK_THRESHOLD_PX=200) 仍能在 100-200px 范围内触达,不会留白。
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

  const hasNoData = !isLoading && channels.length === 0;
  const isInitialLoadingState = isLoading && channels.length === 0;

  return (
    <div className="iptv-page">
      {!isInitialLoadingState && (
        <div className="iptv-header">
          <div className="iptv-header-top">
            <h1 className="page-title">IPTV 直播</h1>
            <div className="iptv-header-meta">
              {lastRefresh && (
                <span className="last-refresh">
                  更新: {new Date(lastRefresh).toLocaleTimeString()}
                </span>
              )}
              <span className="source-url" title={settings.aggregatorUrl}>
                源: {getDisplayHostname(settings.aggregatorUrl)}
              </span>
            </div>
          </div>
          {!settings.proxyUrl && (
            <span className="iptv-proxy-warning-inline">
              <AlertCircle size={14} />
              <span>IPTV流代理未配置，频道可能无法正常播放，请在设置中</span>
              <button className="iptv-proxy-warning-link" onClick={() => navigate('/settings', { viewTransition: true })}>
                配置
              </button>
            </span>
          )}
        </div>
      )}

      {!hasNoData && !isInitialLoadingState && (
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
          <button className="refresh-btn" onClick={() => refreshChannels()} disabled={isLoading}>
            {isLoading ? '刷新中...' : '刷新'}
          </button>
        </div>
      )}

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

      {!hasNoData && !isInitialLoadingState && (
        <>
          {settings.aggregatorUrls && settings.aggregatorUrls.length > 1 && (
            <div className="iptv-source-filter">
              <button
                className={`source-tag ${selectedSource === null ? 'active' : ''}`}
                onClick={() => handleSourceSelect(null)}
              >
                全部源
              </button>
              {settings.aggregatorUrls.map((_, index) => (
                <button
                  key={index}
                  className={`source-tag ${selectedSource === `source-${index}` ? 'active' : ''}`}
                  onClick={() => handleSourceSelect(`source-${index}`)}
                >
                  {settings.sourceNames?.[index] || `源 ${index + 1}`}
                </button>
              ))}
            </div>
          )}

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
              全部 ({selectedSource ? filteredChannels.length : channels.length})
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
      )}

      <div className="iptv-content">
        {isLoading ? (
          <AppLoading />
        ) : channels.length === 0 ? (
          <Empty
            title="无法获取频道列表"
            description={error || '请检查网络连接或点击刷新按钮重试'}
            onRetry={() => refreshChannels()}
          />
        ) : filteredChannels.length === 0 ? (
          <Empty title="暂无频道" description="尝试切换分组或清空搜索关键词" />
        ) : (
          <>
            {/*
              v5: 无骨架渲染。
              IPTV 频道数据是本地解析的 M3U8 列表,首次 refreshChannels 后 channels 一次性就位,
              懒加载只是把已经存在的频道从 visibleCount 切到下批,不存在"等待后端返回"阶段,
              因此不需要 SkeletonCard 过渡,直接展示真实频道。
            */}
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
