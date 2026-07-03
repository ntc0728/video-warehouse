import { BasePlayerAdapter } from './PlayerAdapter';
import type { PlayerLevel, DecoderMode } from '@/types/player';
import type { AudioTrack } from './PlayerAdapter';

function getQualityLabel(level: { width: number; height: number; bitrate: number }): string {
  const h = level.height;
  if (h >= 2160) return '4K';
  if (h >= 1440) return '2K';
  if (h >= 1080) return '1080P';
  if (h >= 720) return '720P';
  if (h >= 480) return '480P';
  if (h >= 360) return '360P';
  return `${h}P`;
}

/**
 * 检测是否可通过原生 HLS 播放（iOS Safari）。
 */
function canUseNativeHls(): boolean {
  return typeof window !== 'undefined' &&
    document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';
}

export class HLSAdapter extends BasePlayerAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hls: any = null;
  private decoderMode: DecoderMode;
  private currentLevel: number = -1;
  private levels: PlayerLevel[] = [];
  private audioTracks: AudioTrack[] = [];
  private currentAudioTrack: number = -1;
  private startLevel: number;
  private onError?: (error: Error) => void;
  private errorCount: number = 0;
  private lastErrorTime: number = 0;

  constructor(url: string, options?: { decoderMode?: DecoderMode; startLevel?: number; onError?: (error: Error) => void }) {
    super(url);
    this.decoderMode = options?.decoderMode ?? 'native';
    this.startLevel = options?.startLevel ?? -1;
    this.onError = options?.onError;
  }

  attach(video: HTMLVideoElement): void {
    super.attach(video);
    this.initHls().catch(() => {});
  }

  private async initHls(): Promise<void> {
    if (!this.video) return;

    // iOS Safari 原生 HLS
    if (canUseNativeHls()) {
      this.video.src = this.url;
      return;
    }

    // 动态加载 hls.js
    try {
      const { default: HlsJs } = await import('hls.js');

      if (!HlsJs.isSupported() && !('ManagedMediaSource' in window)) {
        this.onError?.(new Error('当前浏览器不支持 HLS 播放'));
        return;
      }

      const config: Record<string, unknown> = {
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        startLevel: this.startLevel >= 0 ? this.startLevel : -1,
        preferManagedMediaSource: true,
      };

      if (this.decoderMode === 'wasm') {
        config.maxBufferLength = 15;
        config.maxMaxBufferLength = 300;
      }

      try {
        this.hls = new HlsJs(config);
        this.hls.loadSource(this.url);
        this.hls.attachMedia(this.video);
      } catch {
        this.hls = null;
        this.onError?.(new Error('HLS 初始化失败'));
        return;
      }

      this.hls.on(HlsJs.Events.MANIFEST_PARSED, (_e: unknown, data: { levels: Array<{ width: number; height: number; bitrate: number }> }) => {
        this.levels = data.levels.map(l => ({
          width: l.width,
          height: l.height,
          bitrate: l.bitrate,
          name: getQualityLabel({ width: l.width, height: l.height, bitrate: l.bitrate }),
        }));

        this.audioTracks = this.hls?.audioTracks.map((t: { id?: number; name?: string; lang?: string; default?: boolean }, i: number) => ({
          id: t.id ?? i,
          name: t.name || t.lang || `Track ${i + 1}`,
          language: t.lang || '',
          default: t.default ?? false,
        })) ?? [];
        if (this.audioTracks.length > 0) {
          this.currentAudioTrack = this.hls?.audioTrack ?? 0;
        }
      });

      this.hls.on(HlsJs.Events.LEVEL_SWITCHED, (_e: unknown, data: { level: number }) => {
        this.currentLevel = data.level;
      });

      // 分片加载完成：上报分片级字节数，作为高精度带宽估算样本
      // 比 PerformanceObserver 更准（不依赖 CORS TAO 头）
      this.hls.on(HlsJs.Events.FRAG_LOADED, (_e: unknown, data: { frag?: { stats?: { total?: number; loading?: { start?: number; end?: number } } } }) => {
        const stats = data.frag?.stats;
        const start = stats?.loading?.start;
        const end = stats?.loading?.end;
        const total = stats?.total;
        if (total && start !== undefined && end !== undefined && end > start) {
          this.estimator.recordFragLoaded(total, (end - start) / 1000);
        }
      });

      this.hls.on(HlsJs.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string; details: string }) => {
        if (data.fatal) {
          const now = Date.now();
          if (now - this.lastErrorTime > 5000) {
            this.errorCount = 0;
          }
          this.lastErrorTime = now;
          this.errorCount++;

          switch (data.type) {
            case HlsJs.ErrorTypes.NETWORK_ERROR:
              if (data.details === 'manifestLoadError' || data.details === 'manifestParsingError') {
                this.onError?.(new Error('频道源不可用'));
              } else {
                this.hls?.startLoad();
                if (this.errorCount >= 3) {
                  this.onError?.(new Error('网络连接失败'));
                }
              }
              break;
            case HlsJs.ErrorTypes.MEDIA_ERROR:
              this.hls?.recoverMediaError();
              if (this.errorCount >= 2) {
                this.onError?.(new Error('媒体解码失败'));
              }
              break;
            default:
              this.onError?.(new Error(`HLS error: ${data.details}`));
              break;
          }
        }
      });
    } catch {
      this.onError?.(new Error('HLS 库加载失败'));
    }
  }

  async play(): Promise<void> {
    if (this.hls) {
      this.hls.startLoad();
    }
    await this.video?.play();
  }

  pause(): void {
    this.video?.pause();
    if (this.hls) {
      this.hls.stopLoad();
    }
  }

  seek(time: number): void {
    if (!this.video) return;
    // 边界校验：防止 seek 到无效位置（直播流尤其重要）
    const seekable = this.video.seekable;
    if (seekable.length > 0) {
      const start = seekable.start(0);
      const end = seekable.end(seekable.length - 1);
      if (time < start || time > end) {
        time = Math.max(start, Math.min(end, time));
      }
    }
    this.video.currentTime = time;
  }

  getLevels(): PlayerLevel[] {
    return this.levels;
  }

  setCurrentLevel(level: number): void {
    if (this.hls) {
      this.hls.currentLevel = level;
      this.currentLevel = level;
    }
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getBandwidthEstimate(): number {
    // hls.js 路径：优先用 hls.bandwidthEstimate
    if (this.hls) {
      const v = this.hls.bandwidthEstimate;
      if (v > 0) {
        this.estimator.setAdapterValue(v);
        return v;
      }
    }
    // 原生 HLS 路径 / hls.js 未给出值：走 estimator（PO + 解码字节）
    return this.estimator.estimate();
  }

  setDecoderMode(mode: DecoderMode): HLSAdapter {
    return new HLSAdapter(this.url, {
      decoderMode: mode,
      startLevel: this.currentLevel,
      onError: this.onError,
    });
  }

  getAudioTracks(): AudioTrack[] {
    return this.audioTracks;
  }

  setCurrentAudioTrack(trackId: number): void {
    if (this.hls && this.audioTracks.some(t => t.id === trackId)) {
      this.hls.audioTrack = trackId;
      this.currentAudioTrack = trackId;
    }
  }

  getCurrentAudioTrack(): number {
    return this.currentAudioTrack;
  }

  resetErrorCount(): void {
    this.errorCount = 0;
  }

  isLive(): boolean {
    if (this.hls) {
      // 检查当前 level 的详情是否表明是直播流
      const currentLevel = this.hls.levels[this.hls.currentLevel];
      if (currentLevel?.details?.live) return true;
    }
    return super.isLive();
  }

  getLiveLatency(): number {
    if (this.hls && this.video) {
      const currentLevel = this.hls.levels[this.hls.currentLevel];
      if (currentLevel?.details?.live && currentLevel.details.fragments?.length > 0) {
        const fragments = currentLevel.details.fragments;
        const lastFragment = fragments[fragments.length - 1];
        const liveEdge = lastFragment.start + lastFragment.duration;
        return Math.max(0, liveEdge - this.video.currentTime);
      }
    }
    return super.getLiveLatency();
  }

  getSeekableStart(): number {
    if (this.hls && this.video) {
      const currentLevel = this.hls.levels[this.hls.currentLevel];
      if (currentLevel?.details?.live && currentLevel.details.fragments?.length > 0) {
        const fragments = currentLevel.details.fragments;
        // 边缘分片可能已被部分驱逐；优先使用分片 1（如果可用）
        const startFragment = fragments.length > 1 ? fragments[1] : fragments[0];
        return startFragment.start;
      }
    }
    return super.getSeekableStart();
  }

  getSeekableEnd(): number {
    if (this.hls) {
      const currentLevel = this.hls.levels[this.hls.currentLevel];
      if (currentLevel?.details?.live && currentLevel.details.fragments?.length > 0) {
        const fragments = currentLevel.details.fragments;
        const lastFragment = fragments[fragments.length - 1];
        return lastFragment.start + lastFragment.duration;
      }
    }
    return super.getSeekableEnd();
  }

  switchSource(url: string, options?: Record<string, unknown>): void {
    super.switchSource(url, options);
    if (this.hls) {
      this.hls.loadSource(url);
      this.hls.startLoad();
      return;
    }
    // 原生 HLS 路径：直接换 src
    if (this.video) {
      this.video.src = url;
    }
  }

  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.detach();
  }
}
