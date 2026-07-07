import { describe, it, expect, beforeEach } from 'vitest';
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
  getRatings: vi.fn().mockResolvedValue([]),
  setRatingRecord: vi.fn().mockResolvedValue(undefined),
  removeRatingRecord: vi.fn().mockResolvedValue(undefined),
}));

describe('useUserStore - addHistory with new fields', () => {
  beforeEach(() => {
    useUserStore.setState({ history: [], _initialized: true });
  });

  it('新增记录包含 vodId、currentSeason、currentEpisode', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
      currentSeason: 2,
      currentEpisode: 5,
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].vodId).toBe('456');
    expect(history[0].currentSeason).toBe(2);
    expect(history[0].currentEpisode).toBe(5);
  });

  it('更新已有记录时合并新字段', () => {
    // 先创建一条记录
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
      currentSeason: 1,
      currentEpisode: 3,
    });

    // 再更新同一视频（去重匹配）
    useUserStore.getState().addHistory({
      videoId: '123',
      episodeId: 'ep-5',
      progress: 80,
      duration: 100,
      vodId: '789',
      currentSeason: 2,
      currentEpisode: 5,
    });

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].vodId).toBe('789');
    expect(history[0].currentSeason).toBe(2);
    expect(history[0].currentEpisode).toBe(5);
    expect(history[0].progress).toBe(80);
  });

  it('updateHistoryProgress 转发 vodId、currentSeason、currentEpisode', () => {
    useUserStore.getState().updateHistoryProgress(
      '123', undefined, 50, 100,
      undefined, undefined, undefined, undefined, undefined, undefined,
      '456', 2, 5,
    );

    const history = useUserStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].vodId).toBe('456');
    expect(history[0].currentSeason).toBe(2);
    expect(history[0].currentEpisode).toBe(5);
  });

  it('新字段为 undefined 时保留旧值', () => {
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 50,
      duration: 100,
      vodId: '456',
      currentSeason: 2,
      currentEpisode: 5,
    });

    // 更新时不传新字段
    useUserStore.getState().addHistory({
      videoId: '123',
      progress: 90,
      duration: 100,
    });

    const history = useUserStore.getState().history;
    expect(history[0].vodId).toBe('456');
    expect(history[0].currentSeason).toBe(2);
    expect(history[0].currentEpisode).toBe(5);
  });
});
