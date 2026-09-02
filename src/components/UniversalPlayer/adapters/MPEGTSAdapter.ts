import { BasePlayerAdapter } from './PlayerAdapter';
import type { PlayerLevel } from '@/types/player';
import { playerToast } from '../PlayerToast';

/**
 * MPEGTS 适配器（C3 兜底）：处理 FLV / 裸 TS 流（非 HLS 分片）
 *
 * 部分 IPTV 源返回 HTTP-FLV 或裸 MPEG-TS 流（非 HLS 分片），
 * hls.js 无法解析 → 通过 mpegts.js 播放（mse 模式解码）。
 *
 * 使用场景：detectVideoSourceType 识别为 'flv' 的源（IPTV 裸流降级 / 点播 FLV/TS 直链）。
 * 动态 import mpegts.js（~40KB gzip），仅在确实需要时加载。
 *
 * 直播/点播双模式：
 * - 直播（isLive=true，默认，向后兼容）：低延迟配置，不支持 seek，断流自动重连
 * - 点播（isLive=false）：正常缓冲支持 seek，不做重连（点播失败走上层切线路/切源）
 */
const RECONNECT_INTERVAL_MS = 2000;
const MAX_RECONNECT_COUNT = 5;

export class MPEGTSAdapter extends BasePlayerAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private player: any = null;
  private onError?: (error: Error) => void;
  /** 直播/点播模式（默认直播，向后兼容） */
  private isLiveMode: boolean;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectCount = 0;

  constructor(url: string, options?: { onError?: (error: Error) => void; isLive?: boolean }) {
    super(url);
    this.onError = options?.onError;
    this.isLiveMode = options?.isLive ?? true;
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
          isLive: this.isLiveMode,
          url: this.url,
        },
        this.isLiveMode
          ? {
              // 直播拉流配置：无需 seek，从 live edge 开始，低延迟追帧
              enableStashBuffer: false,
              liveBufferLatencyChasing: true,
              liveBufferLatencyMaxLatency: 3,
              liveBufferLatencyMinRemain: 1,
            }
          : {
              // 点播配置：正常缓冲支持 seek，自动清理已播缓冲控制内存
              enableStashBuffer: true,
              stashInitialSize: 1024 * 1024,
              lazyLoad: true,
              lazyLoadMaxDuration: 5 * 60,
              lazyLoadRecoverDuration: 30,
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 3 * 60,
              autoCleanupMinBackwardDuration: 2 * 60,
            },
      );

      // 断流重连（仅直播）：ERROR 后 2s 重试 unload→load→play，最多 5 次（约 10s 内
      // 恢复不了就放弃，走上层切线路/切代理）。点播不做重连（失败走上层故障转移）。
      this.player.on(mpegts.Events.ERROR, () => {
        if (!this.isLiveMode || this.reconnectCount >= MAX_RECONNECT_COUNT) return;
        this.reconnectCount++;
        playerToast(`源流断开，正在重连（${this.reconnectCount}/${MAX_RECONNECT_COUNT}）…`, 3000, 'warning');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          try {
            this.player?.unload();
            this.player?.load();
            this.player?.play();
          } catch {
            /* ignore */
          }
        }, RECONNECT_INTERVAL_MS);
      });
      // 重连成功判定：STATISTICS_INFO 表示解码器已有数据流动（每秒回调），此时重置计数，
      // 让一次长连接中的多次瞬时断流各自拥有完整的 5 次重连预算
      this.player.on(mpegts.Events.STATISTICS_INFO, () => {
        if (this.reconnectCount > 0) this.reconnectCount = 0;
      });

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

  seek(time: number): void {
    // 直播流不支持 seek；点播 mpegts.js 支持直接设 currentTime
    if (this.isLiveMode) return;
    if (this.player) {
      this.player.currentTime = time;
    }
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
