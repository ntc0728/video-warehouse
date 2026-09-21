/**
 * useIPTVAutoRefresh 单测 —— 间隔换算、5min 检查节流、路由/开关门禁、在飞不打扰、卸载清理。
 *
 * 用假定时器在 store 层验「自动刷新到底会不会触发」，而不是在浏览器里用 page.clock 验：
 * page.clock.install 会同时接管 requestAnimationFrame/performance.now，揭示动画会被冻住，
 * 「界面无闪烁」这类过程型断言在该环境下只能得到假绿；而它的真实契约（是否发起 refreshChannels）
 * 本就是纯逻辑，单测精度更高、零墙钟成本。
 *
 * useIPTVStore 整体 mock 为最小替身（本 hook 只读 settings.autoRefresh / settings.refreshIntervalHours，
 * 并调用 getState().refreshChannels()）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => {
  const state = {
    settings: { autoRefresh: true, refreshIntervalHours: 1 },
    lastRefresh: null as number | null,
    isLoading: false,
    refreshChannels: vi.fn(),
  };
  return { state };
});

vi.mock('@/stores/useIPTVStore', () => ({
  useIPTVStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { useIPTVAutoRefresh } from './useIPTVAutoRefresh';

const MIN = 60 * 1000;
/** intervalMs 为 1h 时，检查节流被钳到 min(1h, 5min) = 5min → 12 次检查后到达 1h */
const wrap = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

const render = (path = '/iptv') =>
  renderHook(() => useIPTVAutoRefresh(), { wrapper: wrap(path) });

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  h.state.settings = { autoRefresh: true, refreshIntervalHours: 1 };
  h.state.lastRefresh = null;
  h.state.isLoading = false;
  h.state.refreshChannels.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIPTVAutoRefresh', () => {
  it('从未刷新过（lastRefresh 为空）时挂载即刷新一次', () => {
    render();
    expect(h.state.refreshChannels).toHaveBeenCalledTimes(1);
  });

  it('未到间隔不刷新，累计满 1h 才触发', async () => {
    h.state.lastRefresh = Date.now();
    render();
    expect(h.state.refreshChannels).not.toHaveBeenCalled();

    await advance(5 * MIN); // 第一次检查点：距上次刷新仅 5min < 1h
    expect(h.state.refreshChannels).not.toHaveBeenCalled();

    await advance(55 * MIN); // 累计 60min = intervalMs → 触发
    expect(h.state.refreshChannels).toHaveBeenCalledTimes(1);
  });

  it('非 /iptv 路由激活时不轮询（Keep-Alive 下组件仍挂载）', async () => {
    render('/');
    await advance(2 * 60 * MIN);
    expect(h.state.refreshChannels).not.toHaveBeenCalled();
  });

  it('autoRefresh 关闭时不轮询', async () => {
    h.state.settings = { autoRefresh: false, refreshIntervalHours: 1 };
    render();
    await advance(2 * 60 * MIN);
    expect(h.state.refreshChannels).not.toHaveBeenCalled();
  });

  it('refreshIntervalHours <= 0 时不轮询（不构造热循环）', async () => {
    h.state.settings = { autoRefresh: true, refreshIntervalHours: 0 };
    render();
    await advance(2 * 60 * MIN);
    expect(h.state.refreshChannels).not.toHaveBeenCalled();
  });

  it('已有刷新在飞（isLoading）时不打扰，跳过该次检查', async () => {
    h.state.isLoading = true; // lastRefresh 仍为空 → 若守卫失效必然触发
    render();
    await advance(5 * MIN);
    expect(h.state.refreshChannels).not.toHaveBeenCalled();
  });

  it('卸载后清理定时器，不再触发刷新', async () => {
    h.state.lastRefresh = Date.now();
    const { unmount } = render();
    unmount();
    await advance(2 * 60 * MIN);
    expect(h.state.refreshChannels).not.toHaveBeenCalled();
  });
});
