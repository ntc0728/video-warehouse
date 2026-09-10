/**
 * IPTV 直播状态管理
 * 管理直播频道列表、分组、收藏、播放历史等核心功能
 * 支持从远程 M3U 播放列表加载频道（多源聚合去重），以及「更多台」按源追加额外频道
 *
 * [2026-09-08] 可用性检测已整体移除（检测会真实拉流、产生大量无效请求），
 * 相关字段/action 全部删除，卡片不再有「无法观看」标灰态。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IPTVChannel, IPTVGroup, IPTVFilter, IPTVSettings, IPTVPlayRecord } from '@/types/iptv';
import { fetchAndParsePlaylist, fetchSingleSourceChannels } from '@/services/iptvService';
// iptv-org API 主干层（channels.json + streams.json + logos.json，2026-09-08 用户定稿）
import { fetchIptvOrgChinaChannels, fetchCnDisplayNames, channelMatchKeys, matchLogoForChannel } from '@/services/iptvOrgService';
import { PlaylistSourceType } from '@/types/iptv';
import { getCachedIPTVChannels, setCachedIPTVChannels } from '@/services/database';

/**
 * 本地源频道（「更多台」）台标补全：
 * 一级 = logos.json 按名匹配（matchLogoForChannel）；匹配不到 → 二级 = iptv 源自带
 * tvg-logo 兜底（2026-09-08 用户定稿）。无任一来源时 logo 为 undefined → 卡片字母占位。
 */
function withSourceLogo(list: IPTVChannel[]): IPTVChannel[] {
  return list.map((ch) => ({ ...ch, logo: matchLogoForChannel(ch) ?? ch.logo }));
}

/** 逐源执行台标补全（bySource：源 id → 该源频道列表） */
function withSourceLogoBySource(bySource: Record<string, IPTVChannel[]>): Record<string, IPTVChannel[]> {
  const out: Record<string, IPTVChannel[]> = {};
  for (const [id, list] of Object.entries(bySource)) out[id] = withSourceLogo(list);
  return out;
}

/** 本地聚合源拉取结果类型（fetchAndParsePlaylist 返回值） */
type LocalPlaylistResult = Awaited<ReturnType<typeof fetchAndParsePlaylist>>;

/**
 * iptv-org 主干 × 本地源合并（2026-09-08 方案 B）：
 * 本地流命中同名 org 频道（normalizeName 双侧键匹配）→ 改用本地流（本地源优先）；
 * 本地独有频道不进主干（只通过「更多台」按源展示）。
 * 独立成纯函数：中文名后台增强（fetchCnDisplayNames）到达后用新 orgChannels 重放合并。
 */
function mergeOrgWithLocal(
  orgChannels: IPTVChannel[],
  localResult: LocalPlaylistResult | null
): IPTVChannel[] {
  if (!localResult) return orgChannels;
  // 本地频道 → 匹配键索引（normalizeName 剥「卫视/台/综合」等冗余词后精确匹配）
  const localIndex = new Map<string, IPTVChannel>();
  for (const local of localResult.channels) {
    for (const key of channelMatchKeys(local)) {
      if (!localIndex.has(key)) localIndex.set(key, local);
    }
  }
  return orgChannels.map((org) => {
    // org 侧任一匹配键（中文名/英文名/备用名规范化）命中本地频道即视为同一频道
    let local: IPTVChannel | undefined;
    for (const key of channelMatchKeys(org)) {
      local = localIndex.get(key);
      if (local) break;
    }
    if (!local) return org;
    // 本地流优先播放（本地源优先策略）；不写 fallbackUrl（备用源已移除）
    return { ...org, url: local.url, sourceId: local.sourceId };
  });
}

/** 频道按 group 字段分组归类（主干合并 / 中文名增强重放共用） */
function groupChannels(channels: IPTVChannel[]): IPTVGroup[] {
  const groupsMap = new Map<string, IPTVChannel[]>();
  channels.forEach((channel) => {
    const groupName = channel.group || '未分组';
    if (!groupsMap.has(groupName)) groupsMap.set(groupName, []);
    groupsMap.get(groupName)!.push(channel);
  });
  return Array.from(groupsMap.entries()).map(([name, channelList]) => ({
    name,
    count: channelList.length,
    channels: channelList,
  }));
}

/** 套收藏状态（isFavorite 来自 favoriteChannelIds） */
function withFavorites(channels: IPTVChannel[], favoriteChannelIds: string[]): IPTVChannel[] {
  return channels.map((ch) => ({ ...ch, isFavorite: favoriteChannelIds.includes(ch.id) }));
}

/**
 * zustand persist 落 localStorage 的键名。
 * clearCache（removeItem）/ persist name / 跨页签 storage 监听共用，防三处字面量漂移。
 */
const IPTV_PERSIST_KEY = 'iptv-store';

/** 「更多台」最多可勾选的源数量（与设置页 IPTV 源启用上限一致：最多 3 个） */
export const MAX_EXTRA_SOURCES = 3;

interface IPTVState {
  channels: IPTVChannel[];
  groups: IPTVGroup[];
  selectedChannel: IPTVChannel | null;
  filter: IPTVFilter;
  settings: IPTVSettings;
  isLoading: boolean;
  error: string | null;
  lastRefresh: number | null;
  loadedUrl: string | null;
  /**
   * 每个已启用源自身的频道（未跨源去重）：key = `source-${index}`。
   * 供 IPTV 页「更多台」勾选源后按源追加额外频道（同名台 = 备用线路）。
   */
  sourceChannels: Record<string, IPTVChannel[]>;
  /** 「更多台」已勾选的源 id 集合（设置页最多启用 3 个 IPTV 源，故上限 3） */
  extraSourceIds: string[];
  sourceType: PlaylistSourceType;
  sourceErrors: Array<{ index: number; url: string; error: string }>;
  playHistory: IPTVPlayRecord[];
  favoriteChannelIds: string[];

  setChannels: (channels: IPTVChannel[]) => void;
  setGroups: (groups: IPTVGroup[]) => void;
  setSelectedChannel: (channel: IPTVChannel | null) => void;
  setFilter: (filter: Partial<IPTVFilter>) => void;
  clearFilter: () => void;
  setSettings: (settings: Partial<IPTVSettings>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  refreshChannels: () => Promise<void>;
  toggleFavorite: (channelId: string) => void;
  /** 仅清空频道/分组（保留设置、播放历史、收藏频道），用于「清除全部缓存」 */
  clearChannelsCache: () => void;
  clearCache: () => void;
  recordPlay: (channelId: string) => void;
  clearPlayHistory: () => void;
  removePlayRecord: (channelId: string) => void;
  clearFavorites: () => void;
  loadFromCache: () => Promise<boolean>;
  /** 勾选/取消「更多台」的额外频道源（最多 3 个，超出忽略） */
  toggleExtraSource: (sourceId: string) => void;
  /**
   * 确保某源的频道数据就位：无数据（缓存无 bySource / 刷新时竞速被放弃 / 源失败）
   * 时按需拉取该源单源 M3U 并写入 sourceChannels。已有数据（含空数组=已尝试过）不重复拉。
   */
  ensureSourceChannels: (sourceId: string) => Promise<void>;
}

const defaultSettings: IPTVSettings = {
  aggregatorUrl: '',
  aggregatorUrls: [],
  proxyUrl: '',
  // 默认直连白名单：命中这些域名特征的 URL 不走代理（浏览器原生放行 CORS），
  // 可显著降低 worker 代理请求量（见 docs/IPTV-PLAYBACK-FIX-PLAN）。
  // 常见可直连直播 CDN：咪咕/移动 liveplay、腾讯云 myqcloud、阿里 livecdn/OSS、
  // 七牛/又拍/百度 CDN、GitHub 静态托管（raw/github.io/jsdelivr）及常见免费源。
  // 用户可在设置页「代理规则」中自定义覆盖；留空则全部走代理。
  proxyPattern:
    'liveplay\\.(miguvideo|myqcloud)|miguvideo|livecdn\\.aliyun|oss-cn-.*aliyuncs|qiniucdn|upaiyun|bdstatic|raw\\.githubusercontent|github\\.io|jsdelivr|gitee\\.(com|io)|freetv\\.fun|tv1288|4666888',
  priorityKeywords: [],
  autoRefresh: false,
  refreshIntervalHours: 24,
};

export const useIPTVStore = create<IPTVState>()(
  persist(
    (set, get) => ({
      channels: [],
      groups: [],
      selectedChannel: null,
      filter: {},
      settings: defaultSettings,
      isLoading: false,
      error: null,
      lastRefresh: null,
      loadedUrl: null,
      sourceChannels: {},
      extraSourceIds: [],
      sourceType: PlaylistSourceType.UNKNOWN,
      sourceErrors: [],
      playHistory: [],
      favoriteChannelIds: [],

      /**
       * 设置频道列表，同时同步收藏状态
       */
      setChannels: (channels) => {
        const { favoriteChannelIds } = get();
        const channelsWithFavorites = channels.map(ch => ({
          ...ch,
          isFavorite: favoriteChannelIds.includes(ch.id)
        }));
        set({ channels: channelsWithFavorites });
      },

      setGroups: (groups) => set({ groups }),

      setSelectedChannel: (channel) => set({ selectedChannel: channel }),

      setFilter: (filter) =>
        set((state) => ({ filter: { ...state.filter, ...filter } })),

      clearFilter: () => set({ filter: {} }),

      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      /**
       * 从远程源刷新频道列表（2026-09-08 架构定稿）：
       * 主干 = iptv-org API（channels/streams/logos 三 JSON 组装，台标精确匹配）；
       * 本地 M3U 聚合源 = 补充：
       *  - 本地名命中 iptv-org 频道 → 播放流改用本地流（本地优先）；不写任何兜底流字段；
       *  - 本地频道【不进主干】：全部频道 = iptv-org 主干（~149 条），
       *    本地独有频道只在「更多台」勾选对应源后出现（2026-09-08 用户定稿：不再混入主干）；
       *  - iptv-org 拉取失败 → 回退纯本地主干（旧行为）；本地失败不影响 org 主干。
       * 台标：主干按 channel id 精确匹配 logos.json；更多台本地频道按名匹配 logos.json，
       * 匹配不到用 iptv 源自带台标兜底。
       * 获取后自动按分组归类，并同步收藏状态；sourceChannels/bySource 供「更多台」。
       */
      refreshChannels: async () => {
        const { favoriteChannelIds } = get();
        const settings = get().settings;
        // 已有频道数据时静默刷新：旧数据继续展示，不进入全屏 loading，
        // 避免慢源拖尾（三 JSON ~17MB + 本地源竞速）期间页面长时间空白/加载态
        const hasChannels = get().channels.length > 0;
        set({ isLoading: !hasChannels, error: null });

        // 并行：iptv-org 主干 + 本地源聚合（互不阻塞，各自动降级）
        // proxyUrl：iptv-org 直连失败时经 IPTV 代理重试一次（接口内仅重试一次）
        const [orgSettled, localSettled] = await Promise.allSettled([
          fetchIptvOrgChinaChannels(settings.proxyUrl),
          fetchAndParsePlaylist(settings),
        ]);

        // 本地源结果：成功时产出 bySource（更多台）与频道全集；失败记 error
        const localResult = localSettled.status === 'fulfilled' ? localSettled.value : null;
        const sourceErrors = localResult?.sourceErrors ?? [];
        // iptv-org 失败且本地也失败 → 整体失败；仅 org 失败 → 用本地并提示
        if (orgSettled.status === 'rejected' && !localResult) {
          set({
            error: orgSettled.reason instanceof Error ? orgSettled.reason.message : 'iptv-org 与本地源均加载失败',
            isLoading: false,
            lastRefresh: Date.now(),
          });
          return;
        }

        let merged: IPTVChannel[] = [];
        // org 主干原始频道（中文名增强重放合并时复用）
        const orgChannels =
          orgSettled.status === 'fulfilled' && orgSettled.value.channels.length > 0
            ? orgSettled.value.channels
            : null;

        if (orgChannels) {
          // ── 主干：iptv-org 频道（url=cn.m3u 流；命中本地源同名频道则改用本地流）──
          merged = mergeOrgWithLocal(orgChannels, localResult);
        } else if (localResult) {
          // iptv-org 不可用 → 回退纯本地主干（旧行为）
          merged = localResult.channels;
        }

        const channels = withFavorites(merged, favoriteChannelIds);

        // 按频道 group 字段分组归类
        const groups = groupChannels(channels);

        // 本地源（更多台）台标：logos.json 按名匹配 → iptv 源台标兜底
        const bySource = localResult?.bySource
          ? withSourceLogoBySource(localResult.bySource)
          : get().sourceChannels;

        // 合并错误消息：本地源失败 + iptv-org 主干失败可能同时发生
        const errors: string[] = [];
        if (sourceErrors.length > 0) errors.push(`${sourceErrors.length} 个本地源加载失败`);
        if (orgSettled.status === 'rejected') errors.push('iptv-org 主干加载失败，已回退本地源');

        set({
          channels,
          groups,
          sourceChannels: bySource,
          // 源集合变化后剔除已不存在的勾选（设置页最多启用 3 个源）
          extraSourceIds: get().extraSourceIds.filter(id => !!localResult?.bySource?.[id]),
          sourceType: localResult?.sourceType ?? get().sourceType,
          sourceErrors,
          lastRefresh: Date.now(),
          loadedUrl: settings.aggregatorUrls?.length
            ? settings.aggregatorUrls.join(';')
            : settings.aggregatorUrl ?? null,
          isLoading: false,
          error: errors.length > 0 ? errors.join('；') : null,
        });

        // 保存到 IndexedDB 缓存（合并结果，含 bySource）
        const sourceUrls = settings.aggregatorUrls?.length
          ? settings.aggregatorUrls
          : settings.aggregatorUrl
            ? [settings.aggregatorUrl]
            : [];
        setCachedIPTVChannels({
          channels,
          groups,
          sourceType: localResult?.sourceType ?? 'unknown',
          timestamp: Date.now(),
          sourceUrls,
          bySource,
        }).catch(() => {});

        // 中文名增强（方案 B 后台层，fire-and-forget）：cn.m3u 主干已先行渲染（英文名），
        // channels.json 的中文名后台拉取（IndexedDB 7 天缓存，只拉一次），到达后用
        // 增强频道重放本地流合并并 set——分类（按频道名判定）随之自动更新。
        if (orgChannels) {
          void fetchCnDisplayNames(settings.proxyUrl)
            .then(({ names, channels: orgChannelsZh }) => {
              if (Object.keys(names).length === 0 || orgChannelsZh.length === 0) return;
              const mergedZh = mergeOrgWithLocal(orgChannelsZh, localResult);
              const channelsZh = withFavorites(mergedZh, get().favoriteChannelIds);
              set({ channels: channelsZh, groups: groupChannels(channelsZh) });
            })
            .catch(() => { /* 中文名增强失败静默：主干保持英文名 */ });
        }
      },

      /**
       * 切换频道收藏状态
       * 同时更新频道列表中的 isFavorite 标记和收藏ID列表
       */
      toggleFavorite: (channelId) =>
        set((state) => {
          const isCurrentlyFavorite = state.favoriteChannelIds.includes(channelId);
          const newFavoriteIds = isCurrentlyFavorite
            ? state.favoriteChannelIds.filter(id => id !== channelId)
            : [...state.favoriteChannelIds, channelId];

          return {
            channels: state.channels.map((ch) =>
              ch.id === channelId ? { ...ch, isFavorite: !isCurrentlyFavorite } : ch
            ),
            favoriteChannelIds: newFavoriteIds,
          };
        }),

      /** 勾选/取消「更多台」额外频道源：上限 3（设置页 IPTV 源最多启用 3 个） */
      toggleExtraSource: (sourceId) => {
        const { extraSourceIds } = get();
        if (extraSourceIds.includes(sourceId)) {
          set({ extraSourceIds: extraSourceIds.filter(id => id !== sourceId) });
          return;
        }
        if (extraSourceIds.length >= MAX_EXTRA_SOURCES) return;
        set({ extraSourceIds: [...extraSourceIds, sourceId] });
      },

      /** 按需补拉单源频道（更多台勾选时数据缺失的兜底），失败静默保持空数组 */
      ensureSourceChannels: async (sourceId) => {
        const { settings, sourceChannels } = get();
        // 已有键（含空数组 = 曾拉取失败，不反复重试打失败源）→ 跳过
        if (sourceChannels[sourceId] !== undefined) return;
        const index = Number(sourceId.replace('source-', ''));
        const url = settings.aggregatorUrls?.[index];
        if (!url) return;
        // 先占位空数组：防勾选连点/快速重入导致并发重复拉取
        set({ sourceChannels: { ...get().sourceChannels, [sourceId]: [] } });
        try {
          const list = await fetchSingleSourceChannels(url, index, settings);
          // 台标：logos.json 按名匹配优先，匹配不到保留 iptv 源自带台标
          set({ sourceChannels: { ...get().sourceChannels, [sourceId]: withSourceLogo(list) } });
        } catch {
          // 拉取失败保持空数组：节不展示，避免报错打断页面
        }
      },

      /**
       * 仅清空频道列表与分组（不清设置/播放历史/收藏频道）
       * 用于「清除全部缓存」：页面挂载时会因缓存未命中自动重新拉取
       */
      clearChannelsCache: () => {
        set({
          channels: [],
          groups: [],
          selectedChannel: null,
          lastRefresh: null,
          loadedUrl: null,
          isLoading: false,
          error: null,
          sourceChannels: {},
        });
      },

      /**
       * 清除所有缓存数据，仅保留设置项
       */
      clearCache: () => {
        localStorage.removeItem(IPTV_PERSIST_KEY);
        const { settings } = get();
        set({
          channels: [],
          groups: [],
          selectedChannel: null,
          filter: {},
          settings,
          isLoading: false,
          error: null,
          lastRefresh: null,
          sourceChannels: {},
          extraSourceIds: [],
          playHistory: [],
          favoriteChannelIds: [],
        });
      },


      /**
       * 记录频道播放行为
       * 更新频道的最后播放时间，并将该频道移至播放历史最前面（去重）
       */
      recordPlay: (channelId) => {
        const { channels, playHistory } = get();
        const channel = channels.find(ch => ch.id === channelId);
        if (!channel) return;

        const now = Date.now();
        set({
          channels: channels.map(ch =>
            ch.id === channelId ? { ...ch, lastPlayed: now } : ch
          ),
          playHistory: [
            {
              channelId,
              channelName: channel.name,
              channelLogo: channel.logo,
              channelGroup: channel.group,
              playedAt: now,
            },
            ...playHistory.filter(h => h.channelId !== channelId),
          ],
        });
      },

      clearPlayHistory: () => set({ playHistory: [] }),

      removePlayRecord: (channelId) =>
        set((state) => ({
          playHistory: state.playHistory.filter((r) => r.channelId !== channelId),
        })),

      clearFavorites: () =>
        set((state) => ({
          favoriteChannelIds: [],
          channels: state.channels.map((ch) => ({ ...ch, isFavorite: false })),
        })),

      loadFromCache: async () => {
        const { settings, favoriteChannelIds } = get();
        const sourceUrls = settings.aggregatorUrls?.length
          ? settings.aggregatorUrls
          : settings.aggregatorUrl
            ? [settings.aggregatorUrl]
            : [];

        if (sourceUrls.length === 0) return false;

        const cached = await getCachedIPTVChannels(sourceUrls);
        if (!cached) return false;

        const channels = cached.channels.map(ch => ({
          ...ch,
          isFavorite: favoriteChannelIds.includes(ch.id)
        }));

        set({
          channels,
          groups: cached.groups,
          // 缓存里的本地源频道同样走「logos.json 按名匹配 → iptv 源兜底」
          sourceChannels: withSourceLogoBySource(cached.bySource ?? {}),
          sourceType: cached.sourceType as PlaylistSourceType,
          lastRefresh: cached.timestamp,
          loadedUrl: settings.aggregatorUrls?.length
            ? settings.aggregatorUrls.join(';')
            : settings.aggregatorUrl ?? null,
          error: null,
        });

        return true;
      },
    }),
    {
      name: IPTV_PERSIST_KEY,
      // 仅持久化配置和用户数据，运行时状态（频道列表、加载状态等）不持久化
      partialize: (state: IPTVState) => ({
        settings: state.settings,
        filter: state.filter,
        playHistory: state.playHistory,
        favoriteChannelIds: state.favoriteChannelIds,
        // 「更多台」已勾选的额外频道源（页面级偏好，跨会话保留）
        extraSourceIds: state.extraSourceIds,
      }),
      /**
       * 合并持久化数据与当前默认值
       * 确保新增的设置字段有默认值，并处理旧版代理路径迁移
       */
      merge: (persisted, current) => {
        const incoming = persisted as Partial<IPTVState>;
        const settings = { ...current.settings, ...(incoming.settings || {}) };
        // 迁移旧的代理路径到新地址
        if (settings.aggregatorUrl?.startsWith('/')) {
          settings.aggregatorUrl = defaultSettings.aggregatorUrl;
        }
        // 迁移旧版 proxyPattern 到新版内置直连白名单：
        // ① 旧默认「IP 形式 URL 不走代理」→ 新内置白名单（更全面的 CDN 直连）
        // ② 空字符串（旧数据未配置/用户留空）→ 新内置白名单（降低 worker 请求量，
        //    用户仍可在设置页自定义；显式清空后再保存会持久化空值并重新生效）
        const LEGACY_DEFAULT_PROXY_PATTERN = '^https?://\\d+\\.\\d+\\.\\d+\\.\\d+';
        if (
          settings.proxyPattern === LEGACY_DEFAULT_PROXY_PATTERN ||
          settings.proxyPattern === ''
        ) {
          settings.proxyPattern = defaultSettings.proxyPattern;
        }
        return {
          ...current,
          ...incoming,
          settings,
        };
      },
    }
  )
);

// ── 跨页签实时同步（2026-09-02）─────────────────────────────
// 收藏/播放历史/设置经 zustand persist 落 localStorage（键 IPTV_PERSIST_KEY）。
// localStorage 的同源跨页签通知是浏览器原生 window 'storage' 事件：其它页签
// setItem/removeItem 后自动在本页签触发——无需 BroadcastChannel（useUserStore
// 落 IndexedDB、无原生通知，才需要广播频道，见 useUserStore.ts）。
//
// 收到本键变更：
//   ① e.newValue === null（另一页签 clearCache 先 removeItem）→ 镜像归零：
//      收藏/播放历史/筛选重置、频道 isFavorite 全 false。频道列表本身保留
//      （它是可自 IDB 缓存/远程重取的运行时数据，不是用户数据）。
//   ② 常规写入 → persist.rehydrate() 重读合并持久化切片（复用自定义 merge，
//      含旧版代理路径迁移，不重复实现），再按新 favoriteChannelIds 重派生
//      channels.isFavorite——否则「心形收藏态」与收藏数组脱节。
//
// 无回环：浏览器规范保证本页签自身的 localStorage 写入不触发自身 storage 事件；
// 即便其它页签把重派生结果写回，内容与已持久化切片一致（setItem 相同字符串不
// 产生事件），链路收敛。
let iptvCrossTabSyncAttached = false;

/** 重读持久化切片并重派生频道收藏标记（storage 事件「常规写入」路径） */
async function reloadIPTVPersisted(): Promise<void> {
  await useIPTVStore.persist.rehydrate(); // 兼容 sync 路径返回 void
  const { channels, favoriteChannelIds } = useIPTVStore.getState();
  useIPTVStore.setState({
    channels: channels.map((ch) => ({ ...ch, isFavorite: favoriteChannelIds.includes(ch.id) })),
  });
}

function initIPTVStoreCrossTabSync(): void {
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return;
  if (iptvCrossTabSyncAttached) return; // 幂等：模块被多路径 import / HMR 时只挂一次
  iptvCrossTabSyncAttached = true;

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== IPTV_PERSIST_KEY || e.storageArea !== localStorage) return;

    if (e.newValue === null) {
      // 另一页签「清除全部缓存」：持久化用户数据归零（保留 settings，与 clearCache 语义一致）
      const { channels } = useIPTVStore.getState();
      useIPTVStore.setState({
        favoriteChannelIds: [],
        playHistory: [],
        filter: {},
        channels: channels.map((ch) => ({ ...ch, isFavorite: false })),
      });
      return;
    }

    // 常规写入：重读合并持久化切片后，按新收藏数组重派生频道标记
    void reloadIPTVPersisted();
  });
}
initIPTVStoreCrossTabSync();


