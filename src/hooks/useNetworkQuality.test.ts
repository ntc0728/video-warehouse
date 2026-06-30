import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkQuality } from './useNetworkQuality';
import { usePlayerStore } from '@/stores';

interface MockResourceEntry {
  name: string;
  requestStart: number;
  responseStart: number;
  initiatorType?: string;
}

function mockResourceEntries(entries: MockResourceEntry[]): void {
  const spy = vi.spyOn(performance, 'getEntriesByType');
  spy.mockImplementation((type: string) => {
    if (type !== 'resource') return [];
    return entries as unknown as PerformanceEntry[];
  });
}

describe('useNetworkQuality', () => {
  beforeEach(() => {
    usePlayerStore.setState({ bandwidthEstimate: 0 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    usePlayerStore.setState({ bandwidthEstimate: 0 });
  });

  it('C2.1 shows latency="--" when no video resources present', () => {
    mockResourceEntries([]);
    const { result } = renderHook(() => useNetworkQuality());
    // 推进 2s 触发首次采样
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.latency).toBe('--');
    expect(result.current.rating).toBe('unknown');
  });

  it('C2.2 shows numeric latency when ts resource present', () => {
    mockResourceEntries([
      {
        name: 'https://cdn.example.com/seg-01.ts',
        requestStart: 100,
        responseStart: 150,
        initiatorType: 'fetch',
      },
    ]);
    const { result } = renderHook(() => useNetworkQuality());
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    // latency = 150 - 100 = 50ms
    expect(result.current.latency).toMatch(/^\d+ms$/);
    expect(result.current.latency).toBe('50ms');
  });

  it('C2.3 recognizes proxy URL ts resources', () => {
    mockResourceEntries([
      {
        // 代理 URL，isVideoResource 需要解出内层 .ts
        name: 'https://worker.example.com/ts-proxy?url=https%3A%2F%2Fcdn.example.com%2Fseg.ts&headers=%7B%7D',
        requestStart: 200,
        responseStart: 280,
        initiatorType: 'fetch',
      },
    ]);
    const { result } = renderHook(() => useNetworkQuality());
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    // latency = 280 - 200 = 80ms
    expect(result.current.latency).toBe('80ms');
  });

  it('C2.4 rating=good when bandwidth>=500KB/s and latency<200ms', () => {
    // bandwidthBps = 4_000_000 → 4_000_000 / 8 / 1000 = 500 KB/s
    usePlayerStore.setState({ bandwidthEstimate: 4_000_000 });
    mockResourceEntries([
      {
        name: 'https://cdn.example.com/seg.ts',
        requestStart: 100,
        responseStart: 150, // latency 50ms < 200
        initiatorType: 'fetch',
      },
    ]);
    const { result } = renderHook(() => useNetworkQuality());
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.rating).toBe('good');
  });

  it('C2.5 rating=poor when bandwidth<200KB/s and latency>=400ms', () => {
    // bandwidthBps = 1_000_000 → 1_000_000 / 8 / 1000 = 125 KB/s (< 200)
    usePlayerStore.setState({ bandwidthEstimate: 1_000_000 });
    mockResourceEntries([
      {
        name: 'https://cdn.example.com/seg.ts',
        requestStart: 100,
        responseStart: 550, // latency 450ms >= 400
        initiatorType: 'fetch',
      },
    ]);
    const { result } = renderHook(() => useNetworkQuality());
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.rating).toBe('poor');
  });

  it('filters out non-video resources when computing latency', () => {
    mockResourceEntries([
      {
        name: 'https://api.example.com/users',
        requestStart: 100,
        responseStart: 600, // 500ms latency but not a video resource
        initiatorType: 'fetch',
      },
      {
        name: 'https://cdn.example.com/seg.ts',
        requestStart: 100,
        responseStart: 130, // 30ms latency, real video resource
        initiatorType: 'fetch',
      },
    ]);
    const { result } = renderHook(() => useNetworkQuality());
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    // 应仅取 video 资源 → 30ms
    expect(result.current.latency).toBe('30ms');
  });

  it('unmount cleans up timer without console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResourceEntries([]);
    const { unmount } = renderHook(() => useNetworkQuality());
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
