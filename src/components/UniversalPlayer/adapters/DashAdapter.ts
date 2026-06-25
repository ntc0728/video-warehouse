import { BasePlayerAdapter } from './PlayerAdapter';
import type { PlayerLevel } from '@/types/player';
import type { AudioTrack } from './PlayerAdapter';

interface DashAdapterOptions {
  onError?: (error: Error) => void;
}

export class DashAdapter extends BasePlayerAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private player: any = null;
  private options: DashAdapterOptions;
  private errorCount = 0;

  constructor(url: string, options: DashAdapterOptions = {}) {
    super(url);
    this.options = options;
  }

  async attach(video: HTMLVideoElement): Promise<void> {
    super.attach(video);

    try {
      const dashjs = await import('dashjs');
      this.player = dashjs.MediaPlayer().create();
      this.player.initialize(video, this.url, false);
      this.player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: { video: true, audio: true },
          },
          buffer: {
            fastSwitchEnabled: true,
          },
        },
      });
      this.player.on('error' as string, (e: { error?: { code?: string; message?: string } }) => {
        if (e.error) {
          this.errorCount++;
          if (this.errorCount >= 3) {
            this.options.onError?.(new Error('DASH 播放错误: ' + (e.error.message || '未知错误')));
          }
        }
      });
    } catch {
      this.options.onError?.(new Error('DASH 库加载失败'));
    }
  }

  detach(): void {
    if (this.player) {
      this.player.reset();
      this.player = null;
    }
    super.detach();
  }

  async play(): Promise<void> {
    this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  seek(time: number): void {
    this.player?.seek(time);
  }

  getDuration(): number {
    return this.player?.duration() ?? this.video?.duration ?? 0;
  }

  getCurrentTime(): number {
    return this.player?.time() ?? this.video?.currentTime ?? 0;
  }

  getLevels(): PlayerLevel[] {
    if (!this.player) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reps: any[] = this.player.getRepresentationsByType('video');
    return reps.map((r) => ({
      width: r.width ?? 0,
      height: r.height ?? 0,
      bitrate: r.bitrateInKbit ?? r.bandwidth ?? 0,
    }));
  }

  getBandwidthEstimate(): number {
    return this.player?.getAverageThroughput('video') ?? 0;
  }

  getAudioTracks(): AudioTrack[] {
    if (!this.player) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = this.player.getTracksFor('audio');
    return tracks.map((t, i) => ({
      id: i,
      name: t.labels?.[0]?.text ?? t.id ?? `Audio ${i}`,
      language: t.lang ?? '',
      default: t.index === 0,
    }));
  }

  resetErrorCount(): void {
    this.errorCount = 0;
  }

  destroy(): void {
    this.detach();
  }
}
