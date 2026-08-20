/**
 * 带宽估算器
 *
 * 聚合 3 个数据源，按优先级输出当前网速估算值（bps）：
 * 1. 适配器原生估算（hls.js bandwidthEstimate / dash.js getAverageThroughput）
 * 2. PerformanceObserver 监听视频资源下载速率（跨域兼容）
 * 3. 解码字节增量（usePlayerCore 通过 webkitVideoDecodedByteCount 上报）
 *
 * 设计要点：
 * - adapterValue 3 秒未更新视为陈旧，降级到 PO + 解码字节
 * - 滑动窗口 10 秒，超过 10s 的样本淘汰
 * - EMA α=0.3 平滑抖动
 * - 钳制区间 [1KBps, 1Gbps]，避免异常值
 * - start() 幂等，stop() 保留样本（仅断开 PO）
 * - reset() 清空样本（热切换时调用）
 */

import { isVideoResource } from '@/lib/videoResource';

/** 单个带宽样本 */
interface Sample {
  bps: number;
  ts: number;
}

/** adapterValue 陈旧阈值 */
const ADAPTER_VALUE_TTL_MS = 3000;
/** 滑动窗口时长 */
const WINDOW_MS = 10_000;
/** EMA 系数：新样本权重 */
const EMA_ALPHA = 0.3;
/** 钳制区间 */
const MIN_BPS = 1_000; // 1 KBps
const MAX_BPS = 1_000_000_000; // 1 Gbps

export class BandwidthEstimator {
  private adapterValue = 0;
  private adapterValueAt = 0;
  private poSamples: Sample[] = [];
  private bufferedSamples: Sample[] = [];
  private poDisposable: (() => void) | null = null;

  /** 适配器（hls.js / dash.js）主动上报带宽估算 */
  setAdapterValue(bps: number): void {
    if (!Number.isFinite(bps) || bps <= 0) return;
    this.adapterValue = bps;
    this.adapterValueAt = Date.now();
  }

  /** usePlayerCore 通过 webkitVideoDecodedByteCount 增量上报 */
  recordBufferedDelta(bytes: number, durationSec: number): void {
    if (!Number.isFinite(bytes) || bytes <= 0) return;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    const bps = (bytes * 8) / durationSec;
    if (!Number.isFinite(bps) || bps <= 0) return;
    this.pushBufferedSample(bps);
  }

  /** hls.js FRAG_LOADED 事件上报分片级字节 */
  recordFragLoaded(bytes: number, durationSec: number): void {
    if (!Number.isFinite(bytes) || bytes <= 0) return;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    const bps = (bytes * 8) / durationSec;
    if (!Number.isFinite(bps) || bps <= 0) return;
    this.pushBufferedSample(bps);
  }

  /** 启动 PerformanceObserver 监听（幂等） */
  start(): void {
    if (this.poDisposable) return;
    if (typeof PerformanceObserver === 'undefined') return;

    // 1. 同步读取首屏已存在的资源条目
    try {
      const existing = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const e of existing) {
        this.processResourceEntry(e);
      }
    } catch {
      // 忽略
    }

    // 2. 监听后续资源
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          this.processResourceEntry(e as PerformanceResourceTiming);
        }
      });
      po.observe({ type: 'resource', buffered: false });
      this.poDisposable = () => po.disconnect();
    } catch {
      // 旧浏览器降级到 entryTypes
      try {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            this.processResourceEntry(e as PerformanceResourceTiming);
          }
        });
        po.observe({ entryTypes: ['resource'] });
        this.poDisposable = () => po.disconnect();
      } catch {
        // 完全不支持，降级到 buffered
      }
    }
  }

  /** 停止 PerformanceObserver 监听（保留样本） */
  stop(): void {
    if (this.poDisposable) {
      this.poDisposable();
      this.poDisposable = null;
    }
  }

  /** 清空所有样本和 adapterValue（热切换时调用） */
  reset(): void {
    this.poSamples = [];
    this.bufferedSamples = [];
    this.adapterValue = 0;
    this.adapterValueAt = 0;
  }

  /** 综合输出 bps */
  estimate(): number {
    // 1. 优先使用 adapter 原生值（3s 内有效）
    if (this.adapterValue > 0 && Date.now() - this.adapterValueAt <= ADAPTER_VALUE_TTL_MS) {
      return this.clamp(this.adapterValue);
    }

    // 2. 滑动窗口淘汰
    const now = Date.now();
    this.evict(this.poSamples, now);
    this.evict(this.bufferedSamples, now);

    // 3. EMA 聚合
    const poBps = this.ema(this.poSamples);
    const bufferedBps = this.ema(this.bufferedSamples);

    // 4. PO 和 buffered 都有值取 max（避免任一漏报）
    if (poBps > 0 && bufferedBps > 0) {
      return this.clamp(Math.max(poBps, bufferedBps));
    }
    if (poBps > 0) return this.clamp(poBps);
    if (bufferedBps > 0) return this.clamp(bufferedBps);
    return 0;
  }

  /** 返回当前带宽估算的置信度等级 */
  getConfidence(): 'high' | 'medium' | 'low' | 'none' {
    if (this.adapterValue > 0 && Date.now() - this.adapterValueAt <= ADAPTER_VALUE_TTL_MS) {
      return 'high';
    }
    const now = Date.now();
    this.evict(this.poSamples, now);
    this.evict(this.bufferedSamples, now);
    if (this.poSamples.length > 0 || this.bufferedSamples.length > 0) {
      return 'medium';
    }
    return 'none';
  }

  /* ─── 内部方法 ─────────────────────────────────────────── */

  private processResourceEntry(e: PerformanceResourceTiming): void {
    if (!isVideoResource(e.name)) return;
    // transferSize 优先；transferSize=0 时用 decodedBodySize 兜底
    let bytes = e.transferSize;
    if (!bytes || bytes <= 0) bytes = e.decodedBodySize;
    if (!bytes || bytes <= 0) return;

    const durationSec = (e.duration || 0) / 1000;
    if (!(durationSec > 0)) return;

    const bps = (bytes * 8) / durationSec;
    if (!Number.isFinite(bps) || bps <= 0) return;

    this.poSamples.push({ bps, ts: Date.now() });
  }

  private pushBufferedSample(bps: number): void {
    this.bufferedSamples.push({ bps, ts: Date.now() });
  }

  private evict(samples: Sample[], now: number): void {
    const cutoff = now - WINDOW_MS;
    while (samples.length > 0 && samples[0].ts < cutoff) {
      samples.shift();
    }
  }

  /** EMA 聚合：α=0.3，新样本权重 30% */
  private ema(samples: Sample[]): number {
    if (samples.length === 0) return 0;
    let acc = samples[0].bps;
    for (let i = 1; i < samples.length; i++) {
      acc = EMA_ALPHA * samples[i].bps + (1 - EMA_ALPHA) * acc;
    }
    return acc;
  }

  /** 钳制到 [MIN_BPS, MAX_BPS]，低于下限返回 0 */
  private clamp(bps: number): number {
    if (!Number.isFinite(bps) || bps <= 0) return 0;
    if (bps < MIN_BPS) return 0;
    if (bps > MAX_BPS) return MAX_BPS;
    return bps;
  }
}
