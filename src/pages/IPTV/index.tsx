/**
 * IPTV 直播页面
 * 展示 IPTV 频道列表，支持分组筛选、关键词搜索、频道可用性检测和分页浏览
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useIPTVStore, useNavStore } from '@/stores';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { Empty, AppLoading, BackToTop } from '@/components/common';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useShallow } from 'zustand/react/shallow';
import { X, CheckCircle2, XCircle } from 'lucide-react';
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

  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    typeof saved?.filter?.group === 'string' ? saved.filter.group : null
  );
  const [searchKeyword, setSearchKeyword] = useState(saved?.search || '');
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  useScrollRestore('iptv');
  const scrollContainerRef = useScrollContainer();

  useEffect(() => {
    return () => { saveState('iptv', { search: searchKeyword, filter: { group: selectedGroup } }); };
  }, [searchKeyword, selectedGroup, saveState]);

  const debouncedKeyword = useDebounce(searchKeyword, 300);

  // 筛选变化时重置滚动到顶部
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedGroup, debouncedKeyword, scrollContainerRef]);

  const [needCollapse, setNeedCollapse] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const groupsRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();

  /** 按分组和关键词筛选频道 */
  const filteredChannels = useMemo(() => {
    let result = channels;

    if (selectedGroup) {
      result = result.filter(ch => ch.group === selectedGroup);
    }

    if (debouncedKeyword) {
      const keyword = debouncedKeyword.toLowerCase();
      result = result.filter(ch => ch.name.toLowerCase().includes(keyword));
    }

    return result;
  }, [channels, selectedGroup, debouncedKeyword]);

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
   *   2. 会话内首次进入（!sessionStorage[IPTV_SESSION_KEY]）→ 写标记 + 强制 refreshChannels
   *   3. 源已匹配（loadedUrl === aggregatorUrl） → 早退（命中缓存）
   *   4. loadedUrl === null && channels.length === 0 → 早退（首装首次由步骤 2 处理）
   *   5. 源切换 → refreshChannels
   */
  useEffect(() => {
    if (isLoading) return;

    // 会话内首次进入：强制按当前 aggregatorUrl 拉一次
    if (!sessionStorage.getItem(IPTV_SESSION_KEY)) {
      sessionStorage.setItem(IPTV_SESSION_KEY, '1');
      setIsInitialLoad(true);
      refreshChannels();
      return;
    }

    // 源未变：早退,沿用缓存
    if (loadedUrl === settings.aggregatorUrl) return;

    // 边缘场景:loadedUrl 仍为 null 但 channels 非空（理论不应发生,防御性早退）
    if (loadedUrl === null && channels.length === 0) return;

    // 源切换:刷新
    setIsInitialLoad(true);
    refreshChannels();
  }, [loadedUrl, settings.aggregatorUrl, isLoading, channels.length, refreshChannels]);

  /** 首次加载完成后标记 */
  useEffect(() => {
    if (!isLoading && channels.length > 0 && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isLoading, channels.length, isInitialLoad]);

  const handleSearch = useCallback((keyword: string) => {
    setSearchKeyword(keyword);
  }, []);

  const handleGroupSelect = useCallback((groupName: string | null) => {
    setSelectedGroup(groupName);
  }, []);

  const availableCount = useMemo(() => {
    return filteredChannels.filter(ch => ch.isAvailable === true).length;
  }, [filteredChannels]);

  const handleCheckAvailability = useCallback(() => {
    checkAvailability(selectedGroup);
  }, [checkAvailability, selectedGroup]);

  const hasNoData = !isLoading && channels.length === 0;

  return (
    <div className="iptv-page">
      <div className="iptv-header">
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

      {!hasNoData && (
        <div className="iptv-toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            {searchKeyword && (
              <button className="search-clear" onClick={() => handleSearch('')}><X size={10} /></button>
            )}
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
          <span className="stat available"><CheckCircle2 size={12} /> {availableCount}</span>
          <span className="stat unavailable"><XCircle size={12} /> {filteredChannels.length - availableCount}</span>
          <span className="stat total">共 {filteredChannels.length} 个</span>
        </div>
      )}

      {!hasNoData && (
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
              全部 ({channels.length})
            </button>
            {groups.map((group) => (
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
              {groupsExpanded ? '收起分类 ▲' : `展开全部分类 (${groups.length}) ▼`}
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
          <div className="iptv-channel-grid">
            {filteredChannels.map((channel, idx) => (
              <IPTVChannelCard key={channel.id} channel={channel} index={idx} />
            ))}
          </div>
        )}

      </div>

      {isMobile && <BackToTop scrollRef={scrollContainerRef} />}
    </div>
  );
}
