import { useRef } from 'react';
import { SkipBack, SkipForward } from 'lucide-react';
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

interface ControlBarProps {
  mode: PlayerMode;
  platform: PlatformType;
  visible: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onDecoderModeChange: (mode: DecoderMode) => void;
  onTogglePiP: () => void;
  onImportSubtitle: (file: File) => void;
  onLoopModeChange?: (mode: LoopMode) => void;
  onActivity?: () => void;
  onRefresh?: () => void;
  onScreenshot?: () => void;
  isMobile?: boolean;
  isBuffering?: boolean;
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
  onPlaybackRateChange,
  onDecoderModeChange,
  onTogglePiP,
  onImportSubtitle,
  onLoopModeChange,
  onActivity,
  onRefresh,
  onScreenshot,
  isMobile = false,
  isBuffering = false,
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
      <ProgressBar
        mode={mode}
        currentTime={currentTime}
        duration={videoDuration}
        buffered={buffered}
        onSeek={onSeek}
      />

      <div className="up-control-bar-buttons">
        <div className="up-control-left">
          {hasPrevEpisode !== undefined && (
            <button
              disabled={!hasPrevEpisode}
              onClick={onPrevEpisode}
              title="上一集 ([)"
            >
              <SkipBack size={20} />
            </button>
          )}
          <PlayButton isPlaying={isPlaying} disabled={isBuffering} onClick={onTogglePlay} />
          {hasNextEpisode !== undefined && (
            <button
              disabled={!hasNextEpisode}
              onClick={onNextEpisode}
              title="下一集 (])"
            >
              <SkipForward size={20} />
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
          <VolumeControl
            volume={volume}
            onChange={onVolumeChange}
            activePopover={activePopover}
            onPopoverChange={onPopoverChange}
          />
          <div className="up-control-feature">
            {isVideoMode && !isMobile && (
              <SubtitleControl
                onImportSubtitle={onImportSubtitle}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            <SpeedControl
              currentRate={playbackRate}
              onChange={onPlaybackRateChange}
              activePopover={activePopover}
              onPopoverChange={onPopoverChange}
            />
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
          <MoreMenu
            activePopover={activePopover}
            onPopoverChange={onPopoverChange}
          >
            {isVideoMode && isMobile && (
              <SubtitleControl
                onImportSubtitle={onImportSubtitle}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {isVideoMode && isMobile && (
              <ResolutionSwitch
                levels={levels}
                currentLevel={currentLevel}
                onChange={onLevelChange}
                visible={isHls}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {isVideoMode && isMobile && onLoopModeChange && (
              <LoopButton mode={loopMode} onChange={onLoopModeChange} />
            )}
            <DecoderSwitchMenuItem currentMode={decoderMode} onChange={onDecoderModeChange} visible={isHls} />
            {isVideoMode && <MirrorButton />}
            {isVideoMode && <RatioButton />}
            {onScreenshot && <ScreenshotButton onClick={onScreenshot} />}
          </MoreMenu>
          <div className="up-control-window">
            <PiPButton isPiP={isPiP} onClick={onTogglePiP} />
            <FullscreenButton containerRef={containerRef} />
          </div>
          {slots?.right}
        </div>
      </div>
    </div>
  );
}