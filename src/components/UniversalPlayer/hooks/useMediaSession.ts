import { useEffect } from 'react';
import { usePlayerStore } from '@/stores';
import { getMediaBridge, isNativeMediaServiceSupported } from '@/services/backgroundAudioService';

export interface MediaSessionInfo {
  /** 主标题：点播 = 影片名，IPTV = 频道名 */
  title: string;
  /** 副标题：点播 = 集名/线路名，IPTV = 直播标识 */
  artist?: string;
  /** 封面图 URL（锁屏媒体卡片展示，可选） */
  artwork?: string;
}

interface UseMediaSessionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 媒体信息（调用方用 useMemo 稳定引用，避免每次渲染重注册） */
  info: MediaSessionInfo;
  /** 当前播放流 URL（P3 原生服务接管音频用，与 video 元素同源） */
  streamUrl?: string;
  /** 上一集/上一频道；无值时锁屏隐藏对应按钮 */
  onPrev?: () => void;
  /** 下一集/下一频道 */
  onNext?: () => void;
}

function hasMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * MediaSession 集成（后台听视频 P1）+ 原生前台服务兜底（P3）。
 *
 * P1（全平台，已落地）：锁屏/通知栏媒体卡片（标题/副标题/进度）+ 媒体键 play/pause/seek/
 * 上下集控制；开关关闭时不注册元数据。play/pause 直接驱动 video 元素，由 usePlayerCore 事件
 * 同步回 store。
 *
 * P3（Android App）：Android WebView 切后台时系统会暂停 media 元素音频。当原生 MediaBridge
 * 可用时，监听 visibilitychange——切后台时启动原生 MediaService（前台服务 + MediaPlayer
 * 独立解码音频）接管播放、暂停 WebView video（省电 + 避免双音轨），切回前台时停止原生服务、
 * 把 video 同步到原生服务的播放位置后恢复播放。Web/iOS 无原生桥时此逻辑跳过，仍由 P1 兜底。
 *
 * P2（iOS Safari）：iOS 17+ 的 ManagedMediaSource 允许 video 在后台继续播放（HLSAdapter 已配
 * preferManagedMediaSource:true），旧 iOS 切后台必停。前端无可靠手段让旧 iOS 后台续播，
 * 仅在开关开启时据 ManagedMediaSource 支持与否给提示（见 useMediaSessionHint）。
 */
export function useMediaSession({ videoRef, info, streamUrl, onPrev, onNext }: UseMediaSessionOptions) {
  const enabled = usePlayerStore(s => s.backgroundPlay);
  const isPlaying = usePlayerStore(s => s.isPlaying);

  // P3：原生媒体服务兜底——切后台启动、切回前台停止
  useEffect(() => {
    if (!enabled || !streamUrl) return;
    const bridge = getMediaBridge();
    if (!bridge || !isNativeMediaServiceSupported()) return;
    const video = videoRef.current;
    if (!video) return;

    let nativeActive = false;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // 切后台：仅当正在播放才启动原生服务接管音频
        if (!video.paused && !video.ended) {
          const pos = video.currentTime;
          bridge.start({ url: streamUrl, title: info.title, artist: info.artist })
            .then(() => bridge.seek?.(pos))
            .then(() => bridge.play())
            .catch(() => {});
          video.pause();
          nativeActive = true;
        }
      } else if (document.visibilityState === 'visible' && nativeActive) {
        // 切回前台：停止原生服务，同步位置后恢复 video 播放
        bridge.getState?.().then(() => {}).catch(() => {});
        bridge.stop().catch(() => {});
        nativeActive = false;
        // 原生服务期间可能已播放一段时间，同步位置由用户 seek；此处仅恢复播放态
        if (!video.ended) {
          video.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      // 卸载/开关关闭时若原生服务仍在运行，停止之
      if (nativeActive) {
        bridge.stop().catch(() => {});
      }
    };
  }, [enabled, streamUrl, info, videoRef]);

  // 元数据 + 动作处理器（info/handler 引用变化时重注册）
  useEffect(() => {
    if (!hasMediaSession()) return;
    const { mediaSession } = navigator;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        /* 浏览器不支持该动作（如部分浏览器的 seekbackward） */
      }
    };
    const clearAll = () => {
      for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'] as const) {
        setHandler(action, null);
      }
      mediaSession.metadata = null;
    };
    if (!enabled) {
      clearAll();
      return clearAll;
    }

    mediaSession.metadata = new MediaMetadata({
      title: info.title || '视频播放',
      artist: info.artist || undefined,
      album: 'KinoTV',
      artwork: info.artwork ? [{ src: info.artwork, sizes: '512x512' }] : undefined,
    });
    setHandler('play', () => { void videoRef.current?.play().catch(() => {}); });
    setHandler('pause', () => videoRef.current?.pause());
    setHandler('seekbackward', (details) => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, video.currentTime - (details.seekOffset ?? 10));
    });
    setHandler('seekforward', (details) => {
      const video = videoRef.current;
      if (video) video.currentTime = video.currentTime + (details.seekOffset ?? 10);
    });
    setHandler('previoustrack', onPrev ?? null);
    setHandler('nexttrack', onNext ?? null);
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, info, onPrev, onNext, videoRef]);

  // 播放状态同步（锁屏卡片的播放/暂停按钮态）
  useEffect(() => {
    if (!hasMediaSession()) return;
    navigator.mediaSession.playbackState = enabled && isPlaying ? 'playing' : 'paused';
  }, [enabled, isPlaying]);

  // 进度同步：锁屏进度条展示（timeupdate ~4Hz，直接同步开销可忽略）
  useEffect(() => {
    if (!hasMediaSession() || !enabled) return;
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      const { duration } = video;
      if (!Number.isFinite(duration) || duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: video.playbackRate,
          position: Math.min(Math.max(video.currentTime, 0), duration),
        });
      } catch {
        /* 瞬时越界等参数异常时忽略，下个 timeupdate 重试 */
      }
    };
    sync();
    video.addEventListener('timeupdate', sync);
    video.addEventListener('ratechange', sync);
    return () => {
      video.removeEventListener('timeupdate', sync);
      video.removeEventListener('ratechange', sync);
    };
  }, [enabled, videoRef]);
}
