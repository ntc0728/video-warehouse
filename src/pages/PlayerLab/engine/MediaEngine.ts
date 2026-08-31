/**
 * 播放器整改 Demo — 媒体引擎抽象
 *
 * 目的：让 demo 在**无网络**环境下也能完整体验交互（虚拟引擎按 rAF 推进时间），
 * 同时保留接真实 <video> 的通路用于验证真实链路。
 *
 * 关键设计（对应整改方案 P0-4「高频状态不走 React state」）：
 * - `onFrame`：每帧回调（60fps），只用于**直写 DOM / CSS 变量**，不触发 React 重渲染。
 * - `subscribe`：节流通知（100ms），用于驱动 React state（时间文本、按钮图标等低频 UI）。
 *
 * 现有 UniversalPlayer 把 currentTime 直接写进 Zustand（usePlayerCore.ts:250-264），
 * 导致播放中整页每 250ms 全量 reconcile。这里给出对照实现。
 */

export interface MediaEngineSnapshot {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  bufferedRatio: number;
  loading: boolean;
  error: string | null;
}

export interface MediaEngine {
  readonly kind: 'virtual' | 'video';
  readonly snapshot: MediaEngineSnapshot;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  seekBy(delta: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  setRate(r: number): void;
  /** 每帧回调；返回取消函数。回调里只读 engine 字段，用于直写 DOM。 */
  onFrame(cb: () => void): () => void;
  /** 节流通知（100ms）；返回取消函数。用于 React state。 */
  subscribe(cb: () => void): () => void;
  /** useSyncExternalStore 快照：单调递增的版本号 */
  getVersion(): number;
  destroy(): void;
}

/** 节流通知间隔：10fps 足够驱动时间文本与按钮状态，进度条走 onFrame 直写 */
const NOTIFY_INTERVAL = 100;

abstract class BaseEngine implements MediaEngine {
  abstract readonly kind: 'virtual' | 'video';
  abstract readonly snapshot: MediaEngineSnapshot;

  private frameCbs = new Set<() => void>();
  private subCbs = new Set<() => void>();
  private version = 0;
  private rafId = 0;
  private lastNotify = 0;

  protected startLoop(): void {
    const tick = (ts: number) => {
      this.advance(ts);
      for (const cb of this.frameCbs) cb();
      if (ts - this.lastNotify >= NOTIFY_INTERVAL) {
        this.lastNotify = ts;
        this.version += 1;
        for (const cb of this.subCbs) cb();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** 子类推进时间 / 同步 video 状态 */
  protected advance(_ts: number): void {}

  /** 立即通知 React（切源、报错等即时状态变化用） */
  protected flush(): void {
    this.version += 1;
    for (const cb of this.subCbs) cb();
  }

  onFrame(cb: () => void): () => void {
    this.frameCbs.add(cb);
    return () => { this.frameCbs.delete(cb); };
  }

  subscribe(cb: () => void): () => void {
    this.subCbs.add(cb);
    return () => { this.subCbs.delete(cb); };
  }

  getVersion(): number {
    return this.version;
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.frameCbs.clear();
    this.subCbs.clear();
  }

  abstract play(): void;
  abstract pause(): void;
  abstract toggle(): void;
  abstract seek(time: number): void;
  abstract seekBy(delta: number): void;
  abstract setVolume(v: number): void;
  abstract toggleMute(): void;
  abstract setRate(r: number): void;
}

/* ────────────────────────── 虚拟引擎（离线可玩） ────────────────────────── */

export interface VirtualEngineOptions {
  duration: number;
  /** 起始进度（续播演示） */
  startTime?: number;
}

export class VirtualEngine extends BaseEngine {
  readonly kind = 'virtual' as const;
  readonly snapshot: MediaEngineSnapshot;

  private lastTs: number | null = null;
  private onEndedCb: (() => void) | null = null;

  constructor(opts: VirtualEngineOptions) {
    super();
    this.snapshot = {
      currentTime: opts.startTime ?? 0,
      duration: opts.duration,
      paused: true,
      volume: 0.8,
      muted: false,
      rate: 1,
      bufferedRatio: 0.32,
      loading: false,
      error: null,
    };
    this.startLoop();
  }

  onEnded(cb: () => void): void {
    this.onEndedCb = cb;
  }

  protected advance(ts: number): void {
    if (this.lastTs === null) { this.lastTs = ts; return; }
    const dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    const s = this.snapshot;
    if (s.paused) return;
    s.currentTime = Math.min(s.duration, s.currentTime + dt * s.rate);
    // 缓冲永远领先播放头 8%（模拟 HLS 边下边播）
    s.bufferedRatio = Math.min(1, Math.max(s.bufferedRatio, s.currentTime / s.duration + 0.08));
    if (s.currentTime >= s.duration) {
      s.paused = true;
      this.flush();
      this.onEndedCb?.();
    }
  }

  play(): void { this.snapshot.paused = false; this.flush(); }
  pause(): void { this.snapshot.paused = true; this.flush(); }
  toggle(): void { this.snapshot.paused = !this.snapshot.paused; this.flush(); }

  seek(time: number): void {
    const s = this.snapshot;
    s.currentTime = Math.max(0, Math.min(s.duration, time));
    // 跳转后缓冲跌到落点，模拟重新缓冲
    s.bufferedRatio = Math.min(s.bufferedRatio, s.currentTime / s.duration);
    this.flush();
  }

  seekBy(delta: number): void {
    this.seek(this.snapshot.currentTime + delta);
  }

  setVolume(v: number): void {
    this.snapshot.volume = Math.max(0, Math.min(1, v));
    if (this.snapshot.volume > 0) this.snapshot.muted = false;
    this.flush();
  }

  toggleMute(): void {
    this.snapshot.muted = !this.snapshot.muted;
    this.flush();
  }

  setRate(r: number): void {
    this.snapshot.rate = Math.max(0.25, Math.min(3, r));
    this.flush();
  }

  /** 演示用：切到某个错误态 */
  simulateError(message: string): void {
    this.snapshot.error = message;
    this.snapshot.paused = true;
    this.flush();
  }

  clearError(): void {
    this.snapshot.error = null;
    this.flush();
  }
}

/* ────────────────────────── 真实视频引擎 ────────────────────────── */

export class VideoEngine extends BaseEngine {
  readonly kind = 'video' as const;
  readonly snapshot: MediaEngineSnapshot;

  private video: HTMLVideoElement;
  private cleanups: Array<() => void> = [];

  constructor(video: HTMLVideoElement) {
    super();
    this.video = video;
    this.snapshot = {
      currentTime: 0, duration: 0, paused: true,
      volume: video.volume, muted: video.muted, rate: video.playbackRate,
      bufferedRatio: 0, loading: true, error: null,
    };
    this.bindEvents();
    this.startLoop();
  }

  private bindEvents(): void {
    const v = this.video;
    const on = <K extends keyof HTMLVideoElementEventMap>(
      type: K,
      handler: () => void,
    ) => {
      v.addEventListener(type, handler);
      this.cleanups.push(() => v.removeEventListener(type, handler));
    };
    on('loadedmetadata', () => {
      this.snapshot.duration = v.duration || 0;
      this.snapshot.loading = false;
      this.flush();
    });
    on('canplay', () => { this.snapshot.loading = false; this.flush(); });
    on('waiting', () => { this.snapshot.loading = true; this.flush(); });
    on('playing', () => { this.snapshot.paused = false; this.flush(); });
    on('pause', () => { this.snapshot.paused = true; this.flush(); });
    on('error', () => {
      this.snapshot.error = describeMediaError(v.error?.code ?? 0);
      this.snapshot.loading = false;
      this.flush();
    });
    // 重试：重新拉取
    on('loadstart', () => { this.snapshot.loading = true; this.flush(); });
  }

  protected advance(): void {
    const s = this.snapshot;
    s.currentTime = this.video.currentTime;
    s.volume = this.video.volume;
    s.muted = this.video.muted;
    s.rate = this.video.playbackRate;
    s.paused = this.video.paused;
    if (this.video.buffered.length > 0) {
      const end = this.video.buffered.end(this.video.buffered.length - 1);
      s.bufferedRatio = s.duration > 0 ? Math.min(1, end / s.duration) : 0;
    }
  }

  play(): void { void this.video.play().catch(() => { this.snapshot.error = '自动播放被浏览器拦截'; this.flush(); }); }
  pause(): void { this.video.pause(); }
  toggle(): void { if (this.video.paused) this.play(); else this.pause(); }

  seek(time: number): void {
    this.video.currentTime = Math.max(0, Math.min(this.snapshot.duration || 0, time));
    this.snapshot.currentTime = this.video.currentTime;
    this.flush();
  }

  seekBy(delta: number): void { this.seek(this.video.currentTime + delta); }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.video.volume = clamped;
    this.video.muted = clamped === 0;
    this.snapshot.volume = clamped;
    this.snapshot.muted = this.video.muted;
    this.flush();
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
    this.snapshot.muted = this.video.muted;
    this.flush();
  }

  setRate(r: number): void {
    const clamped = Math.max(0.25, Math.min(3, r));
    // 变速不变调：preservesPitch 默认 true，显式声明防止被第三方脚本改写
    this.video.playbackRate = clamped;
    this.video.preservesPitch = true;
    this.snapshot.rate = clamped;
    this.flush();
  }

  destroy(): void {
    super.destroy();
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }
}

/** 把 HTMLMediaElement 错误码翻译成人话（现有实现只有一句「播放失败，请检查网络连接」） */
export function describeMediaError(code: number): string {
  switch (code) {
    case 1: return '加载被中止（MEDIA_ERR_ABORTED）';
    case 2: return '网络中断，正在重试…（MEDIA_ERR_NETWORK）';
    case 3: return '解码失败，建议切换清晰度或解码方式（MEDIA_ERR_DECODE）';
    case 4: return '该片源不可用或格式不支持（MEDIA_ERR_SRC_NOT_SUPPORTED）';
    default: return '播放失败，请检查网络连接';
  }
}
