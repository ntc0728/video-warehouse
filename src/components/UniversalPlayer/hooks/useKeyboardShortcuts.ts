import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import { playerToast } from '../PlayerToast';
import { LOOP_CYCLE } from '../lib/utils';
import type { PlatformType, PlayerMode } from '@/types/player';

interface UseKeyboardShortcutsOptions {
  platform: PlatformType;
  mode: PlayerMode;
  isControlsVisible: boolean;
  showControls: () => void;
  hideControls: () => void;
  playerCore: {
    togglePlay: () => void;
    setVolume: (v: number) => void;
    toggleMute: () => void;
    seek: (time: number) => void;
    pause: () => void;
    togglePiP: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
  };
  showVolumePopupWithTimer: () => void;
  toggleFullscreen?: () => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  /** P1-5：Shift+? 快捷键面板开关 */
  onToggleShortcuts?: () => void;
}

const SEEK_DEBOUNCE_MS = 100;
/** P1-1：逐帧步长（假设 30fps；浏览器无统一帧元数据，取通用近似值） */
const FRAME_STEP = 1 / 30;

export function useKeyboardShortcuts({
  platform,
  mode,
  isControlsVisible,
  showControls,
  hideControls,
  playerCore,
  showVolumePopupWithTimer,
  toggleFullscreen,
  onPrevEpisode,
  onNextEpisode,
  onToggleShortcuts,
}: UseKeyboardShortcutsOptions) {
  // seek 防抖 ref
  const seekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // TV 平台由 useTVRemote 统一处理，不注册重复监听
    if (platform === 'tv') return;

    /** 带防抖的 seek，避免连续按键导致频繁 seek 卡顿 */
    const debouncedSeek = (time: number) => {
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
      seekDebounceRef.current = setTimeout(() => {
        // C3 统一 seek 策略：仅加载未就绪（isPlayerLoading && !isReadyToPlay）拒绝；
        // 缓冲中允许 seek（跳到已缓冲位置可立即恢复，与拖拽 ProgressBar 一致）。
        // seek 提示统一走 playerCore.seek（seeked 生效后『已跳转』）。
        const { isPlayerLoading, isReadyToPlay } = usePlayerStore.getState();
        if (isPlayerLoading && !isReadyToPlay) {
          seekDebounceRef.current = null;
          return;
        }
        playerCore.seek(time);
        seekDebounceRef.current = null;
      }, SEEK_DEBOUNCE_MS);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      // P1-1：排除输入类 + contentEditable（此前漏 contentEditable）
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      // 聚焦按钮/slider 上的空格/回车是原生激活行为，不抢（避免双触发播放/暂停）
      if (
        (tag === 'button' || el?.getAttribute?.('role') === 'slider') &&
        (e.key === ' ' || e.key === 'Enter')
      ) {
        return;
      }

      const volume = usePlayerStore.getState().volume;

      if (mode === 'iptv') {
        // IPTV 直播：无“暂停”语义，不响应空格播放/暂停；仅支持音量、全屏、静音、Escape
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            playerCore.setVolume(Math.min(1, volume + 0.1));
            showVolumePopupWithTimer();
            playerToast(`音量 ${Math.round(Math.min(1, volume + 0.1) * 100)}%`);
            break;
          case 'ArrowDown':
            e.preventDefault();
            playerCore.setVolume(Math.max(0, volume - 0.1));
            showVolumePopupWithTimer();
            playerToast(`音量 ${Math.round(Math.max(0, volume - 0.1) * 100)}%`);
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            toggleFullscreen?.();
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            // C2：静音统一走 playerCore.toggleMute（记忆原音量，解除恢复原值）
            playerCore.toggleMute();
            break;
          case 'Escape':
            if (isControlsVisible) {
              e.preventDefault();
              hideControls();
            }
            break;
        }
        return;
      }

      // 视频模式快捷键（P1-1：对齐 B站/YouTube——K 播放暂停、J/L ±10s、
      // ←→ ±5s、0-9 百分比跳转、Home/End、,/. 逐帧、P 画中画、C 字幕、
      // R 循环（原 L 语义让位给「前进 10s」）、Shift+? 快捷键面板）
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          playerCore.togglePlay();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          debouncedSeek(Math.max(0, playerCore.getCurrentTime() - 10));
          break;
        case 'l':
        case 'L': {
          // 前进 10s（B站/YouTube 语义）；循环模式迁移到 R
          e.preventDefault();
          const dur = playerCore.getDuration();
          debouncedSeek(Math.min(dur || Infinity, playerCore.getCurrentTime() + 10));
          break;
        }
        case 'ArrowLeft':
          e.preventDefault();
          debouncedSeek(Math.max(0, playerCore.getCurrentTime() - 5));
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const dur = playerCore.getDuration();
          debouncedSeek(Math.min(dur || Infinity, playerCore.getCurrentTime() + 5));
          break;
        }
        case 'ArrowUp':
          e.preventDefault();
          playerCore.setVolume(Math.min(1, volume + 0.1));
          showVolumePopupWithTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          playerCore.setVolume(Math.max(0, volume - 0.1));
          showVolumePopupWithTimer();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          // C2：静音统一走 playerCore.toggleMute（记忆原音量，解除恢复原值）
          playerCore.toggleMute();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          playerCore.togglePiP();
          break;
        case 'c':
        case 'C': {
          // 字幕开关：subtitleEnabled 驱动 <track> 挂载（批次 4 新增的字幕渲染管线）
          e.preventDefault();
          const { subtitleEnabled, setSubtitleEnabled } = usePlayerStore.getState();
          setSubtitleEnabled(!subtitleEnabled);
          playerToast(!subtitleEnabled ? '字幕已开启' : '字幕已关闭');
          break;
        }
        case 'r':
        case 'R': {
          // 循环模式切换：none → single → list → none（原 L 键位迁移至此）
          e.preventDefault();
          const currentLoop = usePlayerStore.getState().loopMode;
          const nextLoop = LOOP_CYCLE[(LOOP_CYCLE.indexOf(currentLoop) + 1) % LOOP_CYCLE.length];
          usePlayerStore.getState().setLoopMode(nextLoop);
          break;
        }
        case 'Home':
          e.preventDefault();
          playerCore.seek(0);
          break;
        case 'End': {
          e.preventDefault();
          const dur = playerCore.getDuration();
          if (dur > 0) playerCore.seek(dur);
          break;
        }
        case ',':
          // 逐帧后退：暂停 + 步进 1/30s
          e.preventDefault();
          playerCore.pause();
          playerCore.seek(Math.max(0, playerCore.getCurrentTime() - FRAME_STEP));
          break;
        case '.':
          // 逐帧前进：暂停 + 步进 1/30s
          e.preventDefault();
          playerCore.pause();
          playerCore.seek(playerCore.getCurrentTime() + FRAME_STEP);
          break;
        case '?':
          // Shift+/ → 快捷键面板
          e.preventDefault();
          onToggleShortcuts?.();
          break;
        case 'Escape':
          if (isControlsVisible) {
            e.preventDefault();
            hideControls();
          }
          break;
        case '[':
          e.preventDefault();
          onPrevEpisode?.();
          break;
        case ']':
          e.preventDefault();
          onNextEpisode?.();
          break;
        default: {
          // 0-9：跳转到 0%–90%（B站/YouTube 标准行为）
          if (/^[0-9]$/.test(e.key)) {
            const dur = playerCore.getDuration();
            if (dur > 0) {
              e.preventDefault();
              playerCore.seek((dur * Number(e.key)) / 10);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
        seekDebounceRef.current = null;
      }
    };
  }, [platform, mode, isControlsVisible, showControls, hideControls, showVolumePopupWithTimer, playerCore, toggleFullscreen, onPrevEpisode, onNextEpisode, onToggleShortcuts]);
}
