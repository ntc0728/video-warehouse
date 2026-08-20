import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkSpeed } from './useNetworkSpeed';
import { usePlayerStore } from '@/stores';

describe('useNetworkSpeed', () => {
  beforeEach(() => {
    // 每个 case 重置 store 带宽为 0，避免污染
    usePlayerStore.setState({ bandwidthEstimate: 0 });
    // 使用假定时器避免等待真实 1s
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    usePlayerStore.setState({ bandwidthEstimate: 0 });
  });

  it('C1.1 shows "-- KB/s" when bandwidthEstimate is 0', () => {
    const { result } = renderHook(() => useNetworkSpeed());
    expect(result.current).toBe('-- KB/s');
  });

  it('C1.2 shows "625.0 KB/s" when bandwidthEstimate = 5_000_000 (5M bps = 625 KB/s)', () => {
    // 5_000_000 bps / 8 = 625_000 B/s = 625.0 KB/s（未达 MB 阈值 1_000_000 B/s）
    usePlayerStore.setState({ bandwidthEstimate: 5_000_000 });
    const { result } = renderHook(() => useNetworkSpeed());
    expect(result.current).toBe('625.0 KB/s');
  });

  it('C1.2a shows "1.0 MB/s" when bandwidthEstimate = 8_000_000 (8M bps = 1 MB/s)', () => {
    // 8_000_000 bps / 8 = 1_000_000 B/s = 1.0 MB/s（恰好达到 MB 阈值）
    usePlayerStore.setState({ bandwidthEstimate: 8_000_000 });
    const { result } = renderHook(() => useNetworkSpeed());
    expect(result.current).toBe('1.0 MB/s');
  });

  it('C1.3 shows "25.0 KB/s" when bandwidthEstimate = 200_000', () => {
    usePlayerStore.setState({ bandwidthEstimate: 200_000 });
    const { result } = renderHook(() => useNetworkSpeed());
    expect(result.current).toBe('25.0 KB/s');
  });

  it('C1.4 shows "63 B/s" when bandwidthEstimate = 500', () => {
    usePlayerStore.setState({ bandwidthEstimate: 500 });
    const { result } = renderHook(() => useNetworkSpeed());
    expect(result.current).toBe('63 B/s');
  });

  it('C1.5 unmount cleans up timer without console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useNetworkSpeed());
    unmount();
    // 推进定时器，确认卸载后没有泄漏的回调
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('updates when store.bandwidthEstimate changes within interval', () => {
    const { result } = renderHook(() => useNetworkSpeed());
    expect(result.current).toBe('-- KB/s');
    // 模拟 store 在定时器触发前更新
    act(() => {
      usePlayerStore.setState({ bandwidthEstimate: 8_000_000 });
      vi.advanceTimersByTime(1000);
    });
    // 8_000_000 / 8 = 1_000_000 B/s = 1.0 MB/s
    expect(result.current).toBe('1.0 MB/s');
  });
});
