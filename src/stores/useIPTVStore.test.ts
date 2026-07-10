import { describe, it, expect, beforeEach } from 'vitest';
import { useIPTVStore } from './useIPTVStore';
import type { IPTVChannel } from '@/types/iptv';

const makeChannel = (id: string, name: string, group: string, sourceId = 'source-0'): IPTVChannel => ({
  id,
  name,
  url: `http://example.com/${id}.m3u8`,
  logo: '',
  group,
  sourceId,
  isAvailable: undefined,
  isFavorite: false,
});

describe('useIPTVStore', () => {
  beforeEach(() => {
    useIPTVStore.setState({
      channels: [],
      groups: [],
      selectedChannel: null,
      filter: {},
      isLoading: false,
      error: null,
      lastRefresh: null,
      playHistory: [],
      favoriteChannelIds: [],
    });
  });

  describe('toggleFavorite', () => {
    it('添加收藏', () => {
      useIPTVStore.setState({ channels: [makeChannel('ch1', '频道1', '央视')] });
      useIPTVStore.getState().toggleFavorite('ch1');
      const state = useIPTVStore.getState();
      expect(state.favoriteChannelIds).toContain('ch1');
      expect(state.channels[0].isFavorite).toBe(true);
    });

    it('取消收藏', () => {
      useIPTVStore.setState({
        channels: [makeChannel('ch1', '频道1', '央视')],
        favoriteChannelIds: ['ch1'],
      });
      useIPTVStore.getState().toggleFavorite('ch1');
      const state = useIPTVStore.getState();
      expect(state.favoriteChannelIds).not.toContain('ch1');
      expect(state.channels[0].isFavorite).toBe(false);
    });
  });

  describe('setChannels', () => {
    it('加载频道时同步 isFavorite 标记', () => {
      useIPTVStore.setState({ favoriteChannelIds: ['ch1', 'ch3'] });
      const channels = [
        makeChannel('ch1', '频道1', '央视'),
        makeChannel('ch2', '频道2', '卫视'),
        makeChannel('ch3', '频道3', '央视'),
      ];
      useIPTVStore.getState().setChannels(channels);
      const state = useIPTVStore.getState();
      expect(state.channels[0].isFavorite).toBe(true);
      expect(state.channels[1].isFavorite).toBe(false);
      expect(state.channels[2].isFavorite).toBe(true);
    });
  });

  describe('getFilteredChannels', () => {
    beforeEach(() => {
      useIPTVStore.setState({
        channels: [
          makeChannel('ch1', 'CCTV1', '央视'),
          makeChannel('ch2', '湖南卫视', '卫视'),
          makeChannel('ch3', 'CCTV5', '央视'),
          makeChannel('ch4', '体育频道', '体育'),
        ],
      });
    });

    it('按分组过滤', () => {
      useIPTVStore.setState({ filter: { group: '央视' } });
      const result = useIPTVStore.getState().getFilteredChannels();
      expect(result).toHaveLength(2);
    });

    it('按关键词过滤', () => {
      useIPTVStore.setState({ filter: { keyword: 'CCTV' } });
      const result = useIPTVStore.getState().getFilteredChannels();
      expect(result).toHaveLength(2);
    });

    it('无过滤条件返回全部', () => {
      useIPTVStore.setState({ filter: {} });
      const result = useIPTVStore.getState().getFilteredChannels();
      expect(result).toHaveLength(4);
    });
  });

  describe('recordPlay', () => {
    it('记录播放历史', () => {
      useIPTVStore.setState({ channels: [makeChannel('ch1', '频道1', '央视')] });
      useIPTVStore.getState().recordPlay('ch1');
      const state = useIPTVStore.getState();
      expect(state.playHistory).toHaveLength(1);
      expect(state.playHistory[0].channelId).toBe('ch1');
      expect(state.channels[0].lastPlayed).toBeDefined();
    });

    it('重复播放移到最前面', () => {
      useIPTVStore.setState({ channels: [makeChannel('ch1', '频道1', '央视'), makeChannel('ch2', '频道2', '卫视')] });
      useIPTVStore.getState().recordPlay('ch1');
      useIPTVStore.getState().recordPlay('ch2');
      useIPTVStore.getState().recordPlay('ch1');
      const state = useIPTVStore.getState();
      expect(state.playHistory[0].channelId).toBe('ch1');
      expect(state.playHistory).toHaveLength(2);
    });
  });

  describe('clearPlayHistory', () => {
    it('清空播放历史', () => {
      useIPTVStore.setState({
        playHistory: [{ channelId: 'ch1', channelName: '频道1', playedAt: Date.now() }],
      });
      useIPTVStore.getState().clearPlayHistory();
      expect(useIPTVStore.getState().playHistory).toEqual([]);
    });
  });

  describe('clearFavorites', () => {
    it('清空收藏', () => {
      useIPTVStore.setState({
        channels: [makeChannel('ch1', '频道1', '央视')],
        favoriteChannelIds: ['ch1'],
      });
      useIPTVStore.getState().clearFavorites();
      const state = useIPTVStore.getState();
      expect(state.favoriteChannelIds).toEqual([]);
      expect(state.channels[0].isFavorite).toBe(false);
    });
  });
});
