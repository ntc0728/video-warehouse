import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserStore } from './useUserStore';
import { getHistory, getCollections } from '@/services/database';

// Mock IndexedDB layer
vi.mock('@/services/database', () => ({
  getHistory: vi.fn().mockResolvedValue([]),
  upsertHistoryRecord: vi.fn().mockResolvedValue(undefined),
  upsertHistoryRecords: vi.fn().mockResolvedValue(undefined),
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

// ── reload 脏集合合并（2026-09-02，跨页签广播回退保护的纯单测）─────────
// reload() 用 DB 快照覆盖内存前，需把节流窗口内未落库的本地历史（historyDirtyRecords）
// 合并回快照：已有按 id 覆盖为内存值、没有的 append。否则别页签广播触发 reload
// 会把本页正在更新的进度回退成 DB 旧值。
describe('useUserStore - reload 合并脏集合（广播回退保护）', () => {
  beforeEach(() => {
    useUserStore.setState({ history: [], collections: [], _initialized: true });
    // 清空模块级脏集合与 3s 节流定时器（addHistory 遗留），避免跨用例污染
    useUserStore.getState().flushHistoryNow();
    vi.mocked(getHistory).mockResolvedValue([]);
    vi.mocked(getCollections).mockResolvedValue([]);
  });

  it('覆盖场景：DB 旧值不覆盖本页节流窗口内更新的进度', async () => {
    // 本页写入 progress 80（未 flush，仍处于脏集合）
    useUserStore.getState().addHistory({
      videoId: 'v1', progress: 80, duration: 100,
      episodeUrl: 'http://x.com/l.m3u8',
    });
    // DB 快照里还是旧值 50（如本页 3s 前 flush 的）
    vi.mocked(getHistory).mockResolvedValueOnce([{
      id: 'hist-v1-http://x.com/l.m3u8', videoId: 'v1', progress: 50,
      duration: 100, updatedAt: 1, episodeUrl: 'http://x.com/l.m3u8',
    }]);

    await useUserStore.getState().reload();

    const h = useUserStore.getState().history.find((x) => x.videoId === 'v1');
    expect(h?.progress).toBe(80);
  });

  it('append 场景：DB 无此记录（首播未 flush）时 reload 后仍保留', async () => {
    useUserStore.getState().addHistory({
      videoId: 'v2', progress: 5, duration: 100,
      episodeUrl: 'http://x.com/l.m3u8',
    });
    // DB 快照完全不含 v2
    vi.mocked(getHistory).mockResolvedValueOnce([{
      id: 'hist-vother-http://x.com/other.m3u8', videoId: 'vother', progress: 9,
      duration: 100, updatedAt: 1, episodeUrl: 'http://x.com/other.m3u8',
    }]);

    await useUserStore.getState().reload();

    const h = useUserStore.getState().history.find((x) => x.videoId === 'v2');
    expect(h?.progress).toBe(5);
  });

  it('无脏集合时 reload 正常以 DB 快照为准', async () => {
    // 本页先落库（flush 清空脏集合），内存 80
    useUserStore.getState().addHistory({
      videoId: 'v3', progress: 80, duration: 100,
      episodeUrl: 'http://x.com/l.m3u8',
    });
    useUserStore.getState().flushHistoryNow();
    // 别页签把 DB 更新到 90（如另一页签推进了进度）
    vi.mocked(getHistory).mockResolvedValueOnce([{
      id: 'hist-v3-http://x.com/l.m3u8', videoId: 'v3', progress: 90,
      duration: 100, updatedAt: 2, episodeUrl: 'http://x.com/l.m3u8',
    }]);

    await useUserStore.getState().reload();

    const h = useUserStore.getState().history.find((x) => x.videoId === 'v3');
    expect(h?.progress).toBe(90);
  });
});
