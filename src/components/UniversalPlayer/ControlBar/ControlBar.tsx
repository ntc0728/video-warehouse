import { useRef } from 'react';
import { usePlayerStore } from '@/stores';
import type { PlayerMode, PlatformType, DecoderMode, PlayerLevel, LoopMode } from '@/types/player';
import type { VideoSource } from '@/types/video';
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
import SourceSwitch from './SourceSwitch';
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
  levels: PlayerLevel[];
  currentLevel: number;
  onLevelChange: (level: number) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
  sources?: VideoSource[];
  currentSourceIndex?: number;
  onSourceSwitch?: (index: number) => void;
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
  levels,
  currentLevel,
  onLevelChange,
  activePopover,
  onPopoverChange,
  sources,
  currentSourceIndex,
  onSourceSwitch,
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
          <PlayButton isPlaying={isPlaying} onClick={onTogglePlay} />
          {sources && currentSourceIndex !== undefined && onSourceSwitch && (
            <SourceSwitch
              sources={sources}
              currentIndex={currentSourceIndex}
              onSwitch={onSourceSwitch}
              activePopover={activePopover}
              onPopoverChange={onPopoverChange}
            />
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
            {isVideoMode && (
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
            {isVideoMode && (
              <ResolutionSwitch
                levels={levels}
                currentLevel={currentLevel}
                onChange={onLevelChange}
                visible={isHls}
                activePopover={activePopover}
                onPopoverChange={onPopoverChange}
              />
            )}
            {isVideoMode && onLoopModeChange && (
              <LoopButton mode={loopMode} onChange={onLoopModeChange} />
            )}
          </div>
          <MoreMenu
            activePopover={activePopover}
            onPopoverChange={onPopoverChange}
          >
            <DecoderSwitchMenuItem currentMode={decoderMode} onChange={onDecoderModeChange} visible={isHls} />
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