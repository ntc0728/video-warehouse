import { useEffect } from 'react';
import { usePlayerStore } from '@/stores';

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
  /** 上一集/上一频道；无值时锁屏隐藏对应按钮 */
  onPrev?: () => void;
  /** 下一集/下一频道 */
  onNext?: () => void;
}

function hasMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * MediaSession 集成（后台听视频 P1）。
 * 切后台/锁屏的音频延续是浏览器默认行为，本 hook 的价值是「可感知、可控制」：
 * 锁屏/通知栏媒体卡片（标题/副标题/进度）+ 蓝牙耳机/媒体键的 play/pause/seek/上下集控制。
 * 「后台听视频」开关关闭时不注册元数据（锁屏无媒体卡片）；直接驱动 video 元素的
 * play/pause 由 usePlayerCore 的事件监听同步回 store，UI 状态保持一致。
 */
export function useMediaSession({ videoRef, info, onPrev, onNext }: UseMediaSessionOptions) {
  const enabled = usePlayerStore(s => s.backgroundPlay);
  const isPlaying = usePlayerStore(s => s.isPlaying);

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
