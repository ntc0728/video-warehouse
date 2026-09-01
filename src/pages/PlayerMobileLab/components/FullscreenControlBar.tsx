/**
 * 全屏态播放器控制栏（UI 改造目标形态）
 *
 * 三条改造要求：
 *   1. 恢复到桌面端控制栏 UI（进度条独立一行 + 左右分区按钮行）
 *   2. 去掉「音量设置」和「循环播放」
 *      —— 音量在移动端没有意义（iOS 甚至禁止 JS 改音量，只有静音开关可用），
 *         系统音量键 + 手势已经覆盖；循环播放挪进「更多设置」抽屉。
 *   3. 「画中画」和「更多设置」从控制栏移到播放器**右上角**
 *
 * 第 3 条单独抽成 FsTopRightActions：右上角常驻，不跟着控制栏一起自动隐藏，
 * 这样全屏时随时能唤起设置，不必先点一下画面把控制栏叫出来。
 */
import { useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, RefreshCw, Subtitles,
  Camera, MoreHorizontal, PictureInPicture2, Maximize, Minimize, Cast,
} from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

export interface FullscreenControlBarProps {
  visible: boolean;
  paused: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onRefresh?: () => void;
  /** 倍速档位切换（循环打开抽屉/弹窗，横屏走抽屉） */
  onOpenSpeed: () => void;
  onOpenQuality: () => void;
  onToggleSubtitle: () => void;
  subtitleOn: boolean;
  onScreenshot?: () => void;
  onActivity?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** 当前倍速/清晰度文案（右上角或控制栏展示） */
  rateLabel: string;
  qualityLabel: string;
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function FullscreenControlBar({
  visible, paused, currentTime, duration, buffered,
  onTogglePlay, onSeek, onPrev, onNext, hasPrev, hasNext, onRefresh,
  onOpenSpeed, onOpenQuality, onToggleSubtitle, subtitleOn, onScreenshot,
  onActivity, isFullscreen, onToggleFullscreen, rateLabel, qualityLabel,
}: FullscreenControlBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = Number(e.target.value) / 1000;
    onSeek(ratio * duration);
  };

  return (
    <div
      ref={barRef}
      className={`pml-fs-bar${visible ? ' pml-fs-bar--visible' : ''}`}
      onMouseMove={onActivity}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="全屏播放控制栏"
    >
      {/* 进度条（桌面端形态：独立一行、铺满顶部） */}
      <div className="pml-fs-progress">
        <div className="pml-fs-progress-track">
          <div className="pml-fs-progress-buffer" style={{ width: `${bufPct}%` }} />
          <div className="pml-fs-progress-play" style={{ width: `${pct}%` }} />
        </div>
        <input
          className="pml-fs-progress-input"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(pct * 10)}
          onChange={onScrub}
          aria-label="播放进度"
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        />
      </div>

      <div className="pml-fs-row">
        {/* 左区：上一集 / 播放暂停 / 下一集 / 刷新 / 时间 */}
        <div className="pml-fs-left">
          {onPrev && (
            <button
              type="button"
              className="pml-fs-btn"
              onClick={onPrev}
              disabled={!hasPrev}
              title="上一集"
              aria-label="上一集"
            >
              <Icon icon={SkipBack} size="md" />
            </button>
          )}
          <button
            type="button"
            className="pml-fs-btn pml-fs-btn--play"
            onClick={onTogglePlay}
            title={paused ? '播放' : '暂停'}
            aria-label={paused ? '播放' : '暂停'}
          >
            <Icon icon={paused ? Play : Pause} size="md" />
          </button>
          {onNext && (
            <button
              type="button"
              className="pml-fs-btn"
              onClick={onNext}
              disabled={!hasNext}
              title="下一集"
              aria-label="下一集"
            >
              <Icon icon={SkipForward} size="md" />
            </button>
          )}
          {onRefresh && (
            <button type="button" className="pml-fs-btn" onClick={onRefresh} title="刷新" aria-label="刷新">
              <Icon icon={RefreshCw} size="md" />
            </button>
          )}
          <span className="pml-fs-time">
            <b>{formatTime(currentTime)}</b> / {formatTime(duration)}
          </span>
        </div>

        <div className="pml-fs-spacer" />

        {/* 右区：字幕 / 倍速 / 清晰度 / 截图 / 全屏
            ⚠️ 已移除：音量（VolumeControl）、循环（LoopButton）
            ⚠️ 已移走：画中画、更多设置 → 播放器右上角（FsTopRightActions） */}
        <div className="pml-fs-right">
          <button
            type="button"
            className={`pml-fs-btn${subtitleOn ? ' pml-fs-btn--on' : ''}`}
            onClick={onToggleSubtitle}
            title="字幕"
            aria-label="字幕"
            aria-pressed={subtitleOn}
          >
            <Icon icon={Subtitles} size="md" />
          </button>
          <button type="button" className="pml-fs-btn pml-fs-btn--text" onClick={onOpenSpeed} title="倍速">
            {rateLabel}
          </button>
          <button type="button" className="pml-fs-btn pml-fs-btn--text" onClick={onOpenQuality} title="清晰度">
            {qualityLabel}
          </button>
          {onScreenshot && (
            <button type="button" className="pml-fs-btn" onClick={onScreenshot} title="截图" aria-label="截图">
              <Icon icon={Camera} size="md" />
            </button>
          )}
          <button
            type="button"
            className="pml-fs-btn"
            onClick={onToggleFullscreen}
            title={isFullscreen ? '退出全屏' : '全屏'}
            aria-label={isFullscreen ? '退出全屏' : '全屏'}
          >
            <Icon icon={isFullscreen ? Minimize : Maximize} size="md" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface FsTopRightActionsProps {
  pipSupported: boolean;
  isPip: boolean;
  onTogglePip: () => void;
  castEnabled: boolean;
  castActive: boolean;
  onCast: () => void;
  onMore: () => void;
  moreActive: boolean;
  /** 不允许画中画时的说明（tooltip + demo 提示） */
  pipHint: string;
}

/**
 * 播放器右上角常驻操作组：画中画 · 投屏 · 更多设置。
 * 与控制栏解耦——控制栏自动隐藏后它仍在，全屏随时可唤设置。
 */
export function FsTopRightActions({
  pipSupported, isPip, onTogglePip,
  castEnabled, castActive, onCast,
  onMore, moreActive, pipHint,
}: FsTopRightActionsProps) {
  return (
    <div
      className="pml-fs-corner"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {pipSupported && (
        <button
          type="button"
          className={`pml-fs-corner-btn${isPip ? ' pml-fs-corner-btn--on' : ''}`}
          onClick={onTogglePip}
          title={pipHint}
          aria-label={isPip ? '退出画中画' : '画中画'}
          aria-pressed={isPip}
        >
          <Icon icon={PictureInPicture2} size="md" />
        </button>
      )}
      {castEnabled && (
        <button
          type="button"
          className={`pml-fs-corner-btn${castActive ? ' pml-fs-corner-btn--on' : ''}`}
          onClick={onCast}
          title="投屏"
          aria-label="投屏"
          aria-pressed={castActive}
        >
          <Icon icon={Cast} size="md" />
        </button>
      )}
      <button
        type="button"
        className={`pml-fs-corner-btn${moreActive ? ' pml-fs-corner-btn--on' : ''}`}
        onClick={onMore}
        title="更多设置"
        aria-label="更多设置"
        aria-pressed={moreActive}
      >
        <Icon icon={MoreHorizontal} size="md" />
      </button>
    </div>
  );
}
