import { useRef } from 'react';
import { SkipBack, SkipForward, StepBack, StepForward, Keyboard } from 'lucide-react';
import { usePlayerStore } from '@/stores';
import { Icon } from '@/components/ui/Icon';
import type { PlayerMode, PlatformType, DecoderMode, PlayerLevel, LoopMode } from '@/types/player';
import MirrorButton from './MirrorButton';
import RatioButton from './RatioButton';
import ProgressBar from './ProgressBar';
import PlayButton from './PlayButton';
import VolumeControl from './VolumeControl';
import SpeedControl from './SpeedControl';
import SubtitleControl from './SubtitleControl';
import PiPButton from './PiPButton';
import FullscreenButton from './FullscreenButton';
import { DecoderSwitchMenuItem } from './DecoderSwitch';
import LiveIndicator from './LiveIndicator';
import RefreshButton from './RefreshButton';
import ResolutionSwitch from './ResolutionSwitch';
import TimeDisplay from './TimeDisplay';
import MoreMenu from './MoreMenu';
import ScreenshotButton from './ScreenshotButton';
import LoopButton from './LoopButton';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface ControlBarProps {
  mode: PlayerMode;
  platform: PlatformType;
  visible: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute?: () => void;
  /** 音量变化时弹出 3s 音量条（G2：点播模式与 IPTV 一致） */
  onVolumePopup?: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onDecoderModeChange: (mode: DecoderMode) => void;
  onTogglePiP: () => void;
  onImportSubtitle: (file: File) => void;
  onLoopModeChange?: (mode: LoopMode) => void;
  onActivity?: () => void;
  onRefresh?: () => void;
  onScreenshot?: () => void;
  /** 打开键盘快捷键面板（Shift+? / 更多菜单入口） */
  onShowShortcuts?: () => void;
  isMobile?: boolean;
  /** 全屏模式：恢复桌面布局但去除音量/循环，并把画中画+更多设置移出底部（改由右上角常驻操作组承担） */
  fullscreen?: boolean;
  /** 播放错误态：透传给全屏按钮，错误时禁用全屏（C4 守卫一致） */
  hasError?: boolean;
  levels: PlayerLevel[];
  currentLevel: number;
  onLevelChange: (level: number) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  slots?: {
    left?: React.ReactNode;
    center?: React.ReactNode;
    right?: React.ReactNode;
  };
}

export default function ControlBar({
  mode,
  platform,
  visible,
  containerRef,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onVolumePopup,
  onPlaybackRateChange,
  onDecoderModeChange,
  onTogglePiP,
  onImportSubtitle,
  onLoopModeChange,
  onActivity,
  onRefresh,
  onScreenshot,
  onShowShortcuts,
  isMobile = false,
  fullscreen = false,
  hasError = false,
  levels,
  currentLevel,
  onLevelChange,
  activePopover,
  onPopoverChange,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  slots,
}: ControlBarProps) {
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isPlayerLoading = usePlayerStore(s => s.isPlayerLoading);
  const isReadyToPlay = usePlayerStore(s => s.isReadyToPlay);
  const volume = usePlayerStore(s => s.volume);
  const playbackRate = usePlayerStore(s => s.playbackRate);
  const decoderMode = usePlayerStore(s => s.decoderMode);
  const isPiP = usePlayerStore(s => s.isPiP);
  const currentTime = usePlayerStore(s => s.progress);
  const videoDuration = usePlayerStore(s => s.duration);
  const buffered = usePlayerStore(s => s.bufferedProgress);
  const isBuffering = usePlayerStore(s => s.isBuffering);
  const loopMode = usePlayerStore(s => s.loopMode);
  const barRef = useRef<HTMLDivElement>(null);

  const isHls = usePlayerStore(s => s.currentType) === 'm3u8';
  const isVideoMode = mode === 'video';
  const isLiveLike = mode === 'iptv' || mode === 'live';
  // 功能按钮（字幕/倍速/清晰度）在桌面栏显示：桌面非全屏，或全屏（任意端）
  const showFeatureButtons = fullscreen || !isMobile;

  return (
    <div
      ref={barRef}
      data-visible={String(visible)}
      className={`up-control-bar ${visible ? 'up-control-bar-visible' : 'up-control-bar-hidden'} up-platform-${platform}${fullscreen ? ' up-control-bar--fullscreen' : ''}`}
      onMouseMove={onActivity}
      role="toolbar"
      aria-label="播放器控制栏"
      aria-orientation="horizontal"
    >
      {isMobile && !fullscreen ? (
        /* 移动端单行布局：播放 / 进度条 / 时间轴 / 全屏 同行（桌面端不受影响） */
        <div className="up-control-mobile-row">
          <PlayButton isPlaying={isPlaying} disabled={isPlayerLoading && !isReadyToPlay} onClick={onTogglePlay} />
          <ProgressBar
            mode={mode}
            currentTime={currentTime}
            duration={videoDuration}
            buffered={buffered}
            onSeek={onSeek}
            isBuffering={isBuffering}
          />
          {isVideoMode && <TimeDisplay currentTime={currentTime} duration={videoDuration} />}
          {isLiveLike && onRefresh && <RefreshButton onClick={onRefresh} />}
          <FullscreenButton containerRef={containerRef} hasError={hasError} />
        </div>
      ) : (
        <>
          <ProgressBar
            mode={mode}
            currentTime={currentTime}
            duration={videoDuration}
            buffered={buffered}
            onSeek={onSeek}
            isBuffering={isBuffering}
          />

          <div className="up-control-bar-buttons">
        <div className="up-control-left">
          {hasPrevEpisode !== undefined && !isMobile && (
            <button
              disabled={!hasPrevEpisode}
              onClick={onPrevEpisode}
              title="上一集 ([)"
            >
              <DuoIcon primary={SkipBack} secondary={StepBack} size="md" />
            </button>
          )}
          {/* 缓冲中是否暂停由 togglePlay 统一决定（缓冲中不暂停，防缓冲锁死）；
              仅加载/切集未就绪时禁用按钮（此时点播放无意义，且 play() 排队会被切源中断） */}
          <PlayButton isPlaying={isPlaying} disabled={isPlayerLoading && !isReadyToPlay} onClick={onTogglePlay} />
          {hasNextEpisode !== undefined && !isMobile && (
            <button
              disabled={!hasNextEpisode}
              onClick={onNextEpisode}
              title="下一集 (])"
            >
              <DuoIcon primary={SkipForward} secondary={StepForward} size="md" />
            </button>
          )}
          {isLiveLike && onRefresh && (
            <RefreshButton onClick={onRefresh} />
          )}
          {isVideoMode && (
            <TimeDisplay currentTime={currentTime} duration={videoDuration} />
          )}
          <LiveIndicator visible={mode === 'live'} />
          {slots?.left}
        </div>

        {slots?.center && (
          <div className="up-control-center">
            {slots.center}
          </div>
        )}

        <div className="up-control-right">
          {/* 音量：全屏模式按需求④移除（移动端音量无意义，iOS 甚至禁止 JS 改音量） */}
          {!isMobile && !fullscreen && (
            <VolumeControl
              volume={volume}
              onChange={onVolumeChange}
              onToggleMute={onToggleMute}
              onVolumePopup={onVolumePopup}
              activePopover={activePopover}
              onPopoverChange={onPopoverChange}
            />
          )}
          <div className="up-control-feature">
            {isVideoMode && showFeatureButtons && (
              <SubtitleControl
                onImportSubtitle={onImportSubtitle}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {showFeatureButtons && (
              <SpeedControl
                currentRate={playbackRate}
                onChange={onPlaybackRateChange}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {isVideoMode && showFeatureButtons && (
              <ResolutionSwitch
                levels={levels}
                currentLevel={currentLevel}
                onChange={onLevelChange}
                visible={isHls}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {/* 循环：全屏模式按需求④移出底部（收纳进右上角「更多设置」抽屉） */}
            {isVideoMode && !isMobile && !fullscreen && onLoopModeChange && (
              <LoopButton mode={loopMode} onChange={onLoopModeChange} />
            )}
          </div>
          {/* 更多设置：全屏模式移出底部，改由右上角常驻操作组承担（FsTopRightActions） */}
          {!isMobile && !fullscreen && (
            <MoreMenu
              activePopover={activePopover}
              onPopoverChange={onPopoverChange}
            >
              <DecoderSwitchMenuItem currentMode={decoderMode} onChange={onDecoderModeChange} visible={isHls} />
              {isVideoMode && <MirrorButton />}
              {isVideoMode && <RatioButton />}
              {onScreenshot && <ScreenshotButton onClick={onScreenshot} />}
              {onShowShortcuts && (
                <button
                  className="up-popover-item"
                  title="键盘快捷键 (Shift+?)"
                  onClick={(e) => { e.stopPropagation(); onPopoverChange(null); onShowShortcuts(); }}
                >
                  <Icon icon={Keyboard} size="sm" />
                  <span>快捷键</span>
                </button>
              )}
            </MoreMenu>
          )}
          {/* 画中画+全屏：全屏模式移出底部（画中画改由右上角常驻操作组承担），
              仅保留全屏按钮在底栏右侧收尾 */}
          {!isMobile && !fullscreen && (
            <div className="up-control-window">
              <PiPButton isPiP={isPiP} onClick={onTogglePiP} />
              <FullscreenButton containerRef={containerRef} hasError={hasError} />
            </div>
          )}
          {/* 全屏模式底部栏：字幕/倍速/清晰度之后补「截图 + 全屏」，
              画中画与更多设置已在右上角常驻，不再出现于底栏 */}
          {fullscreen && onScreenshot && (
            <ScreenshotButton onClick={onScreenshot} />
          )}
          {fullscreen && (
            <FullscreenButton containerRef={containerRef} hasError={hasError} />
          )}
          {slots?.right}
          </div>
          </div>
        </>
      )}
    </div>
  );
}