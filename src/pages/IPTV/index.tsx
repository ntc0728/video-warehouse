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
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { getEPGCacheTime, fetchAndParseEPG, buildEPGChannelIndex } from '@/services/epgService';
import type { EPGChannelInfo, EPGChannelIndex } from '@/services/epgService';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDocumentTitle } from '@/hooks';
import { useIPTVAutoRefresh } from '@/hooks/useIPTVAutoRefresh';
import { AppLoading, Empty, BackToTopButton } from '@/components/common';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { useIsMobileLayout } from '@/hooks/useMediaQuery';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import GroupPicker from './GroupPicker';
import { useShallow } from 'zustand/react/shallow';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import './IPTV.css';
import { Icon } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';

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
  // 9.1：布局判断统一 useIsMobileLayout（app 端恒真，横屏不误判桌面）
  const isMobile = useIsMobileLayout();
  const pageRef = useRef<HTMLDivElement>(null);

  useDocumentTitle();
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
    checkingGroupId,
    checkAvailability,
    abortAvailabilityCheck,
    availabilityResults,
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
      checkingGroupId: s.checkingGroupId,
      checkAvailability: s.checkAvailability,
      abortAvailabilityCheck: s.abortAvailabilityCheck,
      availabilityResults: s.availabilityResults,
    })),
  );
  // availabilityProgress 在检测时每频道回调一次,单独 selector 避免联动
  const availabilityProgress = useIPTVStore((s) => s.availabilityProgress);

  const { getState, saveState } = useNavStore();
  const saved = getState('iptv');
  const navigate = useCustomNavigate();
  const location = useLocation();

  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    typeof saved?.filter?.group === 'string' ? saved.filter.group : null
  );
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [epgCacheTime, setEpgCacheTime] = useState<number | null>(null);
  // EPG 频道列表（含 XMLTV icon）：供卡片台标二级回退，随下方 EPG 刷新 effect 懒加载
  const [epgChannels, setEpgChannels] = useState<EPGChannelInfo[]>([]);

  // EPG 频道预索引：一次性构建，卡片台标二级回退 O(1) 匹配，避免每卡片全量遍历数千 EPG 频道
  const epgIndex: EPGChannelIndex | undefined = useMemo(
    () => (epgChannels.length > 0 ? buildEPGChannelIndex(epgChannels) : undefined),
    [epgChannels]
  );

  const scrollContainerRef = useScrollContainer();
  useScrollRestore('iptv');

  // 下拉刷新：重新拉取 IPTV 频道列表
  usePullToRefresh(() => useIPTVStore.getState().refreshChannels());

  useEffect(() => {
    return () => { saveState('iptv', { search: searchKeyword, filter: { group: selectedGroup } }); };
  }, [searchKeyword, selectedGroup, saveState]);

  // [2026-08-13] 惰性 bootstrap iptv/epg 场景：IPTV 页需要 iptv-sources.json（频道源）与
  // epg-sources.json（节目单）。不再由 main.tsx 全局拉取，改为场景级幂等触发
  // （bootstrapScene 每场景仅执行一次）。先注入源（syncConsumers 回写 aggregatorUrls /
  // epgUrls），再加载频道缓存——避免新用户 aggregatorUrls 尚未注入就 refresh 空源。
  useEffect(() => {
    const sm = useSourceManagerStore.getState();
    const run = async () => {
      await Promise.all([sm.bootstrapScene('iptv'), sm.bootstrapScene('epg')]);
      const loaded = await useIPTVStore.getState().loadFromCache();
      if (!loaded) await useIPTVStore.getState().refreshChannels();
      // 首屏引导完成：在此之前 channels 为空且未加载，应显示整页 loading 而非 <Empty>，
      // 避免首访先闪「暂无频道数据」再被数据/loading 替换的视觉跳变（方案 E）。
      setBootstrapped(true);
    };
    void run();
  }, []);

  // 自动刷新频道列表
  useIPTVAutoRefresh();

  // 获取节目单缓存时间；同时后台校验 EPG 是否过期（fetchAndParseEPG 内部带
  // epgUpdateInterval TTL 判断：未过期直接返回缓存、零网络请求；过期才重新拉取），
  // 使「只逛列表页」的用户也能让节目单数据保持新鲜；顺带把 EPG 频道列表（含 icon）
  // 交给卡片做台标二级回退。
  useEffect(() => {
    getEPGCacheTime().then(setEpgCacheTime);
    fetchAndParseEPG()
      .then((data) => {
        setEpgChannels(data.channels);
        return getEPGCacheTime().then(setEpgCacheTime);
      })
      .catch(() => { /* 刷新失败保持原缓存时间显示 */ });
  }, []);

  // 离开 IPTV 页（Keep-Alive 下组件不卸载，unmount 清理不会执行）或真实卸载时中止检测
  useEffect(() => {
    if (location.pathname !== '/iptv') {
      useIPTVStore.getState().abortAvailabilityCheck();
    }
    return () => {
      useIPTVStore.getState().abortAvailabilityCheck();
    };
  }, [location.pathname]);

  const debouncedKeyword = useDebounce(searchKeyword, 300);

  // 筛选变化时重置滚动到顶部（仅在本页为活动路由时执行；
  // 离开 IPTV 页时“清空筛选”会把 selectedGroup 置空并触发本 effect，
  // 若此时对共享滚动容器做平滑滚回顶部，会出现“先滑回顶部再跳转”的观感，故加守卫）
  useEffect(() => {
    if (location.pathname !== '/iptv') return;
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedGroup, debouncedKeyword, scrollContainerRef, location.pathname]);

  const [visibleCount, setVisibleCount] = useState(IPTV_PAGE_SIZE);
  const [bootstrapped, setBootstrapped] = useState(false);

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

  // 注册顶部导航栏搜索回调（仅当前路由匹配时注册，防止 Keep-Alive 下离开页面后重注册）
  useEffect(() => {
    if (location.pathname !== '/iptv') return;
    const store = usePageSearchStore.getState();
    store.setPageSearch(searchKeyword, handleSearch, '搜索频道...');
    return () => { store.clearPageSearch(); };
  }, [searchKeyword, handleSearch, location.pathname]);

  const handleGroupSelect = useCallback((groupName: string | null) => {
    setSelectedGroup(groupName);
  }, []);

  const handleSourceSelect = useCallback((sourceId: string | null) => {
    setSelectedSource(sourceId);
    // 如果当前选中的分组属于新源，则保留；否则清空
    setSelectedGroup((prev) => {
      if (prev === null) return null;
      const sourceGroups = new Set(
        channels
          .filter(ch => sourceId === null || ch.sourceId === sourceId)
          .map(ch => ch.group || '未分组')
      );
      return sourceGroups.has(prev) ? prev : null;
    });
    useIPTVStore.getState().abortAvailabilityCheck();
  }, [channels]);

  // 当前 tab（分组）的检测结果：key = selectedGroup（'__all__' 表示全部）。
  // 每个 tab 的检测结果独立存储于 availabilityResults，切换 tab 互不干扰。
  const currentGroupResults = useMemo(() => {
    const key = selectedGroup || '__all__';
    return availabilityResults[key] ?? {};
  }, [availabilityResults, selectedGroup]);

  const availableCount = useMemo(() => {
    return filteredChannels.filter(ch => currentGroupResults[ch.id] === true).length;
  }, [filteredChannels, currentGroupResults]);

  const handleCheckAvailability = useCallback(() => {
    checkAvailability(selectedGroup);
  }, [checkAvailability, selectedGroup]);

  // F3（2026-08-04）：首次进入且无频道数据时显示「整页全局 loading」——
  // 不渲染 .iptv-top-card（避免空数据筛选卡）也不显示网格区局部 AppLoading，
  // 与 Home/Detail 首屏 loading 风格一致（内联居中于页面容器内）。
  // 仅「首次加载且无数据」走此分支；已有数据后的刷新（isLoading 且 channels 非空）
  // 保持下方 .iptv-grid-card 内局部 loading 语义不变。
  if ((isLoading || !bootstrapped) && channels.length === 0) {
    return (
      <div ref={pageRef} className="page-padding iptv-page">
        <AppLoading tip="加载频道列表…" showTip />
      </div>
    );
  }

  return (
    <div ref={pageRef} className="page-padding iptv-page">
        <div className="iptv-top-card">
          <div className="iptv-header">
            {!proxyUrl && (
              <span className="iptv-proxy-warning-inline">
                <Icon icon={AlertCircle} size="xs" />
                <span>IPTV流代理未配置，频道可能无法正常播放，请在设置中</span>
                <button className="iptv-proxy-warning-link" onClick={() => navigate('/settings?tab=iptv')}>
                  配置
                </button>
              </span>
            )}
          </div>

        {aggregatorUrls && aggregatorUrls.length > 1 && (
          <div className={`iptv-source-filter${channels.length === 0 ? ' disabled' : ''}`}>
            <button
              className={`iptv-filter-tag source-tag ${selectedSource === null ? 'active' : ''}${channels.length === 0 ? ' disabled' : ''}`}
              onClick={() => handleSourceSelect(null)}
              disabled={channels.length === 0}
            >
              全部源
            </button>
            {(sourcesExpanded ? aggregatorUrls : aggregatorUrls.slice(0, MAX_VISIBLE_SOURCES)).map((_, index) => {
              const hasData = sourceHasChannels[index];
              const noChannels = channels.length === 0;
              return (
                <button
                  key={index}
                  className={`iptv-filter-tag source-tag${selectedSource === `source-${index}` ? ' active' : ''}${!hasData || noChannels ? ' disabled' : ''}`}
                  onClick={() => hasData && !noChannels && handleSourceSelect(`source-${index}`)}
                  disabled={!hasData || noChannels}
                  title={!hasData ? '该源无频道数据或加载失败' : noChannels ? '暂无频道数据' : undefined}
                >
                  {sourceNames?.[index] || `源 ${index + 1}`}
                </button>
              );
            })}
            {aggregatorUrls.length > MAX_VISIBLE_SOURCES && (
              <button
                type="button"
                className={`iptv-filter-tag source-tag source-tag--more${channels.length === 0 ? ' disabled' : ''}`}
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                disabled={channels.length === 0}
              >
                {sourcesExpanded ? '收起' : `+${aggregatorUrls.length - MAX_VISIBLE_SOURCES}`}
              </button>
            )}
          </div>
        )}

        {channels.length > 0 && filteredGroups.length > 0 && (
          <GroupPicker
            groups={filteredGroups}
            totalCount={selectedSource
              ? channels.filter(ch => ch.sourceId === selectedSource).length
              : channels.length}
            selectedGroup={selectedGroup}
            onSelect={handleGroupSelect}
            mode={isMobile ? 'bottom-sheet' : 'popup'}
          />
        )}

        {/* ── 操作行：按钮（居中）+ 时间信息（右对齐） ── */}
        <div className="iptv-actions-row">
          <div className="iptv-actions-buttons">
            {(isCheckingAvailability && checkingGroupId === (selectedGroup || '__all__')) ? (
              <button className="refresh-btn checking" onClick={abortAvailabilityCheck}>
                取消 ({availabilityProgress?.checked}/{availabilityProgress?.total})
              </button>
            ) : (
              <button className="refresh-btn" onClick={handleCheckAvailability} disabled={channels.length === 0 || isLoading || isCheckingAvailability}>
                检测{selectedGroup || '全部'}
              </button>
            )}
            <button className="refresh-btn" onClick={() => refreshChannels()} disabled={isLoading}>
              刷新
            </button>
          </div>
        </div>

        {/* ── 检测信息（仅当前分组） ── */}
        {isCheckingAvailability && checkingGroupId === (selectedGroup || '__all__') && availabilityProgress && (
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

        {filteredChannels.length > 0 && Object.keys(currentGroupResults).length > 0 && (
          <div className="availability-stats">
            <span className="stat available"><Icon icon={CheckCircle2} size="xs" /><span>{availableCount}</span></span>
            <span className="stat unavailable"><Icon icon={XCircle} size="xs" /><span>{filteredChannels.length - availableCount}</span></span>
            <span className="stat total">共 {filteredChannels.length} 个</span>
          </div>
        )}
      </div>

      <div className="iptv-grid-card">
        {isLoading && (
          <div className="iptv-content-loading">
            <AppLoading tip="加载频道列表…" showTip />
          </div>
        )}
        {!isLoading && (
          <div className="iptv-content">
            {(lastRefresh || epgCacheTime) && (
              <div className="iptv-content-meta">
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
            )}
            {channels.length === 0 ? (
              <Empty
                title="暂无频道数据"
                description={error || '请点击上方刷新按钮加载频道列表'}
              />
            ) : filteredChannels.length === 0 ? (
              <Empty title="暂无频道" description="尝试切换分组或清空搜索关键词" />
            ) : (
              <>
                {/* key 由「分组 + 源 + 关键词」构成：切换任一筛选时重挂载网格，
                    触发与收藏页视频 tab 一致的过场动画——容器 animate-fade-in（整体淡入）
                    + 卡片 animate-card-enter（cardFadeIn）；content-visibility 保证
                    仅可见卡片参与动画渲染 */}
                <div
                  key={`${selectedGroup ?? '__all__'}-${selectedSource ?? '__all__'}-${debouncedKeyword}`}
                  className="iptv-channel-grid animate-fade-in"
                >
                  {displayedChannels.map((channel) => (
                    <IPTVChannelCard
                      key={channel.id}
                      channel={channel}
                      // 传入当前组该频道的检测结果（独立于其他 tab）
                      availability={currentGroupResults[channel.id]}
                      // EPG 频道列表 + 预索引：台标二级回退（EPG XMLTV icon）
                      epgChannels={epgChannels}
                      epgIndex={epgIndex}
                    />
                  ))}
                </div>

                <div ref={sentinelRef} aria-hidden="true" />
              </>
            )}
          </div>
        )}
      </div>

      <BackToTopButton />
    </div>
  );
}
