/**
 * IPTV 直播状态管理
 * 管理直播频道列表、分组、收藏、可用性检测、播放历史等核心功能
 * 支持从远程 M3U 播放列表加载频道，以及频道可用性批量检测
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IPTVChannel, IPTVGroup, IPTVFilter, IPTVSettings, IPTVPlayRecord } from '@/types/iptv';
import { fetchAndParsePlaylist, checkChannelsAvailability } from '@/services/iptvService';
import { PlaylistSourceType } from '@/types/iptv';
import { getCachedIPTVChannels, setCachedIPTVChannels } from '@/services/database';

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
  isCheckingAvailability: boolean;
  checkingGroupId: string | null;
  availabilityProgress: { checked: number; total: number } | null;
  /**
   * 检测结果（按 tab/分组隔离）：key = groupId（'__all__' 表示全部），
   * value = channelId → 是否可用。每个 tab 的检测结果独立存储、互不干扰。
   */
  availabilityResults: Record<string, Record<string, boolean>>;
  sourceType: PlaylistSourceType;
  sourceErrors: Array<{ index: number; url: string; error: string }>;
  playHistory: IPTVPlayRecord[];
  favoriteChannelIds: string[];
  _abortController: AbortController | null;

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
  getFilteredChannels: () => IPTVChannel[];
  /** 仅清空频道/分组（保留设置、播放历史、收藏频道），用于「清除全部缓存」 */
  clearChannelsCache: () => void;
  clearCache: () => void;
  checkAvailability: (groupName?: string | null) => void;
  abortAvailabilityCheck: () => void;
  recordPlay: (channelId: string) => void;
  clearPlayHistory: () => void;
  removePlayRecord: (channelId: string) => void;
  clearFavorites: () => void;
  loadFromCache: () => Promise<boolean>;
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
      isCheckingAvailability: false,
      checkingGroupId: null,
      availabilityProgress: null,
      availabilityResults: {},
      sourceType: PlaylistSourceType.UNKNOWN,
      sourceErrors: [],
      playHistory: [],
      favoriteChannelIds: [],
      _abortController: null,

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
       * 从远程源刷新频道列表
       * 获取频道后自动按分组归类，并同步收藏状态
       *
       * 注意:不再在开始时清空 channels/groups,避免触发 IPTVPage 一次额外的"全部清空"重渲染,
       * 旧实现会让用户在切到 /iptv 标签时看到 1 次闪烁 (列表 → 空 → 完整列表)。
       * UI 通过 isLoading 显示 AppLoading 占位即可,数据本身保留旧值。
       */
      refreshChannels: async () => {
        const { settings, favoriteChannelIds } = get();
        // 已有频道数据时静默刷新：旧数据继续展示，不进入全屏 loading，
        // 避免慢源拖尾（最坏 8s 竞速窗口）期间页面长时间空白/加载态
        const hasChannels = get().channels.length > 0;
        set({ isLoading: !hasChannels, error: null });

        try {
          const result = await fetchAndParsePlaylist(settings);
          const { channels: rawChannels, sourceType, sourceErrors } = result;

          const channels = rawChannels.map(ch => ({
            ...ch,
            isFavorite: favoriteChannelIds.includes(ch.id)
          }));

          // 按频道 group 字段分组归类
          const groupsMap = new Map<string, IPTVChannel[]>();
          channels.forEach((channel) => {
            const groupName = channel.group || '未分组';
            if (!groupsMap.has(groupName)) {
              groupsMap.set(groupName, []);
            }
            groupsMap.get(groupName)!.push(channel);
          });

          const groups: IPTVGroup[] = Array.from(groupsMap.entries()).map(
            ([name, channelList]) => ({
              name,
              count: channelList.length,
              channels: channelList,
            })
          );

          set({
            channels,
            groups,
            sourceType,
            sourceErrors,
            lastRefresh: Date.now(),
            loadedUrl: settings.aggregatorUrl,
            isLoading: false,
            isCheckingAvailability: false,
            checkingGroupId: null,
            availabilityProgress: null,
            error: sourceErrors.length > 0
              ? `${sourceErrors.length} 个源加载失败`
              : null,
          });

          // 保存到 IndexedDB 缓存
          const sourceUrls = settings.aggregatorUrls?.length
            ? settings.aggregatorUrls
            : settings.aggregatorUrl
              ? [settings.aggregatorUrl]
              : [];
          setCachedIPTVChannels({
            channels,
            groups,
            sourceType,
            timestamp: Date.now(),
            sourceUrls,
          }).catch(() => {});
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '刷新频道列表失败',
            isLoading: false,
            lastRefresh: Date.now(),
          });
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

      /**
       * 根据筛选条件过滤频道
       * 支持按分组、地区、关键词和仅收藏进行筛选
       */
      getFilteredChannels: () => {
        const { channels, filter } = get();
        return channels.filter((channel) => {
          if (filter.group && channel.group !== filter.group) return false;
          if (filter.region && channel.region !== filter.region) return false;
          if (filter.keyword) {
            const keyword = filter.keyword.toLowerCase();
            if (!channel.name.toLowerCase().includes(keyword)) return false;
          }
          if (filter.favoritesOnly && !channel.isFavorite) return false;
          return true;
        });
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
          isCheckingAvailability: false,
          availabilityProgress: null,
        });
      },

      /**
       * 清除所有缓存数据，仅保留设置项
       */
      clearCache: () => {
        localStorage.removeItem('iptv-store');
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
          isCheckingAvailability: false,
          availabilityProgress: null,
          playHistory: [],
          favoriteChannelIds: [],
        });
      },

      /**
       * 批量检测频道可用性
       * 可指定分组仅检测该分组下的频道，支持通过 AbortController 中断检测
       */
      checkAvailability: (groupName) => {
        const { channels, isCheckingAvailability, _abortController, availabilityResults } = get();
        if (isCheckingAvailability || channels.length === 0) return;

        // 中断上一次未完成的检测
        if (_abortController) {
          _abortController.abort();
        }

        const groupKey = groupName || '__all__';
        const targetChannels = groupName
          ? channels.filter(ch => ch.group === groupName)
          : channels;

        if (targetChannels.length === 0) return;

        const newController = new AbortController();
        const activeController = newController;
        // 只清空「当前组」的旧检测结果，其他组的结果保留（每个 tab 独立、互不干扰）
        set({
          availabilityResults: { ...availabilityResults, [groupKey]: {} },
          isCheckingAvailability: true,
          checkingGroupId: groupKey,
          availabilityProgress: { checked: 0, total: targetChannels.length },
          _abortController: newController,
        });

        const channelsToCheck = targetChannels.map(ch => ({ id: ch.id, url: ch.url }));

        checkChannelsAvailability(
          channelsToCheck,
          (checked, total) => {
            set({ availabilityProgress: { checked, total } });
          },
          activeController.signal
        ).then((results) => {
          // controller 已被替换 → 丢弃结果
          if (get()._abortController !== activeController) return;
          // 将结果写入「当前组」的 availabilityResults（按 channelId），不写入频道自身、按组隔离
          const groupResult: Record<string, boolean> = {};
          results.forEach((available, channelId) => {
            groupResult[channelId] = available;
          });
          const cur = get();
          set({
            availabilityResults: {
              ...cur.availabilityResults,
              [groupKey]: groupResult,
            },
            isCheckingAvailability: false,
            checkingGroupId: null,
            availabilityProgress: null,
            _abortController: null,
          });
        }).catch(() => {
          if (get()._abortController !== activeController) return;
          // 检测失败：当前组所有频道标记为不可用
          const cur = get();
          const groupResult: Record<string, boolean> = {};
          targetChannels.forEach(ch => { groupResult[ch.id] = false; });
          set({
            availabilityResults: {
              ...cur.availabilityResults,
              [groupKey]: groupResult,
            },
            isCheckingAvailability: false,
            checkingGroupId: null,
            availabilityProgress: null,
            _abortController: null,
          });
        });
      },

      abortAvailabilityCheck: () => {
        const { _abortController, checkingGroupId, availabilityResults } = get();
        if (_abortController) {
          _abortController.abort();
        }
        // 清除「当前检测分组」的 availabilityResults（其他组结果保留，互不干扰）
        const nextResults = { ...availabilityResults };
        if (checkingGroupId) {
          delete nextResults[checkingGroupId];
        }
        set({
          availabilityResults: nextResults,
          isCheckingAvailability: false,
          checkingGroupId: null,
          availabilityProgress: null,
          _abortController: null,
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
          sourceType: cached.sourceType as PlaylistSourceType,
          lastRefresh: cached.timestamp,
          loadedUrl: settings.aggregatorUrl,
          error: null,
        });

        return true;
      },
    }),
    {
      name: 'iptv-store',
      // 仅持久化配置和用户数据，运行时状态（频道列表、加载状态等）不持久化
      partialize: ({ _abortController, ...state }: IPTVState) => ({
        settings: state.settings,
        filter: state.filter,
        playHistory: state.playHistory,
        favoriteChannelIds: state.favoriteChannelIds,
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


