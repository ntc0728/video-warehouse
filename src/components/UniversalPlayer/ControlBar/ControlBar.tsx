import { useRef, useEffect, useState } from 'react';
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
import { SourceSwitchMenuItem } from './SourceSwitch';
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
  sources: VideoSource[];
  currentSourceIndex: number;
  onSourceSwitch: (index: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onDecoderModeChange: (mode: DecoderMode) => void;
  onTogglePiP: () => void;
  onImportSubtitle: (file: File) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  onActivity?: () => void;
  onRefresh?: () => void;
  onScreenshot?: () => void;
  onLoopModeChange?: (mode: LoopMode) => void;
  levels: PlayerLevel[];
  currentLevel: number;
  onLevelChange: (level: number) => void;
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
  sources,
  currentSourceIndex,
  onSourceSwitch,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onPlaybackRateChange,
  onDecoderModeChange,
  onTogglePiP,
  onImportSubtitle,
  getCurrentTime,
  getDuration,
  onActivity,
  onRefresh,
  onScreenshot,
  onLoopModeChange,
  levels,
  currentLevel,
  onLevelChange,
  slots,
}: ControlBarProps) {
  const {
    isPlaying, volume, playbackRate, decoderMode, isPiP, loopMode,
  } = usePlayerStore();

  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [buffered] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTimer = setInterval(() => {
      setCurrentTime(getCurrentTime());
      setVideoDuration(getDuration());
    }, 250);
    return () => clearInterval(updateTimer);
  }, [getCurrentTime, getDuration]);

  const isHls = usePlayerStore(s => s.currentType) === 'm3u8';
  const isVideoMode = mode === 'video';
  const isLiveLike = mode === 'iptv' || mode === 'live';

  return (
    <div
      ref={barRef}
      data-visible={String(visible)}
      className={`up-control-bar ${visible ? 'up-control-bar-visible' : 'up-control-bar-hidden'} up-platform-${platform}`}
      onMouseMove={onActivity}
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
          <VolumeControl volume={volume} onChange={onVolumeChange} />
          <div className="up-control-feature">
            {isVideoMode && <SubtitleControl onImportSubtitle={onImportSubtitle} />}
            <SpeedControl currentRate={playbackRate} onChange={onPlaybackRateChange} />
            {isVideoMode && (
              <ResolutionSwitch
                levels={levels}
                currentLevel={currentLevel}
                onChange={onLevelChange}
                visible={isHls}
              />
            )}
            {isVideoMode && onLoopModeChange && (
              <LoopButton mode={loopMode} onChange={onLoopModeChange} />
            )}
          </div>
          <MoreMenu>
            <DecoderSwitchMenuItem currentMode={decoderMode} onChange={onDecoderModeChange} visible={isHls} />
            <SourceSwitchMenuItem sources={sources} currentIndex={currentSourceIndex} onSwitch={onSourceSwitch} />
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