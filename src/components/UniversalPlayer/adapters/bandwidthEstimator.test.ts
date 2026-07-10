import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BandwidthEstimator } from './bandwidthEstimator';

/* ─── Mock PerformanceObserver ─────────────────────────────── */

interface MockEntry {
  name: string;
  transferSize: number;
  decodedBodySize: number;
  duration: number;
  responseStart: number;
  requestStart: number;
  initiatorType?: string;
}

class MockPerformanceObserver {
  static instances: MockPerformanceObserver[] = [];
  static existingEntries: MockEntry[] = [];
  private cb: (list: { getEntries: () => MockEntry[] }) => void;
  public disposed = false;

  constructor(cb: (list: { getEntries: () => MockEntry[] }) => void) {
    this.cb = cb;
    MockPerformanceObserver.instances.push(this);
  }
  observe(): void {}
  disconnect(): void {
    this.disposed = true;
  }
  static trigger(entry: MockEntry): void {
    for (const inst of MockPerformanceObserver.instances) {
      inst.cb({ getEntries: () => [entry] });
    }
  }
  static reset(): void {
    MockPerformanceObserver.instances = [];
    MockPerformanceObserver.existingEntries = [];
  }
}

/* ─── 工具：构造 PerformanceResourceTiming 形状的对象 ────────── */

function makeEntry(opts: Partial<MockEntry> = {}): MockEntry {
  return {
    name: opts.name ?? 'https://cdn.example.com/seg.ts',
    transferSize: opts.transferSize ?? 1_000_000,
    decodedBodySize: opts.decodedBodySize ?? 0,
    duration: opts.duration ?? 1000,
    responseStart: opts.responseStart ?? 10,
    requestStart: opts.requestStart ?? 5,
    initiatorType: opts.initiatorType ?? 'fetch',
  };
}

/* ─── 时间控制 ──────────────────────────────────────────────── */

let nowMs = 1_000_000;
let dateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  MockPerformanceObserver.reset();
  nowMs = 1_000_000;
  dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
  // 注入 mock 到 globalThis
  (globalThis as unknown as { PerformanceObserver: typeof MockPerformanceObserver }).PerformanceObserver = MockPerformanceObserver;
});

afterEach(() => {
  dateSpy.mockRestore();
  vi.restoreAllMocks();
});

/* ─── BandwidthEstimator 单元测试 ───────────────────────────── */

describe('BandwidthEstimator', () => {
  let estimator: BandwidthEstimator;

  beforeEach(() => {
    estimator = new BandwidthEstimator();
  });
  afterEach(() => {
    estimator.stop();
  });

  it('U2.1 初始状态 estimate() 返回 0', () => {
    expect(estimator.estimate()).toBe(0);
  });

  it('U2.2 setAdapterValue 优先级最高', () => {
    estimator.setAdapterValue(5_000_000);
    expect(estimator.estimate()).toBe(5_000_000);
  });

  it('U2.3 adapterValue 陈旧（>3s）降级', () => {
    estimator.setAdapterValue(5_000_000);
    nowMs += 4000; // 前进 4 秒
    expect(estimator.estimate()).toBe(0);
  });

  it('U2.4 adapterValue 陈旧 + buffered 兜底', () => {
    estimator.setAdapterValue(5_000_000);
    nowMs += 4000;
    estimator.recordBufferedDelta(1_000_000, 1);
    expect(estimator.estimate()).toBeGreaterThan(0);
  });

  it('U2.5 recordFragLoaded 单次', () => {
    estimator.recordFragLoaded(1_000_000, 1); // 1MB / 1s = 8Mbps
    expect(estimator.estimate()).toBe(8_000_000);
  });

  it('U2.6 recordFragLoaded 多次 EMA 平滑', () => {
    // 三次相同样本，EMA 应收敛到同一值
    estimator.recordFragLoaded(1_000_000, 1);
    estimator.recordFragLoaded(1_000_000, 1);
    estimator.recordFragLoaded(1_000_000, 1);
    const v = estimator.estimate();
    expect(v).toBeGreaterThan(7_000_000);
    expect(v).toBeLessThanOrEqual(8_000_000);
  });

  it('U2.7 recordBufferedDelta 单次', () => {
    estimator.recordBufferedDelta(500_000, 1); // 500KB / 1s = 4Mbps
    expect(estimator.estimate()).toBe(4_000_000);
  });

  it('U2.8 滑动窗口淘汰过期样本', () => {
    estimator.recordBufferedDelta(500_000, 1); // 4Mbps 样本
    nowMs += 11_000; // 11 秒后，样本过期
    estimator.recordBufferedDelta(2_000_000, 1); // 16Mbps 新样本
    nowMs += 1_100; // 进入 estimate()，旧样本已被淘汰
    const v = estimator.estimate();
    // 应接近 16Mbps（新样本的 EMA）
    expect(v).toBeGreaterThan(12_000_000);
    expect(v).toBeLessThanOrEqual(16_000_000);
  });

  it('U2.9 钳制上限 1Gbps', () => {
    estimator.setAdapterValue(2_000_000_000); // 2Gbps
    expect(estimator.estimate()).toBe(1_000_000_000);
  });

  it('U2.10 钳制下限 <1KBps 返回 0', () => {
    // 100 字节 / 1秒 = 800bps < 1KBps(8000bps)
    estimator.recordBufferedDelta(100, 1);
    expect(estimator.estimate()).toBe(0);
  });

  it('U2.11 PO 和 buffered 都有值取 max', () => {
    // PO 路径贡献 4Mbps（500KB / 1s）
    estimator.start();
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://cdn.example.com/seg.ts',
      transferSize: 500_000,
      duration: 1000,
    }));
    // buffered 路径贡献 16Mbps（2MB / 1s）
    estimator.recordBufferedDelta(2_000_000, 1);
    const v = estimator.estimate();
    expect(v).toBe(16_000_000);
  });

  it('U2.12 start/stop 幂等', () => {
    estimator.start();
    estimator.start();
    estimator.stop();
    estimator.stop();
    // 不抛异常即通过
    expect(true).toBe(true);
  });

  it('U2.13 stop 后 estimate() 仍可调用', () => {
    estimator.recordBufferedDelta(500_000, 1);
    estimator.stop();
    // stop 后样本仍保留，estimate 应返回最近值
    expect(estimator.estimate()).toBeGreaterThan(0);
  });

  it('U2.14 NaN/负数输入防御', () => {
    estimator.setAdapterValue(NaN);
    estimator.recordBufferedDelta(-1, 1);
    estimator.recordFragLoaded(NaN, 1);
    expect(estimator.estimate()).toBe(0);
  });

  it('U2.15 recordFragLoaded durationSec=0 防御', () => {
    estimator.recordFragLoaded(1_000_000, 0);
    expect(estimator.estimate()).toBe(0);
  });

  it('U2.16 切换频道场景：旧 estimator 不受新 estimator 影响', () => {
    const estimator2 = new BandwidthEstimator();
    estimator.recordBufferedDelta(500_000, 1);
    estimator2.recordBufferedDelta(2_000_000, 1);
    expect(estimator.estimate()).toBe(4_000_000);
    expect(estimator2.estimate()).toBe(16_000_000);
    estimator2.stop();
  });

  it('U2.17 reset() 清空所有样本', () => {
    estimator.setAdapterValue(5_000_000);
    estimator.recordBufferedDelta(1_000_000, 1);
    estimator.reset();
    expect(estimator.estimate()).toBe(0);
  });

  it('U2.18 getConfidence() 初始为 none', () => {
    expect(estimator.getConfidence()).toBe('none');
  });

  it('U2.19 getConfidence() adapter 值有效时为 high', () => {
    estimator.setAdapterValue(5_000_000);
    expect(estimator.getConfidence()).toBe('high');
  });

  it('U2.20 getConfidence() adapter 陈旧时降级为 medium（有 PO 样本）', () => {
    estimator.setAdapterValue(5_000_000);
    nowMs += 4000;
    estimator.recordBufferedDelta(1_000_000, 1);
    expect(estimator.getConfidence()).toBe('medium');
  });

  it('U2.21 getConfidence() reset 后为 none', () => {
    estimator.setAdapterValue(5_000_000);
    estimator.recordBufferedDelta(1_000_000, 1);
    estimator.reset();
    expect(estimator.getConfidence()).toBe('none');
  });
});

/* ─── PerformanceObserver 集成测试 ──────────────────────────── */

describe('BandwidthEstimator PerformanceObserver 集成', () => {
  let estimator: BandwidthEstimator;

  beforeEach(() => {
    estimator = new BandwidthEstimator();
  });
  afterEach(() => {
    estimator.stop();
  });

  it('U3.1 PO 触发 ts 资源回调，estimate() 反映样本', () => {
    estimator.start();
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://cdn.example.com/seg.ts',
      transferSize: 1_000_000,
      duration: 1000,
    }));
    // 1MB / 1s = 8Mbps
    expect(estimator.estimate()).toBe(8_000_000);
  });

  it('U3.2 PO 资源 transferSize=0 + decodedBodySize>0 用 decodedBodySize 兜底', () => {
    estimator.start();
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://cdn.example.com/seg.ts',
      transferSize: 0,
      decodedBodySize: 1_000_000,
      duration: 1000,
    }));
    expect(estimator.estimate()).toBe(8_000_000);
  });

  it('U3.3 PO 资源 transferSize=0 + decodedBodySize=0 放弃样本', () => {
    estimator.start();
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://cdn.example.com/seg.ts',
      transferSize: 0,
      decodedBodySize: 0,
      duration: 1000,
    }));
    expect(estimator.estimate()).toBe(0);
  });

  it('U3.4 PO 资源 duration=0 放弃样本（避免除零）', () => {
    estimator.start();
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://cdn.example.com/seg.ts',
      transferSize: 1_000_000,
      duration: 0,
    }));
    expect(estimator.estimate()).toBe(0);
  });

  it('U3.5 PO 不支持时 start() 不抛异常', () => {
    // 临时移除 PerformanceObserver
    const orig = (globalThis as unknown as { PerformanceObserver?: unknown }).PerformanceObserver;
    delete (globalThis as unknown as { PerformanceObserver?: unknown }).PerformanceObserver;
    try {
      expect(() => estimator.start()).not.toThrow();
      expect(estimator.estimate()).toBe(0);
    } finally {
      (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = orig;
    }
  });

  it('U3.6 start() 时读取首屏已存在的资源条目', () => {
    MockPerformanceObserver.existingEntries = [
      makeEntry({
        name: 'https://cdn.example.com/seg.ts',
        transferSize: 1_000_000,
        duration: 1000,
      }),
    ];
    // mock getEntriesByType 返回首屏资源
    const origGetEntries = performance.getEntriesByType;
    performance.getEntriesByType = ((type: string) => {
      if (type === 'resource') return MockPerformanceObserver.existingEntries as unknown as PerformanceResourceTiming[];
      return [];
    }) as typeof performance.getEntriesByType;
    try {
      estimator.start();
      expect(estimator.estimate()).toBe(8_000_000);
    } finally {
      performance.getEntriesByType = origGetEntries;
    }
  });

  it('U3.7 PO 资源是非视频 URL 不计入样本', () => {
    estimator.start();
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://api.example.com/users',
      transferSize: 1_000_000,
      duration: 1000,
    }));
    expect(estimator.estimate()).toBe(0);
  });

  it('U3.8 PO 代理 URL（/ts-proxy?url=...ts）被识别', () => {
    estimator.start();
    const realUrl = 'https://cdn.example.com/seg.ts';
    MockPerformanceObserver.trigger(makeEntry({
      name: 'https://worker.example.com/ts-proxy?url=' + encodeURIComponent(realUrl),
      transferSize: 1_000_000,
      duration: 1000,
    }));
    expect(estimator.estimate()).toBe(8_000_000);
  });

  it('U3.9 stop() 后 PO disconnect 被调用', () => {
    estimator.start();
    const inst = MockPerformanceObserver.instances[MockPerformanceObserver.instances.length - 1];
    expect(inst.disposed).toBe(false);
    estimator.stop();
    expect(inst.disposed).toBe(true);
  });
});
