/**
 * settingsBackup 单元测试
 *
 * 覆盖：collectBackup / parseBackup / applyBackup 三条链路，
 *   含敏感字段（tmdbAccessToken/translationApiKey）经 setter 写入、
 *   收藏/历史恢复、非法文件校验。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collectBackup, parseBackup, applyBackup, type SettingsBackup } from './settingsBackup';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';

// Mock IndexedDB 层（useUserStore 依赖）
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

describe('settingsBackup', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      tmdbAccessToken: '',
      translationApiKey: '',
      videoSourceIds: [],
    });
    useUserStore.setState({ collections: [], history: [], _initialized: true });
  });

  afterEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ tmdbAccessToken: '', translationApiKey: '' });
    useUserStore.setState({ collections: [], history: [] });
  });

  it('collectBackup 收集设置 + 收藏 + 历史', () => {
    useSettingsStore.getState().setTMDBToken('tok-123');
    useSettingsStore.getState().setTranslationApiKey('sec-456');
    useUserStore.setState({
      collections: [{ id: 'col-1', videoId: 'v1', title: '电影A', type: 'movie', addedAt: 1 }],
      history: [{ id: 'hist-1', videoId: 'h1', progress: 50, duration: 100, updatedAt: 2 }],
    });

    const backup = collectBackup();
    expect(backup.version).toBe(1);
    expect(backup.settings.tmdbAccessToken).toBe('tok-123'); // 内存明文导出
    expect(backup.settings.translationApiKey).toBe('sec-456');
    expect(backup.collections).toHaveLength(1);
    expect(backup.history).toHaveLength(1);
  });

  it('parseBackup 校验基本结构，缺省字段补默认', () => {
    const parsed = parseBackup(JSON.stringify({ settings: { theme: 'dark' } }));
    expect(parsed.version).toBe(1);
    expect(parsed.settings.theme).toBe('dark');
    expect(parsed.collections).toEqual([]);
    expect(parsed.history).toEqual([]);
  });

  it('parseBackup 无 settings 时抛出', () => {
    expect(() => parseBackup(JSON.stringify({ version: 1 }))).toThrow(/格式不正确/);
    expect(() => parseBackup('not-json')).toThrow();
  });

  it('applyBackup 恢复设置（敏感字段经 setter 写内存明文）', () => {
    const backup: SettingsBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { theme: 'dark', tmdbAccessToken: 'restored-token-123', translationApiKey: 'restored-sec' },
      collections: [],
      history: [],
    };
    applyBackup(backup);
    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('restored-token-123');
    expect(useSettingsStore.getState().translationApiKey).toBe('restored-sec');
  });

  it('applyBackup 恢复收藏与历史（先清空再写入）', () => {
    // 预置旧数据
    useUserStore.setState({
      collections: [{ id: 'col-old', videoId: 'old', title: '旧', type: 'movie', addedAt: 1 }],
      history: [{ id: 'hist-old', videoId: 'old-h', progress: 10, duration: 100, updatedAt: 1 }],
    });

    const backup: SettingsBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {},
      collections: [{ id: 'col-new', videoId: 'new1', title: '新电影', type: 'movie', year: 2020, rating: 8, sourceIndex: 0, addedAt: 3 }],
      history: [{ id: 'hist-new', videoId: 'new-h1', progress: 30, duration: 100, updatedAt: Date.now() }],
    };
    applyBackup(backup);

    const user = useUserStore.getState();
    expect(user.collections).toHaveLength(1);
    expect(user.collections[0].videoId).toBe('new1');
    expect(user.history).toHaveLength(1);
    expect(user.history[0].videoId).toBe('new-h1');
  });

  it('applyBackup 仅写入 DEFAULT_SETTINGS 存在的字段（防污染）', () => {
    const backup: SettingsBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { theme: 'dark', notARealField: 'pollute' } as unknown as Record<string, unknown>,
      collections: [],
      history: [],
    };
    applyBackup(backup);
    const state = useSettingsStore.getState() as unknown as Record<string, unknown>;
    expect(state.theme).toBe('dark');
    expect(state.notARealField).toBeUndefined();
  });
});
