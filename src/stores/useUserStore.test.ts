import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserStore } from './useUserStore';

// Mock IndexedDB layer
vi.mock('@/services/database', () => ({
  getHistory: vi.fn().mockResolvedValue([]),
  upsertHistoryRecord: vi.fn().mockResolvedValue(undefined),
  removeHistoryRecord: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined),
  getCollections: vi.fn().mockResolvedValue([]),
  addCollectionRecord: vi.fn().mockResolvedValue(undefined),
  removeCollectionByVideoId: vi.fn().mockResolvedValue(undefined),
  clearCollections: vi.fn().mockResolvedValue(undefined),
}));

describe('useUserStore - addHistory with new fields', () => {
  beforeEach(() => {
    useUserStore.setState({ history: [], _initialized: true });
  });

  it('新增记录包含 vodId', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].vodId).toBe('456');
  });

  it('更新已有记录时合并新字段', () => {
    // 先创建一条记录
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
      currentSeasonId: 'season-vod-456',
    });

    // 再更新同一视频（去重匹配）
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 80,
      duration: 100,
      vodId: '789',
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].vodId).toBe('789');
    expect(history[0].progress).toBe(80);
  });

  it('updateHistoryProgress 转发 vodId', () => {
    useUserStore.getState().updateHistoryProgress({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].vodId).toBe('456');
  });

  it('新字段为 undefined 时保留旧值', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
    });

    // 更新时不传新字段
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 90,
      duration: 100,
    });

    const history = useUserStore.getState().history;
    expect(history[0].vodId).toBe('456');
  });

  it('按 episodeUrl 去重：同一集更新进度', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      episodeUrl: 'http://example.com/ep1.m3u8',
    });

    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 80,
      duration: 100,
      episodeUrl: 'http://example.com/ep1.m3u8',
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].progress).toBe(80);
  });

  it('不同 episodeUrl 创建不同记录', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      episodeUrl: 'http://example.com/ep1.m3u8',
    });

    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 30,
      duration: 100,
      episodeUrl: 'http://example.com/ep2.m3u8',
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(2);
  });

  it('有 episodeUrl 的记录不会被无 episodeUrl 的记录覆盖', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      episodeUrl: 'http://example.com/ep1.m3u8',
    });

    // 无 episodeUrl 的记录应该创建新记录，不覆盖已有记录
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 90,
      duration: 100,
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(2);
    // 有 episodeUrl 的记录仍在
    expect(history.find(h => h.episodeUrl === 'http://example.com/ep1.m3u8')).toBeTruthy();
    // 无 episodeUrl 的记录也创建了
    expect(history.find(h => !h.episodeUrl)).toBeTruthy();
  });
});

describe('useUserStore - removeHistoryByVideo', () => {
  beforeEach(() => {
    useUserStore.setState({ history: [], _initialized: true });
  });

  it('删除指定视频的全部记录（含多线路/多集），不影响其他视频', () => {
    const add = useUserStore.getState().addHistory;
    // 电影两条线路记录
    add({ videoId: 'movie-1', progress: 30, duration: 100, episodeUrl: 'http://x.com/l1.m3u8' });
    add({ videoId: 'movie-1', progress: 60, duration: 100, episodeUrl: 'http://x.com/l2.m3u8' });
    // 剧集一集记录
    add({ videoId: 'tv-1', progress: 20, duration: 100, episodeUrl: 'http://x.com/ep.m3u8', seasonNumber: 1, episodeLabel: '第1集' });
    // 其他视频
    add({ videoId: 'movie-2', progress: 10, duration: 100, episodeUrl: 'http://x.com/l3.m3u8' });

    useUserStore.getState().removeHistoryByVideo('movie-1');

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(2);
    expect(history.every(h => h.videoId !== 'movie-1')).toBe(true);
    expect(history.some(h => h.videoId === 'tv-1')).toBe(true);
    expect(history.some(h => h.videoId === 'movie-2')).toBe(true);
  });
});
