import HlsJs from 'hls.js';
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

export class HLSAdapter extends BasePlayerAdapter {
  private hls: HlsJs | null = null;
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
    this.initHls();
  }

  private initHls(): void {
    if (!this.video) return;

    if (HlsJs.isSupported()) {
      const config: Record<string, unknown> = {
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        startLevel: this.startLevel >= 0 ? this.startLevel : -1,
      };

      if (this.decoderMode === 'wasm') {
        config.preferManagedMediaSource = true;
        config.maxBufferLength = 15;
        config.maxMaxBufferLength = 300;
      }

      this.hls = new HlsJs(config);
      this.hls.loadSource(this.url);
      this.hls.attachMedia(this.video);

      this.hls.on(HlsJs.Events.MANIFEST_PARSED, (_e, data) => {
        this.levels = data.levels.map(l => ({
          width: l.width,
          height: l.height,
          bitrate: l.bitrate,
          name: getQualityLabel({ width: l.width, height: l.height, bitrate: l.bitrate }),
        }));

        this.audioTracks = this.hls?.audioTracks.map((t, i) => ({
          id: t.id ?? i,
          name: t.name || t.lang || `Track ${i + 1}`,
          language: t.lang || '',
          default: t.default ?? false,
        })) ?? [];
        if (this.audioTracks.length > 0) {
          this.currentAudioTrack = this.hls?.audioTrack ?? 0;
        }

        this.video?.play().catch(() => {});
      });

      this.hls.on(HlsJs.Events.LEVEL_SWITCHED, (_e, data) => {
        this.currentLevel = data.level;
      });

      this.hls.on(HlsJs.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          const now = Date.now();
          // 重置计数器：超过 5 秒无错误则重新计数
          if (now - this.lastErrorTime > 5000) {
            this.errorCount = 0;
          }
          this.lastErrorTime = now;
          this.errorCount++;

          switch (data.type) {
            case HlsJs.ErrorTypes.NETWORK_ERROR:
              // 清单级错误（URL 失效/404）重试无意义，直接报错
              if (data.details === 'manifestLoadError' || data.details === 'manifestParsingError') {
                this.onError?.(new Error('频道源不可用'));
              } else {
                this.hls?.startLoad();
                // 连续网络错误超过 3 次才上报
                if (this.errorCount >= 3) {
                  this.onError?.(new Error('网络连接失败'));
                }
              }
              break;
            case HlsJs.ErrorTypes.MEDIA_ERROR:
              this.hls?.recoverMediaError();
              // 连续媒体错误超过 2 次才上报
              if (this.errorCount >= 2) {
                this.onError?.(new Error('媒体解码失败'));
              }
              break;
            default:
              // 默认错误直接上报
              this.onError?.(new Error(`HLS error: ${data.details}`));
              break;
          }
        }
      });
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = this.url;
    }
  }

  async play(): Promise<void> {
    await this.video?.play();
  }

  pause(): void {
    this.video?.pause();
  }

  seek(time: number): void {
    if (this.video) this.video.currentTime = time;
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
    if (this.hls) {
      return this.hls.bandwidthEstimate;
    }
    return 0;
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

  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.detach();
  }
}
