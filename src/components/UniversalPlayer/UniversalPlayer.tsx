import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePlayerStore, useIPTVStore, useSettingsStore } from '@/stores';
import { useNetworkSpeed } from '@/hooks';
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
import { getFullscreenElement, requestFullscreen, exitFullscreen } from './lib/fullscreen';
import PlayerCore from './PlayerCore';
import './UniversalPlayer.css';
import PlayerHeader from './PlayerHeader';
import { ControlBar } from './ControlBar';
import { IPTVChannelList } from './IPTVChannelList';
import { IPTVOSDBar, VolumePopup } from './IPTVOSDBar';
import { Rewind, FastForward } from 'lucide-react';
import type { UniversalPlayerProps } from '@/types/player';
import type { IPTVChannel } from '@/types/iptv';
import { shouldProxy, detectVideoSourceType } from '@/services/iptvService';
import type { SourceType } from '@/types/video';

const VOLUME_POPUP_DELAY = 3000;

export default function UniversalPlayer({
  url,
  type,
  mode = 'video',
  platform = 'desktop',
  title = '',
  videoId,
  episodeId,
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
  controlBarSlots,
}: UniversalPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const volumePopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRetryRef = useRef(0);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activePopover, setActivePopover] = useState<string | null>(null);

  const {
    decoderMode, isControlsVisible, isChannelListVisible,
    setControlsVisible, setChannelListVisible,
    setMode, setPlatform, sources,
    setDecoderMode, setSource,
    levels, currentLevel,
    isPlaying, audioTracks, currentAudioTrack, isBuffering,
  } = usePlayerStore();

  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);

  // EPG data hook
  const { epgReady, epgProgramsRef } = useEPGData({ mode, channels: _channels });

  // IPTV navigation hook
  const {
    currentChannelId, setCurrentChannelId,
    currentChannelName, setCurrentChannelName,
    currentUrl, setCurrentUrl,
    currentType, setCurrentType,
    handleChannelSelect: baseHandleChannelSelect,
    handleChannelUp,
    handleChannelDown,
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

  // Player controls hook
  const {
    autoHideTimerRef,
    resetAutoHideTimer,
    showControls,
    hideControls,
  } = usePlayerControls({ setControlsVisible, activePopover });

  // Long press hook
  const {
    seekIndicator,
    hasLongPressedRef,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
  } = useLongPress({
    onSeek: useCallback((direction: 'left' | 'right') => {
      const video = document.querySelector('.up-player-video') as HTMLVideoElement | null;
      if (!video) return;
      const seekAmount = direction === 'left' ? -6 : 6;
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seekAmount));
    }, []),
  });

  // Subtitle import hook
  const { handleImportSubtitle } = useSubtitleImport();

  // Screenshot hook
  const { handleScreenshot } = useScreenshot();

  // Volume popup
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

  // TV input hook
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

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    platform,
    mode,
    isChannelListVisible,
    isControlsVisible,
    showControls,
    hideControls,
    playerCore: { togglePlay: () => playerCore.togglePlay(), setVolume: (v) => playerCore.setVolume(v) },
    showVolumePopupWithTimer,
  });

  // IPTV timeout hook
  useIPTVTimeout({ mode, currentUrl, onTimeout: useCallback(() => setHasError(true), []) });

  // Init effects
  useEffect(() => { setMode(mode); }, [mode, setMode]);
  useEffect(() => { setPlatform(platform); }, [platform, setPlatform]);
  useEffect(() => { setSource(url, type); }, [url, type, setSource]);

  useEffect(() => {
    const { rememberVolume } = useSettingsStore.getState();
    if (!rememberVolume) {
      usePlayerStore.getState().setVolume(1);
    }
  }, []);

  // ResizeObserver
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

  // Init IPTV channel from URL
  useEffect(() => {
    if (mode !== 'iptv' || !url || _channels.length === 0) return;

    // 从代理 URL 中提取原始频道 URL 用于匹配。
    // 代理 URL 格式: ${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(channel.url)}
    // 注意：不能用 URL.searchParams.get() 因为它会 percent-decode 参数值，
    // 破坏 ch.url 中已有的百分号编码字符（如 %20），导致精匹配失败。
    let lookupUrl = url;
    try {
      const parsed = new URL(url);
      const urlMatch = parsed.search.match(/[?&]url=([^&]*)/);
      if (urlMatch) lookupUrl = urlMatch[1];
    } catch {
      // url 不是标准 URL 格式时直接用原值匹配
    }

    // URL 经过 encodeURIComponent → searchParams → decodeURIComponent 的往返后
    // 百分号编码字符可能已被部分解码。同时尝试编码/解码变体进行模糊匹配。
    const matched = _channels.find(ch => {
      if (ch.url === lookupUrl) return true;
      try { if (decodeURIComponent(ch.url) === lookupUrl) return true; } catch { /* decode failed */ }
      try { if (ch.url === decodeURIComponent(lookupUrl)) return true; } catch { /* decode failed */ }
      try { if (encodeURIComponent(ch.url) === lookupUrl) return true; } catch { /* encode failed */ }
      try { if (ch.url === encodeURIComponent(lookupUrl)) return true; } catch { /* encode failed */ }
      return false;
    });
    const targetUrl = matched ? matched.url : lookupUrl;

    // 使用与 handleChannelSelect / handleChannelChange 一致的代理逻辑构造播放地址
    const { proxyUrl: pUrl, proxyPattern: pPattern } = useIPTVStore.getState().settings;
    const useProxy = shouldProxy(targetUrl, pUrl, pPattern);
    const playUrl = useProxy
      ? `${pUrl}/m3u8-proxy?url=${encodeURIComponent(targetUrl)}`
      : targetUrl;

    setCurrentUrl(playUrl);
    setCurrentType(detectVideoSourceType(targetUrl));

    if (matched) {
      setCurrentChannelId(matched.id);
      setCurrentChannelName(matched.name);
      for (let g = 0; g < groups.length; g++) {
        const chIndex = groups[g].channels.findIndex(ch => ch.id === matched.id);
        if (chIndex >= 0) {
          setTvFocusGroupIndex(g);
          setTvFocusChannelIndex(chIndex);
          break;
        }
      }
    }
  }, [url, _channels, groups, mode, setCurrentChannelId, setCurrentChannelName, setCurrentType, setCurrentUrl, setTvFocusGroupIndex, setTvFocusChannelIndex]);

  const currentUrlRef = useRef(currentUrl);
  currentUrlRef.current = currentUrl;

  const playerCore = usePlayerCore({
    url: mode === 'iptv' ? (currentUrl || url) : url,
    type: (mode === 'iptv' ? currentType : type) as SourceType,
    videoId,
    episodeId,
    decoderMode,
    retryCount,
    onProgress,
    onEnded,
    onPlay,
    onPause,
    onError: useCallback((error: Error) => {
      if (currentUrlRef.current !== currentUrl) return;
      setHasError(true);
      onError?.(error);
    }, [currentUrl, onError]),
  });

  // Audio track polling
  useEffect(() => {
    if (mode !== 'iptv' || currentType !== 'm3u8') return;
    const store = usePlayerStore.getState;
    const check = setInterval(() => {
      const tracks = playerCore.getAudioTracks();
      if (tracks.length > 0 && store().audioTracks.length === 0) {
        store().setAudioTracks(tracks);
        store().setCurrentAudioTrack(playerCore.getCurrentAudioTrack());
      }
    }, 500);
    return () => clearInterval(check);
  }, [mode, currentType, playerCore]);

  // Buffer detection
  useEffect(() => {
    const video = document.querySelector('.up-player-video') as HTMLVideoElement | null;
    if (!video) return;
    const store = usePlayerStore.getState;
    const onWaiting = () => store().setBuffering(true);
    const onPlaying = () => store().setBuffering(false);
    const onCanPlay = () => store().setBuffering(false);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    return () => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [currentUrl]);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (getFullscreenElement()) {
        exitFullscreen();
      } else {
        requestFullscreen(el);
      }
    } catch {
      // 部分平台不支持全屏 API，静默失败
    }
  }, []);

  const handlePlayerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.up-control-bar') || target.closest('.up-player-header') || target.closest('.up-channel-list-overlay') || target.closest('.iptv-osd-bar') || target.closest('.iptv-volume-popup')) {
      return;
    }

    if (mode === 'iptv') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isLeftArea = clickX < rect.width * 0.15;

      if (isLeftArea) {
        setChannelListVisible(true);
        return;
      }
      showControls();
      return;
    }

    if (hasLongPressedRef.current) {
      hasLongPressedRef.current = false;
      return;
    }

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleToggleFullscreen();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const { isPlaying: playing } = usePlayerStore.getState();
        if (!playing) {
          playerCore.togglePlay();
          return;
        }
        if (isControlsVisible) {
          playerCore.togglePlay();
        } else {
          showControls();
        }
      }, 250);
    }
  }, [mode, playerCore, showControls, isControlsVisible, setChannelListVisible, handleToggleFullscreen, hasLongPressedRef]);

  const handleRetry = useCallback(() => {
    const now = Date.now();
    if (now - lastRetryRef.current < 1000) return;
    lastRetryRef.current = now;
    setHasError(false);
    setRetryCount(prev => prev + 1);
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

  // Channel list visibility
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

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      if (volumePopupTimerRef.current) {
        clearTimeout(volumePopupTimerRef.current);
      }
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, [autoHideTimerRef]);

  // Error state management
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

  // Error recovery
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  return (
    <div
      ref={containerRef}
      className={`up-universal-player up-platform-${platform} up-mode-${mode}`}
      tabIndex={-1}
    >
      <PlayerCore
        key={`player-core-${retryCount}`}
        videoRef={playerCore.videoRef}
        mode={mode}
        isLoading={false}
        hasError={hasError}
        onRetry={handleRetry}
        onClick={handlePlayerClick}
        onDoubleClick={handleToggleFullscreen}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onOpenChannelList={() => setChannelListVisible(true)}
      />

      {seekIndicator && (
        <div className={`up-seek-indicator up-seek-indicator-${seekIndicator}`}>
          {seekIndicator === 'left' ? <Rewind size={32} /> : <FastForward size={32} />}
          <span>6s</span>
        </div>
      )}

      {isBuffering && !hasError && (
        <div className="up-iptv-buffering-overlay">
          <div className="up-iptv-buffering-spinner" />
          <span className="up-iptv-buffering-text">{networkSpeed}</span>
        </div>
      )}

      <PlayerHeader
        mode={mode}
        title={title}
        channelName={currentChannelName || channelName}
        visible={isControlsVisible}
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
          volume={volume}
          channelNumber={channelNumber}
          currentSourceIndex={0}
          totalSources={mode === 'iptv' ? iptvSourceCount : sources.length}
          containerWidth={containerWidth}
          audioTracks={audioTracks}
          currentAudioTrack={currentAudioTrack}
          onToggleChannelList={() => setChannelListVisible(true)}
          onSourceSwitch={(index) => handleSourceSwitch(index, mode, currentChannel, _channels, sources)}
          onChannelUp={() => handleChannelUp(groups)}
          onChannelDown={() => handleChannelDown(groups)}
          onOpenSettings={() => {}}
          onOpenResolution={() => {}}
          onOpenAudioTrack={handleAudioTrackSelect}
          onHeightChange={() => {}}
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
          getCurrentTime={playerCore.getCurrentTime}
          getDuration={playerCore.getDuration}
          slots={controlBarSlots}
          onActivity={resetAutoHideTimer}
          onRefresh={handleRetry}
          onScreenshot={handleScreenshot}
          levels={levels}
          currentLevel={currentLevel}
          onLevelChange={playerCore.switchLevel}
          activePopover={activePopover}
          onPopoverChange={setActivePopover}
        />
      )}

      {mode === 'iptv' && (
        <VolumePopup
          visible={showVolumePopup}
          volume={volume}
          onVolumeChange={playerCore.setVolume}
        />
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
  );
}
