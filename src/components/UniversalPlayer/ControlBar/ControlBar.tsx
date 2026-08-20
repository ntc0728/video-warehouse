import { useRef } from 'react';
import { SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import { usePlayerStore } from '@/stores';
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
  isMobile?: boolean;
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
  isMobile = false,
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
  const loopMode = usePlayerStore(s => s.loopMode);
  const barRef = useRef<HTMLDivElement>(null);

  const isHls = usePlayerStore(s => s.currentType) === 'm3u8';
  const isVideoMode = mode === 'video';
  const isLiveLike = mode === 'iptv' || mode === 'live';

  return (
    <div
      ref={barRef}
      data-visible={String(visible)}
      className={`up-control-bar ${visible ? 'up-control-bar-visible' : 'up-control-bar-hidden'} up-platform-${platform}`}
      onMouseMove={onActivity}
      role="toolbar"
      aria-label="播放器控制栏"
      aria-orientation="horizontal"
    >
      {isMobile ? (
        /* 移动端单行布局：播放 / 进度条 / 时间轴 / 全屏 同行（桌面端不受影响） */
        <div className="up-control-mobile-row">
          <PlayButton isPlaying={isPlaying} disabled={isPlayerLoading && !isReadyToPlay} onClick={onTogglePlay} />
          <ProgressBar
            mode={mode}
            currentTime={currentTime}
            duration={videoDuration}
            buffered={buffered}
            onSeek={onSeek}
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
          {!isMobile && (
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
            {isVideoMode && !isMobile && (
              <SubtitleControl
                onImportSubtitle={onImportSubtitle}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {!isMobile && (
              <SpeedControl
                currentRate={playbackRate}
                onChange={onPlaybackRateChange}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {isVideoMode && !isMobile && (
              <ResolutionSwitch
                levels={levels}
                currentLevel={currentLevel}
                onChange={onLevelChange}
                visible={isHls}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {isVideoMode && !isMobile && onLoopModeChange && (
              <LoopButton mode={loopMode} onChange={onLoopModeChange} />
            )}
          </div>
          {!isMobile && (
            <MoreMenu
              activePopover={activePopover}
              onPopoverChange={onPopoverChange}
            >
              <DecoderSwitchMenuItem currentMode={decoderMode} onChange={onDecoderModeChange} visible={isHls} />
              {isVideoMode && <MirrorButton />}
              {isVideoMode && <RatioButton />}
              {onScreenshot && <ScreenshotButton onClick={onScreenshot} />}
            </MoreMenu>
          )}
          {!isMobile && (
            <div className="up-control-window">
              <PiPButton isPiP={isPiP} onClick={onTogglePiP} />
              <FullscreenButton containerRef={containerRef} hasError={hasError} />
            </div>
          )}
          {slots?.right}
          </div>
          </div>
        </>
      )}
    </div>
  );
}