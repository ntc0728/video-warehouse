import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BasePlayerAdapter } from './PlayerAdapter';
import { BandwidthEstimator } from './bandwidthEstimator';

/* ─── Mock PerformanceObserver（bandwidthEstimator.start 依赖） ─── */

beforeEach(() => {
  // 提供 PerformanceObserver 占位，避免 start() 因不支持而提前 return
  (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = class {
    observe(): void {}
    disconnect(): void {}
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ─── 创建最小可实例化的子类 ─────────────────────────────────── */

class TestAdapter extends BasePlayerAdapter {
  async play(): Promise<void> {}
  pause(): void {}
  seek(): void {}
  destroy(): void {
    this.detach();
  }
}

describe('BasePlayerAdapter estimator 生命周期', () => {
  it('U4.1 attach 时 estimator.start 被调用', () => {
    const adapter = new TestAdapter('https://example.com/x.mp4');
    const spy = vi.spyOn(adapter.getEstimator(), 'start');
    const video = document.createElement('video');
    adapter.attach(video);
    expect(spy).toHaveBeenCalledTimes(1);
    adapter.destroy();
  });

  it('U4.2 detach 时 estimator.stop 被调用', () => {
    const adapter = new TestAdapter('https://example.com/x.mp4');
    const video = document.createElement('video');
    adapter.attach(video);
    const spy = vi.spyOn(adapter.getEstimator(), 'stop');
    adapter.detach();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('U4.3 switchSource 时 estimator.reset 被调用且样本清空', () => {
    const adapter = new TestAdapter('https://example.com/x.mp4');
    const video = document.createElement('video');
    adapter.attach(video);
    adapter.getEstimator().setAdapterValue(5_000_000);
    expect(adapter.getEstimator().estimate()).toBe(5_000_000);
    adapter.switchSource('https://example.com/y.mp4');
    expect(adapter.getEstimator().estimate()).toBe(0);
    adapter.destroy();
  });

  it('U4.4 getBandwidthEstimate 默认走 estimator', () => {
    const adapter = new TestAdapter('https://example.com/x.mp4');
    const video = document.createElement('video');
    adapter.attach(video);
    adapter.getEstimator().setAdapterValue(3_000_000);
    expect(adapter.getBandwidthEstimate()).toBe(3_000_000);
    adapter.destroy();
  });

  it('U4.5 getEstimator() 返回内部 estimator 实例（同一对象）', () => {
    const adapter = new TestAdapter('https://example.com/x.mp4');
    const est1 = adapter.getEstimator();
    const est2 = adapter.getEstimator();
    expect(est1).toBe(est2);
    expect(est1).toBeInstanceOf(BandwidthEstimator);
  });
});
