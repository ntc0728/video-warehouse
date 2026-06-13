/**
 * IPTV 直播状态管理
 * 管理直播频道列表、分组、收藏、可用性检测、播放历史等核心功能
 * 支持从远程 M3U 播放列表加载频道，以及频道可用性批量检测
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IPTVChannel, IPTVGroup, IPTVFilter, IPTVSettings } from '@/types/iptv';
import { fetchAndParsePlaylist, checkChannelsAvailability, SourceType } from '@/services/iptvService';
import { getIPTVSources } from '@/services/sourceService';
import { useSettingsStore } from './useSettingsStore';

export interface IPTVPlayRecord {
  channelId: string;
  channelName: string;
  channelLogo?: string;
  channelGroup?: string;
  playedAt: number;
}

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
  availabilityProgress: { checked: number; total: number } | null;
  sourceType: SourceType;
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
  clearCache: () => void;
  checkAvailability: (groupName?: string | null) => void;
  abortAvailabilityCheck: () => void;
  recordPlay: (channelId: string) => void;
  clearPlayHistory: () => void;
  removePlayRecord: (channelId: string) => void;
  clearFavorites: () => void;
}

const defaultSettings: IPTVSettings = {
  aggregatorUrl: '',
  proxyUrl: '',
  proxyPattern: '^https?://\\d+\\.\\d+\\.\\d+\\.\\d+',
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
      availabilityProgress: null,
      sourceType: SourceType.UNKNOWN,
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
        set({ isLoading: true, error: null });

        try {
          const result = await fetchAndParsePlaylist(settings);
          const { channels: rawChannels, sourceType } = result;

          const channels = rawChannels.map(ch => ({
            ...ch,
            isFavorite: favoriteChannelIds.includes(ch.id)
          }));

          set({
            channels,
            sourceType,
            lastRefresh: Date.now(),
            loadedUrl: settings.aggregatorUrl,
            isLoading: false,
          });

          // 按频道 group 字段分组归类
          if (channels.length > 0) {
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

            set({ groups });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to refresh channels',
            isLoading: false,
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
        const { channels, isCheckingAvailability, _abortController } = get();
        if (isCheckingAvailability || channels.length === 0) return;

        // 中断上一次未完成的检测
        if (_abortController) {
          _abortController.abort();
        }

        const targetChannels = groupName
          ? channels.filter(ch => ch.group === groupName)
          : channels;

        if (targetChannels.length === 0) return;

        const newController = new AbortController();
        set({
          isCheckingAvailability: true,
          availabilityProgress: { checked: 0, total: targetChannels.length },
          _abortController: newController,
        });

        const channelsToCheck = targetChannels.map(ch => ({ id: ch.id, url: ch.url }));

        checkChannelsAvailability(
          channelsToCheck,
          (checked, total) => {
            set({ availabilityProgress: { checked, total } });
          },
          newController.signal
        ).then((results) => {
          // 若 controller 已被替换，说明有新的检测任务启动，忽略本次结果
          if (get()._abortController !== newController) return;
          const resultIds = new Set(results.keys());
          const updatedChannels = channels.map(ch =>
            resultIds.has(ch.id)
              ? { ...ch, isAvailable: results.get(ch.id) }
              : ch
          );
          set({
            channels: updatedChannels,
            isCheckingAvailability: false,
            availabilityProgress: null,
            _abortController: null,
          });
        }).catch(() => {
          if (get()._abortController !== newController) return;
          set({
            isCheckingAvailability: false,
            availabilityProgress: null,
            _abortController: null,
          });
        });
      },

      abortAvailabilityCheck: () => {
        const { _abortController } = get();
        if (_abortController) {
          _abortController.abort();
        }
        set({
          isCheckingAvailability: false,
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
        return {
          ...current,
          ...incoming,
          settings,
        };
      },
    }
  )
);

/**
 * 应用启动时，根据 useSettingsStore 中持久化的 iptvSourceIndex
 * 初始化 aggregatorUrl，避免 IPTV 页面首次进入时因 aggregatorUrl 为空而无数据。
 */
const initAggregatorUrl = async () => {
  const { aggregatorUrl } = useIPTVStore.getState().settings;
  if (aggregatorUrl) return;

  const iptvSourceIndex = useSettingsStore.getState().iptvSourceIndex;
  const sources = await getIPTVSources();
  const url = sources[iptvSourceIndex]?.url || sources[0]?.url || '';
  if (url) {
    useIPTVStore.getState().setSettings({ aggregatorUrl: url });
  }
};

void initAggregatorUrl();
