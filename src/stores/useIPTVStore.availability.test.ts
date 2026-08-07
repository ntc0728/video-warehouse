/**
 * useIPTVStore — 检测结果「按组隔离」单元测试
 *
 * 覆盖 2026-08-07 整改（ADR-019）：channel.isAvailable 全局共享导致跨 tab 检测结果
 * 残留的 bug，改为 availabilityResults: Record<groupId, Record<channelId, boolean>>。
 * 核心断言：检测「组A」不清空/不覆盖「组B」结果；abort 只删当前组。
 *
 * 依赖隔离：mock @/services/iptvService 的 checkChannelsAvailability（避免真实网络）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useIPTVStore } from './useIPTVStore';
import type { IPTVChannel } from '@/types/iptv';

vi.mock('@/services/iptvService', () => {
  return {
    fetchAndParsePlaylist: vi.fn(),
    checkChannelsAvailability: vi.fn(),
  };
});

// 引入被 mock 的模块以配置返回值
import { checkChannelsAvailability } from '@/services/iptvService';
const mockedCheck = vi.mocked(checkChannelsAvailability);

const makeChannel = (id: string, name: string, group: string): IPTVChannel => ({
  id, name, url: `http://example.com/${id}.m3u8`, logo: '', group, sourceId: 'source-0', isFavorite: false,
});

/** 触发一次检测并等待结果写入（resolve mock 后 flush 微任务） */
async function runCheck(group: string | null) {
  useIPTVStore.getState().checkAvailability(group);
  await new Promise((r) => setTimeout(r, 0));
}

describe('useIPTVStore - availabilityResults 按组隔离', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useIPTVStore.setState({
      channels: [
        makeChannel('c1', '频道1', '央视'),
        makeChannel('c2', '频道2', '央视'),
        makeChannel('c3', '频道3', '卫视'),
      ],
      groups: [],
      selectedChannel: null,
      filter: {},
      isLoading: false,
      error: null,
      lastRefresh: null,
      isCheckingAvailability: false,
      checkingGroupId: null,
      availabilityProgress: null,
      availabilityResults: {},
      _abortController: null,
    });
  });

  it('检测指定分组：结果写入该分组 key，不影响预置的其他组结果', async () => {
    // 预置「全部」组已有检测结果（模拟之前检测过全部）
    useIPTVStore.setState({
      availabilityResults: { __all__: { c1: true, c2: false, c3: true } },
    });
    // mock 本次「央视」组检测：c1 可用、c2 不可用
    mockedCheck.mockResolvedValue(new Map([['c1', true], ['c2', false]]));

    await runCheck('央视');

    const results = useIPTVStore.getState().availabilityResults;
    // 「央视」组被写入
    expect(results['央视']).toEqual({ c1: true, c2: false });
    // 「全部」组结果保留，未被清空或覆盖
    expect(results['__all__']).toEqual({ c1: true, c2: false, c3: true });
    // 检测状态复位
    expect(useIPTVStore.getState().isCheckingAvailability).toBe(false);
    expect(useIPTVStore.getState().checkingGroupId).toBeNull();
  });

  it('无分组参数检测：写入 __all__ key', async () => {
    mockedCheck.mockResolvedValue(new Map([['c1', true], ['c2', false], ['c3', true]]));
    await runCheck(null);
    const results = useIPTVStore.getState().availabilityResults;
    expect(Object.keys(results)).toEqual(['__all__']);
    expect(results['__all__']).toEqual({ c1: true, c2: false, c3: true });
  });

  it('检测新分组时，只清空当前组旧结果，其他组保留', async () => {
    // 预置「央视」有旧结果、「卫视」有旧结果
    useIPTVStore.setState({
      availabilityResults: { 央视: { c1: true, c2: true }, 卫视: { c3: true } },
    });
    mockedCheck.mockResolvedValue(new Map([['c1', true], ['c2', true]]));

    // 重新检测「央视」：其旧结果被清空重写，但「卫视」保留
    await runCheck('央视');
    const results = useIPTVStore.getState().availabilityResults;
    expect(results['央视']).toEqual({ c1: true, c2: true });
    expect(results['卫视']).toEqual({ c3: true });
  });

  it('abortAvailabilityCheck：只删除当前检测分组的结果，其他组保留', async () => {
    // 预置「全部」已有结果
    useIPTVStore.setState({
      availabilityResults: { __all__: { c1: true, c2: true, c3: true } },
    });
    // 发起「卫视」组检测（mock 永不 resolve，模拟在途）
    mockedCheck.mockReturnValue(new Promise(() => {}));
    useIPTVStore.getState().checkAvailability('卫视');
    expect(useIPTVStore.getState().checkingGroupId).toBe('卫视');

    // 中断：应删除「卫视」组结果，但「全部」组保留
    useIPTVStore.getState().abortAvailabilityCheck();
    const results = useIPTVStore.getState().availabilityResults;
    expect(results['卫视']).toBeUndefined();
    expect(results['__all__']).toEqual({ c1: true, c2: true, c3: true });
    expect(useIPTVStore.getState().isCheckingAvailability).toBe(false);
    expect(useIPTVStore.getState().checkingGroupId).toBeNull();
  });
});
