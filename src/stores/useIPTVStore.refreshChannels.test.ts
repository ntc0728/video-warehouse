/**
 * refreshChannels 静默刷新契约 / 单飞锁 / 失败语义单测。
 *
 * 静默刷新契约（useIPTVStore.ts:256-259 `isLoading: !hasChannels`）是 IPTV 页的核心观感约定
 * （慢源拖尾期间不得出现全屏 loading，见 docs/agents/patterns.md），此前零覆盖；
 * 它本质是**状态序列**而非 DOM 现象，故只在 store 层用单测钉死（浏览器侧无法证明「全程未出现」）。
 *
 * 三个外部依赖模块全部 mock：database（IndexedDB 在 jsdom 不存在）、iptvOrgService（网络）、
 * iptvService（网络）。`channelMatchKeys` / `matchLogoForChannel` 给最小可用实现，
 * 以便真实走通 mergeOrgWithLocal 的合并分支。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IPTVChannel } from '@/types/iptv';

vi.mock('@/services/database', () => ({
  getCachedIPTVChannels: vi.fn(async () => null),
  setCachedIPTVChannels: vi.fn(async () => {}),
}));

vi.mock('@/services/iptvOrgService', () => ({
  fetchIptvOrgChinaChannels: vi.fn(),
  fetchCnDisplayNames: vi.fn(async () => ({ names: {}, channels: [] })),
  channelMatchKeys: (ch: { name: string }) => new Set([ch.name]),
  matchLogoForChannel: () => undefined,
}));

vi.mock('@/services/iptvService', () => ({
  fetchAndParsePlaylist: vi.fn(),
  fetchSingleSourceChannels: vi.fn(),
}));

import { useIPTVStore } from './useIPTVStore';
import { PlaylistSourceType } from '@/types/iptv';
import { fetchAndParsePlaylist } from '@/services/iptvService';
import { fetchIptvOrgChinaChannels } from '@/services/iptvOrgService';

const mockPlaylist = vi.mocked(fetchAndParsePlaylist);
const mockOrg = vi.mocked(fetchIptvOrgChinaChannels);

const makeChannel = (id: string, name: string, group: string, sourceId = 'source-0'): IPTVChannel => ({
  id,
  name,
  url: `http://example.com/${id}.m3u8`,
  logo: '',
  group,
  sourceId,
  isFavorite: false,
});

const emptyPlaylist = {
  channels: [] as IPTVChannel[],
  sourceType: PlaylistSourceType.MULTI_CHANNEL,
  sourceErrors: [] as Array<{ index: number; url: string; error: string }>,
  bySource: {} as Record<string, IPTVChannel[]>,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const refresh = () => useIPTVStore.getState().refreshChannels();

beforeEach(() => {
  mockPlaylist.mockReset();
  mockOrg.mockReset();
  useIPTVStore.setState({
    channels: [],
    groups: [],
    sourceChannels: {},
    extraSourceIds: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastRefresh: null,
    playHistory: [],
    favoriteChannelIds: [],
    settings: {
      ...useIPTVStore.getState().settings,
      aggregatorUrl: 'http://src/a.m3u8',
      aggregatorUrls: ['http://src/a.m3u8'],
      proxyUrl: '',
    },
  });
});

describe('refreshChannels · 静默刷新契约', () => {
  it('已有频道时全程不进入全屏 loading（仅有 isRefreshing）', async () => {
    useIPTVStore.setState({ channels: [makeChannel('ch1', '频道1', '央视')] });
    const pending = deferred<typeof emptyPlaylist>();
    mockPlaylist.mockReturnValue(pending.promise);
    mockOrg.mockRejectedValue(new Error('org 挂'));

    const inFlight = refresh();

    expect(useIPTVStore.getState().isLoading).toBe(false); // ★ 静默契约
    expect(useIPTVStore.getState().isRefreshing).toBe(true);

    pending.resolve(emptyPlaylist);
    await inFlight;

    expect(useIPTVStore.getState().isLoading).toBe(false);
    expect(useIPTVStore.getState().isRefreshing).toBe(false);
  });

  it('首次加载（无频道）才进入全屏 loading，落地后退出', async () => {
    const pending = deferred<typeof emptyPlaylist>();
    mockPlaylist.mockReturnValue(pending.promise);
    mockOrg.mockRejectedValue(new Error('org 挂'));

    const inFlight = refresh();

    expect(useIPTVStore.getState().isLoading).toBe(true);
    expect(useIPTVStore.getState().isRefreshing).toBe(true);

    pending.resolve(emptyPlaylist);
    await inFlight;

    expect(useIPTVStore.getState().isLoading).toBe(false);
    expect(useIPTVStore.getState().isRefreshing).toBe(false);
    expect(useIPTVStore.getState().lastRefresh).not.toBeNull();
  });

  it('单飞：刷新在飞时重复调用直接返回，不重复打上游', async () => {
    const pending = deferred<typeof emptyPlaylist>();
    mockPlaylist.mockReturnValue(pending.promise);
    mockOrg.mockRejectedValue(new Error('org 挂'));

    const first = refresh();
    const second = refresh(); // 连点按钮 / 多入口并发（页面 bootstrap、自动刷新、下拉刷新）
    await second;
    expect(mockPlaylist).toHaveBeenCalledTimes(1);

    pending.resolve(emptyPlaylist);
    await first;

    // 主链路落地即释放单飞锁 → 下一次刷新可以照常发起
    const again = deferred<typeof emptyPlaylist>();
    mockPlaylist.mockReturnValue(again.promise);
    const third = refresh();
    await Promise.resolve();
    expect(mockPlaylist).toHaveBeenCalledTimes(2);
    again.resolve(emptyPlaylist);
    await third;
  });
});

describe('refreshChannels · 失败与合并语义', () => {
  it('org 与本地源同时失败 → 记错误、退出 loading、刷新时间仍推进', async () => {
    mockOrg.mockRejectedValue(new Error('cn.m3u 不可达'));
    mockPlaylist.mockRejectedValue(new Error('源未配置'));

    await refresh();

    const state = useIPTVStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isRefreshing).toBe(false);
    // 双败时直接透出 org 侧原始错误（useIPTVStore.ts:272-278），只有非 Error 才回退固定文案
    expect(state.error).toBe('cn.m3u 不可达');
    expect(state.channels).toEqual([]);
    expect(state.lastRefresh).not.toBeNull();
  });

  it('本地源失败但 org 主干成功 → 主干照常渲染，错误提示保留', async () => {
    mockOrg.mockResolvedValue({ channels: [makeChannel('iptvorg-cctv1', 'CCTV1', '央视', 'iptvorg')] });
    mockPlaylist.mockRejectedValue(new Error('源未配置'));

    await refresh();

    const state = useIPTVStore.getState();
    expect(state.channels.map((c) => c.id)).toEqual(['iptvorg-cctv1']);
    expect(state.error).toBeNull(); // 本地源整体失败（非 sourceErrors）时无额外错误文案
    expect(state.lastRefresh).not.toBeNull();
  });

  it('未勾选本地源时保留 org 原始流；勾选后同名频道改用本地流（本地优先）', async () => {
    const orgChannel = makeChannel('iptvorg-cctv1', 'CCTV1', '央视', 'iptvorg');
    const localChannel = makeChannel('0-channel-0', 'CCTV1', '央视', 'source-0');
    mockOrg.mockResolvedValue({ channels: [orgChannel] });
    mockPlaylist.mockResolvedValue({
      ...emptyPlaylist,
      channels: [localChannel],
      bySource: { 'source-0': [localChannel] },
    });

    await refresh();

    // ① 未勾选（extraSourceIds 为空）→ 保留 org 流
    expect(useIPTVStore.getState().channels[0].sourceId).toBe('iptvorg');
    expect(Object.keys(useIPTVStore.getState().sourceChannels)).toEqual(['source-0']);

    // ② 勾选 source-0 → 同名频道替换为本地流
    useIPTVStore.setState({ extraSourceIds: ['source-0'] });
    await refresh();

    const merged = useIPTVStore.getState().channels[0];
    expect(merged.sourceId).toBe('source-0');
    expect(merged.url).toBe('http://example.com/0-channel-0.m3u8');
  });
});
