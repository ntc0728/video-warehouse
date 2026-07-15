import { useState, useCallback, useRef, useEffect, useMemo, Component, type ReactNode } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { toast } from '@/components/ui';
import { useNetworkSpeed, useNetworkQuality } from '@/hooks';
import { usePlayerCore } from './hooks/usePlayerCore';
import { usePlayerControls } from './hooks/usePlayerControls';
import { useIPTVNavigation } from './hooks/useIPTVNavigation';
import { useTVInput } from './hooks/useTVInput';
import { useLongPress } from './hooks/useLongPress';
import { useSubtitleImport } from './hooks/useSubtitleImport';
import { useEPGData } from './hooks/useEPGData';
import { useIPTVTimeout } from './hooks/useIPTVTimeout';
import { useScreenshot } from './hooks/useScreenshot';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ToastProvider } from './PlayerToast';
import ToastTrigger from './ToastTrigger';
import { useTimeshift } from './hooks/useTimeshift';
import { getFullscreenElement, requestFullscreen, exitFullscreen } from './lib/fullscreen';
import PlayerCore from './PlayerCore';
import './UniversalPlayer.css';
import PlayerHeader from './PlayerHeader';
import { ControlBar } from './ControlBar';
import { IPTVChannelList } from './IPTVChannelList';
import { IPTVOSDBar, VolumePopup } from './IPTVOSDBar';
import EPGProgramList from '@/components/EPGProgramList/EPGProgramList';
import type { EPGProgram } from '@/services/epgService';
import { Rewind, FastForward, X } from 'lucide-react';
import { PlayerContext } from './context/PlayerContext';
import { useIPTVChannelInit, usePlayerClickHandler, useBufferMonitor } from './modules';
import type { UniversalPlayerProps } from '@/types/player';
import type { IPTVChannel } from '@/types/iptv';
import type { SourceType } from '@/types/video';

const VOLUME_POPUP_DELAY = 3000;

interface PlayerErrorBoundaryProps {
  children: ReactNode;
}

interface PlayerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, PlayerErrorBoundaryState> {
  constructor(props: PlayerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PlayerErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('PlayerErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="up-universal-player up-player-error-boundary">
          <div className="up-player-error-content">
            <span style={{ fontSize: 'var(--text-2xl)' }}>播放器出错</span>
            <span style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}>
              {this.state.error?.message || '未知错误'}
            </span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function UniversalPlayer({
  url,
  type,
  mode = 'video',
  platform = 'desktop',
  title = '',
  videoId,
  vodId,
  episodeUrl,
  cmsSourceId,
  skipHistory = false,
  autoPlay = false,
  channelName,
  channels: _channels = [],
  groups = [],
  onProgress,
  onEnded,
  onPlay,
  onPause,
  onError,
  onBack,
  onChannelChange,
  onSkipIntro,
  onSkipOutro,
  controlBarSlots,
  episodeLabel,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
}: UniversalPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const volumePopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasError, setHasError] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [showProgramGuide, setShowProgramGuide] = useState(false);
  const [programGuideData, setProgramGuideData] = useState<EPGProgram[]>([]);
  const [programGuideChannelName, setProgramGuideChannelName] = useState('');
  const [timeshiftSupported, setTimeshiftSupported] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [playClickAnim, setPlayClickAnim] = useState(false);

  const {
    decoderMode, isControlsVisible, isChannelListVisible,
    setControlsVisible, setChannelListVisible,
    setMode, setPlatform, sources,
    setDecoderMode, setSource, setLoopMode,
    levels, currentLevel,
    isPlaying, audioTracks, isBuffering,
    isReadyToPlay, isPlayerLoading,
  } = usePlayerStore();

  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);

  // EPG 数据 hook
  const { epgReady, epgProgramsRef, epgStatus, epgError } = useEPGData({ mode, channels: _channels });

  // EPG 加载失败时显示 toast
  useEffect(() => {
    if (epgStatus === 'error' && epgError && mode === 'iptv') {
      toast.show({ content: `EPG: ${epgError}`, duration: 4000 });
    }
  }, [epgStatus, epgError, mode]);

  // IPTV 导航 hook
  const {
    currentChannelId, setCurrentChannelId,
    currentChannelName, setCurrentChannelName,
    currentUrl, setCurrentUrl,
    currentType, setCurrentType,
    handleChannelSelect: baseHandleChannelSelect,
    handleSourceSwitch,
  } = useIPTVNavigation({
    proxyUrl,
    proxyPattern,
    onChannelChange,
    setChannelListVisible,
  });

  const currentChannel = useMemo(() => {
    if (mode !== 'iptv' || !currentChannelId) return undefined;
    return _channels.find(ch => ch.id === currentChannelId);
  }, [mode, currentChannelId, _channels]);

  // 播放器控制 hook
  const {
    autoHideTimerRef,
    resetAutoHideTimer,
    showControls,
    hideControls,
  } = usePlayerControls({ setControlsVisible, activePopover });

  // 长按 hook
  const {
    seekIndicator,
    hasLongPressedRef,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
  } = useLongPress({
    onSeek: useCallback((direction: 'left' | 'right') => {
      if (hasError || isBuffering) return;
      const video = videoElementRef.current;
      if (!video || video.error || video.readyState < 2) return;
      const seekAmount = direction === 'left' ? -6 : 6;
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seekAmount));
    }, [hasError, isBuffering]),
    mode,
    disabled: isBuffering,
  });

  // 字幕导入 hook
  const { handleImportSubtitle } = useSubtitleImport();

  // 截图 hook
  const { handleScreenshot } = useScreenshot({ title });

  // 音量弹窗
  const showVolumePopupWithTimer = useCallback(() => {
    setShowVolumePopup(true);
    if (volumePopupTimerRef.current) clearTimeout(volumePopupTimerRef.current);
    volumePopupTimerRef.current = setTimeout(() => {
      setShowVolumePopup(false);
    }, VOLUME_POPUP_DELAY);
  }, []);

  const handleChannelSelect = useCallback((channel: IPTVChannel) => {
    setHasError(false);
    baseHandleChannelSelect(channel);
  }, [baseHandleChannelSelect]);

  const handleToggleFullscreen = useCallback(async () => {
    if (hasError) return;
    const el = containerRef.current;
    if (!el) return;
    try {
      if (getFullscreenElement()) {
        await exitFullscreen(videoElementRef.current);
      } else {
        await requestFullscreen(el);
      }
    } catch {
      // 部分平台不支持全屏 API，静默失败
    }
  }, [hasError]);

  // 键盘快捷键 hook
  useKeyboardShortcuts({
    platform,
    mode,
    isControlsVisible,
    showControls,
    hideControls,
    playerCore: {
      togglePlay: () => playerCore.togglePlay(),
      setVolume: (v) => playerCore.setVolume(v),
      seek: (t) => playerCore.seek(t),
      getCurrentTime: () => playerCore.getCurrentTime(),
      getDuration: () => playerCore.getDuration(),
    },
    showVolumePopupWithTimer,
    toggleFullscreen: handleToggleFullscreen,
    onPrevEpisode,
    onNextEpisode,
  });

  // IPTV 超时 hook
  useIPTVTimeout({ mode, currentUrl, onTimeout: useCallback(() => setHasError(true), []) });

  // 初始化 effect
  useEffect(() => { setMode(mode); }, [mode, setMode]);
  useEffect(() => { setPlatform(platform); }, [platform, setPlatform]);
  useEffect(() => { setSource(url, type); }, [url, type, setSource]);

  useEffect(() => {
    const { rememberVolume } = useSettingsStore.getState();
    if (!rememberVolume) {
      usePlayerStore.getState().setVolume(1);
    }
  }, []);

  // 容器尺寸监听
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentBoxSize?.[0]?.inlineSize ?? (entry.target as HTMLElement).clientWidth;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentUrlRef = useRef(currentUrl);
  currentUrlRef.current = currentUrl;

const playerCore = usePlayerCore({
url: mode === 'iptv' ? (currentUrl || url) : url,
type: (mode === 'iptv' ? (currentType || type) : type) as SourceType,
videoId,
vodId,
episodeUrl,
cmsSourceId,
skipHistory,
autoPlay,
decoderMode,
retryCount,
    onProgress,
    onEnded,
    onPlay,
    onPause,
    onSkipIntro,
    onSkipOutro,
    onError: useCallback((error: Error) => {
      if (currentUrlRef.current !== currentUrl) return;
      // If video is already playing (e.g. audio works but video decode fails),
      // show non-blocking toast instead of the full error overlay
      if (videoElementRef.current && !videoElementRef.current.paused) {
        toast.show({ content: error.message, duration: 5000 });
        return;
      }
      setHasError(true);
      onError?.(error);
    }, [currentUrl, onError]),
  });

  const storeVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element;
    playerCore.videoRef(element);
  }, [playerCore]);

  // 时移 hook
  const timeshift = useTimeshift({ mode, playerCore });

  // 同步时移支持状态，用于 EPG 节目单
  useEffect(() => {
    setTimeshiftSupported(timeshift.supportsTimeshift);
  }, [timeshift.supportsTimeshift]);

  // 电视输入 hook
  const {
    tvFocusGroupIndex, setTvFocusGroupIndex,
    tvFocusChannelIndex, setTvFocusChannelIndex,
    tvFocusSection, setTvFocusSection,
  } = useTVInput({
    platform,
    isChannelListVisible,
    playerCore: { togglePlay: () => playerCore.togglePlay(), setVolume: (v) => playerCore.setVolume(v) },
    groups,
    onChannelSelect: handleChannelSelect,
    onToggleChannelList: () => setChannelListVisible(!isChannelListVisible),
  });

  // IPTV 频道初始化
  useIPTVChannelInit({
    mode, url, channels: _channels, groups, channelName,
    setCurrentChannelId, setCurrentChannelName,
    setCurrentUrl, setCurrentType,
    setTvFocusGroupIndex, setTvFocusChannelIndex,
  });

  // URL 匹配失败时的兜底：用 channelName prop 反查频道
  useEffect(() => {
    if (mode !== 'iptv' || currentChannelId || _channels.length === 0 || !channelName) return;
    const fallback = _channels.find(ch => ch.name === channelName);
    if (fallback) {
      setCurrentChannelId(fallback.id);
      setCurrentChannelName(fallback.name);
    }
  }, [mode, currentChannelId, _channels, channelName, setCurrentChannelId, setCurrentChannelName]);

  // 音轨轮询（事件驱动回退：轮询直到找到音轨后停止）
  useEffect(() => {
    if (mode !== 'iptv' || currentType !== 'm3u8') return;
    const store = usePlayerStore.getState;
    // 如果音轨已加载，跳过轮询
    if (store().audioTracks.length > 0) return;
    const check = setInterval(() => {
      const tracks = playerCore.getAudioTracks();
      if (tracks.length > 0) {
        store().setAudioTracks(tracks);
        store().setCurrentAudioTrack(playerCore.getCurrentAudioTrack());
        clearInterval(check);
      }
    }, 1000);
    // 安全超时：15 秒后停止轮询
    const timeout = setTimeout(() => clearInterval(check), 15000);
    return () => { clearInterval(check); clearTimeout(timeout); };
  }, [mode, currentType, playerCore]);

  // 缓冲检测
  useBufferMonitor(videoElementRef, currentUrl);

  // 点击处理
  const { handlePlayerClick, clickTimerRef } = usePlayerClickHandler({
    mode, hasError, isControlsVisible,
    hasLongPressedRef, videoElementRef, containerRef,
    showControls, togglePlay: () => playerCore.togglePlay(),
  });

  const handleOpenProgramGuide = useCallback(async () => {
    if (!currentChannelId) return;

    const displayName = currentChannelName || channelName || '';
    setProgramGuideChannelName(displayName);

    // 加载当前频道的 EPG 数据
    try {
      const { fetchAndParseEPG, getChannelProgramsWithStatus: getProgs, matchEPGChannel } = await import('@/services/epgService');
      const epgData = await fetchAndParseEPG();
      const currentCh = _channels.find(c => c.id === currentChannelId);

      const matchedChannel = currentCh
        ? matchEPGChannel(currentCh.name, currentCh.tvgId, epgData.channels)
        : null;

      const matchedId = matchedChannel?.id || currentChannelId;
      if (matchedId) {
        const progs = getProgs(matchedId, epgData);
        setProgramGuideData(progs);
      }
    } catch {
      setProgramGuideData([]);
    }

    setShowProgramGuide(true);
    showControls();
  }, [currentChannelId, currentChannelName, channelName, _channels, showControls]);

  const handleCloseProgramGuide = useCallback(() => {
    setShowProgramGuide(false);
  }, []);

  const handleProgramClick = useCallback((program: EPGProgram) => {
    if (!program.isPast) return;
    const video = videoElementRef.current;
    if (video) {
      const secondsAgo = (Date.now() - program.start.getTime()) / 1000;
      // 直播流：从 seekable 获取实时边缘；点播：使用 duration
      let liveEdge: number;
      if (video.seekable.length > 0) {
        liveEdge = video.seekable.end(video.seekable.length - 1);
      } else {
        liveEdge = isFinite(video.duration) ? video.duration : 0;
      }
      const seekTarget = Math.max(0, liveEdge - secondsAgo);
      // 限制在可 seek 范围内
      if (video.seekable.length > 0) {
        const seekStart = video.seekable.start(0);
        video.currentTime = Math.max(seekStart, Math.min(liveEdge, seekTarget));
      } else {
        video.currentTime = seekTarget;
      }
    }
    setShowProgramGuide(false);
  }, []);

  const handleAudioTrackSelect = useCallback(() => {
    const tracks = usePlayerStore.getState().audioTracks;
    const current = usePlayerStore.getState().currentAudioTrack;
    if (tracks.length <= 1) return;
    const nextIndex = tracks.findIndex(t => t.id === current) + 1;
    const nextTrack = tracks[nextIndex % tracks.length];
    playerCore.setCurrentAudioTrack(nextTrack.id);
    usePlayerStore.getState().setCurrentAudioTrack(nextTrack.id);
  }, [playerCore]);

  const iptvSourceCount = useMemo(() => {
    if (mode !== 'iptv' || !currentChannel) return 0;
    return _channels.filter(
      ch => ch.name === currentChannel.name && ch.sourceId !== currentChannel.sourceId
    ).length;
  }, [mode, currentChannel, _channels]);

  const volume = usePlayerStore(s => s.volume);
  const networkSpeed = useNetworkSpeed();
  const networkQuality = useNetworkQuality();

  /** 解析网速字符串为数值（KB/s）用于判断网络状态 */
  const parseSpeedKBs = (speedStr: string): number => {
    const match = speedStr.match(/([\d.]+)\s*(KB|MB|B)\/s/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === 'MB') return value * 1000;
    if (unit === 'B') return value / 1000;
    return value;
  };

  /** 根据网速和缓冲状态判断卡顿原因 */
  const getBufferingReason = useCallback((): string => {
    const speedKBs = parseSpeedKBs(networkSpeed);
    // 根据当前画质动态计算网速阈值：bitrate * 1.2 / 8 / 1024 (KB/s)
    // 无画质信息时回退到默认 500 KB/s
    let networkSlowThreshold = 500;
    if (levels.length > 0) {
      const level = currentLevel >= 0 ? levels[currentLevel] : levels[levels.length - 1];
      if (level?.bitrate > 0) {
        networkSlowThreshold = Math.max(200, (level.bitrate * 1.2) / 8 / 1024);
      }
    }

    if (speedKBs <= 0) {
      return '正在连接...';
    }
    if (speedKBs < networkSlowThreshold) {
      return '网络连接不稳定';
    }
    // 网络正常但仍在缓冲，可能是源响应慢
    return '缓冲中，可能是源响应较慢';
  }, [networkSpeed, levels, currentLevel]);

  const channelProgram = useMemo(() => {
    if (!epgReady || !currentChannelId) return undefined;
    return epgProgramsRef.current.get(currentChannelId);
  }, [currentChannelId, epgReady, epgProgramsRef]);

  const channelNumber = useMemo(() => {
    if (!currentChannelId || !groups.length) return undefined;
    let num = 0;
    for (const g of groups) {
      for (const ch of g.channels) {
        num++;
        if (ch.id === currentChannelId) return num;
      }
    }
    return undefined;
  }, [currentChannelId, groups]);

  // 频道列表可见性控制
  useEffect(() => {
    if (isChannelListVisible) {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      hideControls();
    } else {
      showControls();
    }
  }, [isChannelListVisible, hideControls, showControls, autoHideTimerRef]);

  // 清理定时器
  useEffect(() => {
    const clickTimer = clickTimerRef.current;
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      if (volumePopupTimerRef.current) {
        clearTimeout(volumePopupTimerRef.current);
      }
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
    // clickTimerRef 是 ref，引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHideTimerRef]);

  // URL 或频道变化时重置错误状态
  useEffect(() => { setHasError(false); }, [url, currentUrl]);

  // 错误状态管理
  useEffect(() => {
    if (hasError) {
      setControlsVisible(true);
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    } else if (!isPlaying) {
      setControlsVisible(true);
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    } else {
      resetAutoHideTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError, isPlaying]);

  // 错误恢复
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  // 切换频道前冻结当前帧（同步 DOM 操作，避免 React 异步渲染延迟导致黑屏闪现）
  return (
    <ToastProvider>
    <ToastTrigger />
    <PlayerErrorBoundary>
    <PlayerContext.Provider value={{ getVideoElement: () => videoElementRef.current }}>
    <div
      ref={containerRef}
      className={`up-universal-player up-platform-${platform} up-mode-${mode}`}
      tabIndex={-1}
    >
      <PlayerCore
        videoRef={storeVideoRef}
        mode={mode}
        hasError={hasError}
        onClick={handlePlayerClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onOpenChannelList={() => setChannelListVisible(true)}
        onRetry={() => { setHasError(false); setRetryCount(c => c + 1); }}
      />

      {/* 加载中 / 缓冲中统一显示带文字信息的遮罩 */}
      {(isPlayerLoading || isBuffering) && !hasError && (
        <div className="up-iptv-buffering-overlay">
          <div className="up-iptv-buffering-spinner" />
          {isBuffering && (
            <>
              <span className="up-iptv-buffering-text">{networkSpeed}</span>
              <div className="up-iptv-buffering-metrics">
                <span className="up-iptv-buffering-metric">
                  延迟 {networkQuality.latency}
                </span>
                <span className="up-iptv-buffering-metric">
                  丢包 {networkQuality.packetLoss}
                </span>
              </div>
              <span className="up-iptv-buffering-reason">
                {getBufferingReason()}
              </span>
            </>
          )}
        </div>
      )}

      {/* 预加载完成待播放 / 暂停状态显示播放按钮 */}
      {isReadyToPlay && !isPlaying && !hasError && !isBuffering && (
        <div
          className="up-player-paused-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPlayClickAnim(true);
            setTimeout(() => {
              setPlayClickAnim(false);
              playerCore.play();
            }, 300);
          }}
        >
          <div className={`up-player-play-button${playClickAnim ? ' up-player-play-button--click' : ''}`}>
            <svg viewBox="0 0 80 80" className="up-player-play-icon" aria-hidden="true">
              <circle cx="40" cy="40" r="38" />
              <polygon points="28,24 28,56 58,40" />
            </svg>
          </div>
        </div>
      )}

      {seekIndicator && (
        <div className={`up-seek-indicator up-seek-indicator-${seekIndicator}`}>
          {seekIndicator === 'left' ? <Rewind size={32} /> : <FastForward size={32} />}
          <span>6s</span>
        </div>
      )}

      <PlayerHeader
        mode={mode}
        title={title}
        episodeLabel={episodeLabel}
        channelName={currentChannelName || channelName}
        visible={isControlsVisible || hasError}
        showFullscreenButton={mode === 'iptv'}
        containerRef={containerRef as React.RefObject<HTMLElement>}
        onBack={() => onBack?.()}
        onActivity={resetAutoHideTimer}
      />

      {mode === 'iptv' ? (
        <IPTVOSDBar
          visible={isControlsVisible}
          hasError={hasError}
          channelName={currentChannelName || channelName || ''}
          channelLogo={currentChannel?.logo}
          currentProgram={channelProgram?.current ?? currentChannel?.currentProgram}
          nextProgram={channelProgram?.next ?? currentChannel?.nextProgram}
          channelNumber={channelNumber}
          currentSourceIndex={0}
          totalSources={mode === 'iptv' ? iptvSourceCount : sources.length}
          containerWidth={containerWidth}
          audioTracks={audioTracks}
          onToggleChannelList={() => setChannelListVisible(true)}
          onSourceSwitch={(index) => handleSourceSwitch(index, mode, currentChannel, _channels, sources)}
          onOpenSettings={() => {}}
          onOpenResolution={() => {}}
          onOpenAudioTrack={handleAudioTrackSelect}
          onHeightChange={() => {}}
          epgStatus={epgStatus}
          onRefreshEpg={handleOpenProgramGuide}
          onOpenProgramGuide={handleOpenProgramGuide}
          isTimeshifted={timeshift.isTimeshifted}
          latencyLabel={timeshift.latencyLabel}
          onReturnToLive={timeshift.returnToLive}
        />
      ) : (
        <ControlBar
          mode={mode}
          platform={platform}
          visible={isControlsVisible}
          containerRef={containerRef as React.RefObject<HTMLElement>}
          onTogglePlay={playerCore.togglePlay}
          onSeek={playerCore.seek}
          onVolumeChange={playerCore.setVolume}
          onPlaybackRateChange={playerCore.setPlaybackRate}
          onDecoderModeChange={setDecoderMode}
          onTogglePiP={playerCore.togglePiP}
          onImportSubtitle={handleImportSubtitle}
          onLoopModeChange={setLoopMode}
          slots={controlBarSlots}
          onActivity={resetAutoHideTimer}
          onScreenshot={handleScreenshot}
          levels={levels}
          currentLevel={currentLevel}
          onLevelChange={playerCore.switchLevel}
          activePopover={activePopover}
          onPopoverChange={setActivePopover}
          hasPrevEpisode={hasPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          onPrevEpisode={onPrevEpisode}
          onNextEpisode={onNextEpisode}
          isBuffering={isBuffering}
        />
      )}

      {mode === 'iptv' && (
        <VolumePopup
          visible={showVolumePopup}
          volume={volume}
          onVolumeChange={playerCore.setVolume}
        />
      )}

      {/* EPG Program Guide overlay */}
      {mode === 'iptv' && showProgramGuide && (
        <div className="up-program-guide-overlay" onClick={handleCloseProgramGuide}>
          <div className="up-program-guide-panel" onClick={(e) => e.stopPropagation()}>
            <div className="up-program-guide-header">
              <span className="up-program-guide-title">
                {programGuideChannelName} · 节目单
              </span>
              <button className="up-program-guide-close" onClick={handleCloseProgramGuide} aria-label="关闭节目单">
                <X size={18} />
              </button>
            </div>
            <EPGProgramList
              programs={programGuideData}
              supportTimeshift={timeshiftSupported}
              onProgramClick={handleProgramClick}
            />
          </div>
        </div>
      )}

      {mode === 'iptv' && (
        <IPTVChannelList
          visible={isChannelListVisible}
          groups={groups}
          currentChannelId={currentChannelId}
          onSelectChannel={handleChannelSelect}
          onClose={() => setChannelListVisible(false)}
          tvFocus={platform === 'tv' ? { groupIndex: tvFocusGroupIndex, channelIndex: tvFocusChannelIndex, activeSection: tvFocusSection } : undefined}
          onTvFocusChange={platform === 'tv' ? (focus) => {
            setTvFocusGroupIndex(focus.groupIndex);
            setTvFocusChannelIndex(focus.channelIndex);
            setTvFocusSection(focus.activeSection);
          } : undefined}
        />
      )}
    </div>
    </PlayerContext.Provider>
    </PlayerErrorBoundary>
    </ToastProvider>
  );
}
