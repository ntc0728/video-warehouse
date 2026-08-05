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

/** 移动端 + 蜂窝网络 → 120s，其他 → 300s */
function getBufferLength(): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;
  const isCellular = conn && /cellular|2g|3g|4g|5g/i.test(conn.effectiveType || conn.type || '');
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return (isMobile && isCellular) ? 120 : 300;
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
  private preloadTimer: ReturnType<typeof setInterval> | null = null;
  private baseBufferLength: number = 0;

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

      const bufferLen = this.decoderMode === 'wasm' ? 60 : getBufferLength();
      this.baseBufferLength = bufferLen;
      const config: Record<string, unknown> = {
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: bufferLen,
        maxMaxBufferLength: bufferLen * 10,
        maxBufferSize: bufferLen * 1024 * 1024,
        startLevel: this.startLevel >= 0 ? this.startLevel : -1,
        preferManagedMediaSource: true,
      };

      try {
        this.hls = new HlsJs(config);
        this.hls.loadSource(this.url);
        this.hls.attachMedia(this.video);
        // 提前开始加载，减少播放首帧延迟
        this.hls.startLoad(0);
      } catch {
        this.hls = null;
        this.onError?.(new Error('HLS 初始化失败'));
        return;
      }

      // 待播放状态预加载：canplay 触发时若仍暂停，立即启动预加载
      // 直播流（IPTV）不做暂停预加载——直播没有“暂停”语义，暂停预加载只会持续拉流浪费流量
      const onCanPlay = () => {
        if (this.video?.paused && !this.preloadTimer && !this.isLive()) {
          this.startPreload();
        }
      };
      this.video?.addEventListener('canplay', onCanPlay, { once: true });

      // 直播流（IPTV）manifest 加载后：收敛缓冲上限，避免无谓囤积分片（即“不预加载”）
      // 直播不需要像点播那样预留大缓冲，hls.js 按 live edge 持续拉取即可
      this.hls.on(HlsJs.Events.LEVEL_LOADED, (_e: unknown, data: { details?: { live?: boolean } }) => {
        if (data.details?.live && this.hls) {
          const liveMax = 60;
          this.hls.maxBufferLength = Math.min(this.hls.maxBufferLength, liveMax);
          this.hls.maxMaxBufferLength = Math.min(this.hls.maxMaxBufferLength, liveMax * 2);
          this.hls.backBufferLength = Math.min(this.hls.backBufferLength, 20);
        }
      });

      this.hls.on(HlsJs.Events.MANIFEST_PARSED, (_e: unknown, data: { levels: Array<{ width: number; height: number; bitrate: number }> }) => {
        this.levels = data.levels.map(l => ({
          width: l.width,
          height: l.height,
          bitrate: l.bitrate,
          name: getQualityLabel({ width: l.width, height: l.height, bitrate: l.bitrate }),
        }));

        // C1 视频轨检测：所有 level 的宽高均为 0 → manifest 不含视频轨（纯音频源/音频-only 分片）
        // 直接 onError 上报，由上层（UniversalPlayer）决定 toast 提示或切线路
        const hasVideoTrack = this.levels.some(l => l.width > 0 && l.height > 0);
        if (!hasVideoTrack) {
          this.onError?.(new Error('该源仅含音频，无视频画面'));
        }

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
              } else if (this.errorCount < 3) {
                this.hls?.startLoad();
              } else {
                this.onError?.(new Error('网络连接失败'));
              }
              break;
            case HlsJs.ErrorTypes.MEDIA_ERROR:
              if (this.errorCount < 2) {
                this.hls?.recoverMediaError();
              } else {
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
    this.stopPreload();
    if (this.hls) {
      this.hls.startLoad();
    }
    await this.video?.play();
  }

  pause(): void {
    this.video?.pause();
    // 直播流（IPTV）不做暂停预加载：直播无“暂停”语义，预加载只会持续拉流浪费流量
    if (!this.isLive()) {
      this.startPreload();
    }
  }

  /** 启动预加载：提升 buffer 上限 + 定时 startLoad 绕过暂停态下载限制 */
  private startPreload(): void {
    // 直播流（IPTV）不做预加载：直播无“暂停”/“预看”语义，预加载只会持续拉流浪费流量
    if (this.isLive()) return;
    if (this.hls && !this.preloadTimer) {
      this.hls.maxBufferLength = 600;
      this.hls.startLoad();
      this.preloadTimer = setInterval(() => {
        if (this.hls && this.video?.paused) {
          this.hls.startLoad();
        }
      }, 2000);
    }
  }

  /** 停止预加载：清除定时器 + 恢复原始 buffer 上限 */
  private stopPreload(): void {
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
      this.preloadTimer = null;
    }
    if (this.hls && this.baseBufferLength > 0) {
      this.hls.maxBufferLength = this.baseBufferLength;
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
    this.currentLevel = -1;
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
    this.stopPreload();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.detach();
  }
}
