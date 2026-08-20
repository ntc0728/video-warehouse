import { BasePlayerAdapter } from './PlayerAdapter';
import type { PlayerLevel } from '@/types/player';

/**
 * MPEGTS 适配器（C3 兜底）：处理 FLV / 裸 TS 流（非 HLS 分片）
 *
 * 部分 IPTV 源返回 HTTP-FLV 或裸 MPEG-TS 流（非 HLS 分片），
 * hls.js 无法解析 → 通过 mpegts.js 播放（mse 模式解码）。
 *
 * 使用场景：detectVideoSourceType 识别为 'flv' 的源。
 * 动态 import mpegts.js（~40KB gzip），仅在确实需要时加载。
 */
export class MPEGTSAdapter extends BasePlayerAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private player: any = null;
  private onError?: (error: Error) => void;

  constructor(url: string, options?: { onError?: (error: Error) => void }) {
    super(url);
    this.onError = options?.onError;
  }

  attach(video: HTMLVideoElement): void {
    super.attach(video);
    this.initPlayer().catch(() => {});
  }

  private async initPlayer(): Promise<void> {
    if (!this.video) return;
    try {
      // 动态加载 mpegts.js（仅 flv/裸 ts 源才需要）
      const { default: mpegts } = await import('mpegts.js');

      if (!mpegts.isSupported()) {
        this.onError?.(new Error('当前浏览器不支持 FLV/TS 播放'));
        return;
      }

      this.player = mpegts.createPlayer(
        {
          type: this.url.toLowerCase().includes('.flv') ? 'flv' : 'mpegts',
          isLive: true,
          url: this.url,
        },
        {
          // 直播拉流配置：无需 seek，从 live edge 开始
          enableStashBuffer: false,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 3,
          liveBufferLatencyMinRemain: 1,
        },
      );

      this.player.attachMediaElement(this.video);
      this.player.load();
      this.player.play();
    } catch {
      this.onError?.(new Error('FLV/TS 播放器初始化失败'));
    }
  }

  async play(): Promise<void> {
    await this.video?.play();
  }

  pause(): void {
    this.video?.pause();
  }

  seek(_time: number): void {
    // 直播流不支持 seek
  }

  getLevels(): PlayerLevel[] {
    return [];
  }

  getBandwidthEstimate(): number {
    return this.estimator.estimate();
  }

  switchSource(url: string, _options?: Record<string, unknown>): void {
    super.switchSource(url, _options);
    if (this.player) {
      try {
        this.player.unload();
        this.player.load();
      } catch {
        /* ignore */
      }
    }
  }

  destroy(): void {
    if (this.player) {
      try {
        this.player.pause();
        this.player.unload();
        this.player.destroy();
      } catch {
        /* ignore */
      }
      this.player = null;
    }
    this.detach();
  }
}
