/**
 * IPTV 直播页面
 * 展示 IPTV 频道列表，支持分组筛选、关键词搜索和分页浏览
 *
 * [2026-09-08] 页面大改（demo 终稿：changelogs/demos/demo-iptv-rail-2026-09-08.html）：
 * - 桌面端（≥1024 且非 TV/App）：左侧 176px 固定文本分类左栏（全部/央视CCTV/主流卫视/
 *   地方卫视/港澳台/体育/影视/少儿/新闻/我的收藏）+「更多台」多选源（设置页已启用的
 *   IPTV 源，最多 3 个）；内容区按分类分节展示；右上角下拉框仅按源过滤当前列表。
 * - 移动端 / App / TV：保留原布局（数据源 chips + GroupPicker + 单网格）。
 * - 可用性检测全链路移除（后台预检测、检测按钮、进度条、可用/不可用统计）。
 *
 * 懒加载策略（v5 改造）：
 * - 触发懒加载 → setVisibleCount(v => v + IPTV_PAGE_SIZE) 立即同步追加真实频道
 * - 触发距离：100px = 距视口底 100px 时触发
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { useNavStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { getEPGCacheTime, fetchAndParseEPG } from '@/services/epgService';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDocumentTitle } from '@/hooks';
import { useIPTVAutoRefresh } from '@/hooks/useIPTVAutoRefresh';
import { AppLoading, Empty, BackToTopButton } from '@/components/common';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import GroupPicker from './GroupPicker';
import { useShallow } from 'zustand/react/shallow';
import { AlertCircle } from 'lucide-react';
import './IPTV.css';
import { Icon } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';
import { IPTV_CATEGORIES, inCategory, type IptvCategoryKey } from './categories';

/** 移动端数据源 chips 最多直接展示的数量（超出折叠为 +N） */
const MAX_VISIBLE_SOURCES = 6;

/** 单次渲染的频道数；超过则通过哨兵滚动加载下一批 */
const IPTV_PAGE_SIZE = 60;

export default function IPTVPage() {
  // 9.1：布局判断统一 useIsMobileLayout（app 端恒真，横屏不误判桌面）
  const isMobile = useIsMobileLayout();
  const isTV = useIsTV();
  // 桌面左栏布局：≥1024 视口且非移动布局、非 TV（TV 遥控场景保留旧布局）
  const isDesktopRail = !isMobile && !isTV;
  const pageRef = useRef<HTMLDivElement>(null);

  useDocumentTitle();
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
    sourceChannels,
    extraSourceIds,
    toggleExtraSource,
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
      // 「更多台」按源勾选（设置页已启用的 IPTV 源，最多 3 个）
      sourceChannels: s.sourceChannels,
      extraSourceIds: s.extraSourceIds,
      toggleExtraSource: s.toggleExtraSource,
    })),
  );

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
  // 桌面左栏选中的频道分类（固定文本，与移动端 GroupPicker 的 M3U 分组互不相干）
  const [selectedCat, setSelectedCat] = useState<IptvCategoryKey>('__all__');

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
  // 使「只逛列表页」的用户也能让节目单数据保持新鲜。
  // 注意：EPG 频道列表不再喂给卡片做台标（台标只来自 iptv-org logos.json）。
  useEffect(() => {
    getEPGCacheTime().then(setEpgCacheTime);
    fetchAndParseEPG()
      .then(() => getEPGCacheTime().then(setEpgCacheTime))
      .catch(() => { /* 刷新失败保持原缓存时间显示 */ });
  }, []);

  const debouncedKeyword = useDebounce(searchKeyword, 300);

  // 筛选变化时重置滚动到顶部（仅在本页为活动路由时执行；
  // 离开 IPTV 页时“清空筛选”会把 selectedGroup 置空并触发本 effect，
  // 若此时对共享滚动容器做平滑滚回顶部，会出现“先滑回顶部再跳转”的观感，故加守卫）
  useEffect(() => {
    if (location.pathname !== '/iptv') return;
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedGroup, selectedCat, debouncedKeyword, scrollContainerRef, location.pathname]);

  const [visibleCount, setVisibleCount] = useState(IPTV_PAGE_SIZE);
  const [bootstrapped, setBootstrapped] = useState(false);

  /** 源 id（`source-${index}`）→ 展示名（设置页配置的源名，兜底「源 N」） */
  const sourceNameOf = useCallback(
    (sourceId: string) => {
      const index = Number(sourceId.replace('source-', ''));
      return sourceNames?.[index] || `源 ${index + 1}`;
    },
    [sourceNames]
  );

  /** 更多台勾选：切换选中态 + 数据缺失时按需拉取该源（缓存无 bySource / 竞速被放弃的源） */
  const handleToggleExtraSource = useCallback((sourceId: string) => {
    toggleExtraSource(sourceId);
    void useIPTVStore.getState().ensureSourceChannels(sourceId);
  }, [toggleExtraSource]);

  /**
   * 主干频道过滤：源过滤（两端共用）+ 关键词 + 勾选的「更多台」源频道合并。
   * 勾选本地源后，该源频道追加到主干列表一并参与分类计数、搜索和 card 渲染；
   * 取消勾选则移除。桌面端分类过滤在分节时应用（inCategory）；移动端叠加 selectedGroup。
   */
  const mainChannels = useMemo(() => {
    // 把勾选的「更多台」源频道拼接到主干后面（sourceChannels 已按源去重）
    const extra = extraSourceIds.flatMap(id => sourceChannels[id] ?? []);
    let result = [...channels, ...extra];
    if (selectedSource) {
      result = result.filter(ch => ch.sourceId === selectedSource);
    }
    if (debouncedKeyword) {
      const keyword = debouncedKeyword.toLowerCase();
      result = result.filter(ch => ch.name.toLowerCase().includes(keyword));
    }
    return result;
  }, [channels, extraSourceIds, sourceChannels, selectedSource, debouncedKeyword]);

  /** 移动端：按分组、数据源和关键词筛选频道（保留原逻辑） */
  const filteredChannels = useMemo(() => {
    let result = mainChannels;
    if (selectedGroup) {
      result = result.filter(ch => ch.group === selectedGroup);
    }
    return result;
  }, [mainChannels, selectedGroup]);

  /** 按数据源筛选分组：选中特定源时只显示该源的分组 */
  const filteredGroups = useMemo(() => {
    if (!selectedSource) return groups;
    const sourceFiltered = channels.filter(ch => ch.sourceId === selectedSource);
    const groupsMap = new Map<string, number>();
    sourceFiltered.forEach(ch => {
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

  /** 左栏分类计数：基于主干 + 勾选的「更多台」源频道（不受搜索影响，受源勾选影响） */
  const catCounts = useMemo(() => {
    const counts = new Map<IptvCategoryKey, number>();
    IPTV_CATEGORIES.forEach((c) => {
      counts.set(c.key, mainChannels.filter((ch) => inCategory(ch, c.key)).length);
    });
    counts.set('__other__', mainChannels.filter((ch) => inCategory(ch, '__other__')).length);
    return counts;
  }, [mainChannels]);

  /**
   * 桌面端分节结构：
   * - 全部频道：按固定分类分节（空分类跳过）+「其他」兜底节
   * - 具体分类 / 我的收藏：单节
   * - 勾选的「更多台」源频道已并入 mainChannels 参与分类渲染
   */
  const sections = useMemo(() => {
    if (!isDesktopRail) return [];
    const secs: Array<{ title: string; badge?: string; channels: typeof channels }> = [];
    if (selectedCat === '__all__') {
      IPTV_CATEGORIES.forEach((c) => {
        if (c.key === '__all__' || c.key === '__fav__') return;
        const list = mainChannels.filter((ch) => inCategory(ch, c.key));
        if (list.length) secs.push({ title: c.label, channels: list });
      });
      const other = mainChannels.filter((ch) => inCategory(ch, '__other__'));
      if (other.length) secs.push({ title: '其他', channels: other });
    } else {
      const label = selectedCat === '__other__'
        ? '其他'
        : IPTV_CATEGORIES.find((c) => c.key === selectedCat)?.label ?? '';
      const list = mainChannels.filter((ch) => inCategory(ch, selectedCat));
      if (list.length) secs.push({ title: label, channels: list });
    }
    // 勾选的「更多台」源频道已并入 mainChannels 参与分类渲染，不再单独追加分节
    return secs;
  }, [isDesktopRail, selectedCat, mainChannels, selectedSource, debouncedKeyword, sourceNameOf]);

  /** 分节总频道数（分页配额基准） */
  const sectionsTotal = useMemo(
    () => sections.reduce((acc, s) => acc + s.channels.length, 0),
    [sections]
  );

  /** 实际渲染的子集，由 useInfiniteScroll 滚动哨兵分批追加 */
  const displayedChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );
  const hasMore = isDesktopRail ? visibleCount < sectionsTotal : visibleCount < filteredChannels.length;

  // 切换分组 / 分类 / 搜索 / 源 / 更多台勾选时,把已渲染数重置回单批大小
  useEffect(() => {
    setVisibleCount(IPTV_PAGE_SIZE);
  }, [selectedGroup, selectedCat, debouncedKeyword, channels.length, extraSourceIds.length]);

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
    // 如果当前选中的分组属于新源，则保留；否则清空（仅移动端分组逻辑）
    setSelectedGroup((prev) => {
      if (prev === null) return null;
      const sourceGroups = new Set(
        channels
          .filter(ch => sourceId === null || ch.sourceId === sourceId)
          .map(ch => ch.group || '未分组')
      );
      return sourceGroups.has(prev) ? prev : null;
    });
  }, [channels]);

  // F3（2026-08-04）：首次进入且无频道数据时显示「整页全局 loading」——
  // 不渲染 .iptv-top-card（避免空数据筛选卡）也不显示网格区局部 AppLoading，
  // 与 Home/Detail 首屏 loading 风格一致（内联居中于页面容器内）。
  // 仅「首次加载且无数据」走此分支；已有数据后的刷新（isLoading 且 channels 非空）
  // 保持下方 .iptv-grid-card 内局部 loading 语义不变。
  if ((isLoading || !bootstrapped) && channels.length === 0) {
    return (
      <div ref={pageRef} className="page-padding iptv-page content-shell">
        <AppLoading tip="加载频道列表…" showTip />
      </div>
    );
  }

  /** 内容区顶部代理告警（两端共用） */
  const proxyWarning = !proxyUrl && (
    <div className="iptv-header">
      <span className="iptv-proxy-warning-inline">
        <Icon icon={AlertCircle} size="xs" />
        <span>IPTV流代理未配置，频道可能无法正常播放，请在设置中</span>
        <button className="iptv-proxy-warning-link" onClick={() => navigate('/settings?tab=iptv')}>
          配置
        </button>
      </span>
    </div>
  );

  /* ═══════════ 桌面端：左栏 + 分节内容区（≥1024，非 TV/App） ═══════════ */
  if (isDesktopRail) {
    let quota = visibleCount;
    return (
      <div ref={pageRef} className="page-padding iptv-page iptv-page--rail content-shell">
        <div className="iptv-rail-layout">
          {/* ── 左栏：频道分类 + 更多台 ── */}
          <aside className="iptv-rail">
            <div className="iptv-rail__title">频道分类</div>
            <div className="iptv-rail__list">
              {IPTV_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className={`iptv-rail__item${selectedCat === c.key ? ' is-on' : ''}`}
                  onClick={() => setSelectedCat(c.key)}
                >
                  <span className="iptv-rail__lbl">{c.label}</span>
                  <span className="iptv-rail__cnt">{catCounts.get(c.key) ?? 0}</span>
                </button>
              ))}
              {catCounts.get('__other__')! > 0 && (
                <button
                  className={`iptv-rail__item${selectedCat === '__other__' ? ' is-on' : ''}`}
                  onClick={() => setSelectedCat('__other__')}
                >
                  <span className="iptv-rail__lbl">其他</span>
                  <span className="iptv-rail__cnt">{catCounts.get('__other__')}</span>
                </button>
              )}
            </div>

            <div className="iptv-rail__sep" />
            <div className="iptv-rail__title">更多台</div>
            <div className="iptv-rail__list">
              {(aggregatorUrls ?? []).map((_, index) => {
                const id = `source-${index}`;
                const on = extraSourceIds.includes(id);
                const count = sourceChannels[id]?.length ?? 0;
                return (
                  <button
                    key={id}
                    className={`iptv-rail__item${on ? ' is-on' : ''}`}
                    onClick={() => handleToggleExtraSource(id)}
                    title={!on && extraSourceIds.length >= 3 ? '最多勾选 3 个源' : undefined}
                  >
                    <span className="iptv-rail__box" aria-hidden="true" />
                    <span className="iptv-rail__lbl">{sourceNameOf(id)}</span>
                    <span className="iptv-rail__cnt">+{count}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ── 内容区：过滤条 + 分节网格 ── */}
          <div className="iptv-rail-content">
            {proxyWarning}
            <div className="iptv-grid-card">
              {isLoading && (
                <div className="iptv-content-loading">
                  <AppLoading tip="加载频道列表…" showTip />
                </div>
              )}
              {!isLoading && (
                <div className="iptv-content">
                  <div className="iptv-content-bar">
                    <span className="iptv-content-bar__count">
                      共 {sectionsTotal} 个频道
                    </span>
                    {(lastRefresh) && (
                      <span className="last-refresh">
                        源: {new Date(lastRefresh).toLocaleTimeString()}
                      </span>
                    )}
                    {(epgCacheTime) && (
                      <span className="last-refresh">
                        节目单: {new Date(epgCacheTime).toLocaleTimeString()}
                      </span>
                    )}
                    <span className="iptv-content-bar__spacer" />
                    {(aggregatorUrls?.length ?? 0) > 1 && (
                      <>
                        <select
                          className="iptv-src-select"
                          value={selectedSource ?? '__all__'}
                          onChange={(e) => handleSourceSelect(e.target.value === '__all__' ? null : e.target.value)}
                          aria-label="按源过滤当前列表"
                        >
                          <option value="__all__">全部源（{channels.length}）</option>
                          {(aggregatorUrls ?? []).map((_, index) => {
                            const id = `source-${index}`;
                            const n = channels.filter((ch) => ch.sourceId === id).length;
                            return (
                              <option key={id} value={id} disabled={!sourceHasChannels[index]}>
                                {sourceNameOf(id)}（{n}）
                              </option>
                            );
                          })}
                        </select>
                        <span className="iptv-content-bar__note">仅过滤当前列表</span>
                      </>
                    )}
                    <button className="refresh-btn" onClick={() => refreshChannels()} disabled={isLoading}>
                      刷新
                    </button>
                  </div>

                  {channels.length === 0 ? (
                    <Empty
                      title="暂无频道数据"
                      description={error || '请点击刷新按钮加载频道列表，或在左侧「更多台」勾选本地源'}
                    />
                  ) : sectionsTotal === 0 ? (
                    <Empty title="暂无频道" description="尝试切换分类或清空搜索关键词" />
                  ) : (
                    <>
                      {sections.map((sec) => {
                        // 全局分页配额：按节顺序分配，保证总渲染数 ≤ visibleCount
                        const list = sec.channels.slice(0, Math.max(0, quota));
                        quota -= list.length;
                        if (list.length === 0) return null;
                        return (
                          <section key={`${sec.title}-${list[0]?.id}`} className="iptv-sec">
                            <div className="iptv-sec__head">
                              <h3>{sec.title}</h3>
                              <span className="iptv-sec__n">{sec.channels.length}</span>
                              <span className="iptv-sec__line" />
                            </div>
                            <div className="iptv-channel-grid animate-fade-in">
                              {list.map((channel) => (
                                <IPTVChannelCard
                                  key={channel.id}
                                  channel={channel}
                                  sourceBadge={sec.badge}
                                />
                              ))}
                            </div>
                          </section>
                        );
                      })}
                      <div ref={sentinelRef} aria-hidden="true" />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <BackToTopButton />
      </div>
    );
  }

  /* ═══════════ 移动端 / App / TV：保留原布局 ═══════════ */
  return (
    <div ref={pageRef} className="page-padding iptv-page content-shell">
      <div className="iptv-top-card">
        {proxyWarning}

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

        {/* ── 操作行：刷新按钮 ── */}
        <div className="iptv-actions-row">
          <div className="iptv-actions-buttons">
            <button className="refresh-btn" onClick={() => refreshChannels()} disabled={isLoading}>
              刷新
            </button>
          </div>
        </div>
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

/** 防抖 Hook：延迟更新值，避免频繁触发搜索过滤 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
