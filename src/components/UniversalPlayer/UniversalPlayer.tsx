import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LoaderCircle } from 'lucide-react';
import { usePlayerStore, useSubtitleStore } from '@/stores';
import { useNetworkSpeed } from '@/hooks';
import { usePlayerCore } from './hooks/usePlayerCore';
import { useTVRemote } from './hooks/useTVRemote';
import { useSettingsStore } from '@/stores';
import PlayerCore from './PlayerCore';
import './UniversalPlayer.css';
import PlayerHeader from './PlayerHeader';
import { ControlBar } from './ControlBar';
import { IPTVChannelList } from './IPTVChannelList';
import { IPTVOSDBar, VolumePopup } from './IPTVOSDBar';
import type { UniversalPlayerProps } from '@/types/player';
import type { IPTVChannel } from '@/types/iptv';
import type { ChannelProgramInfo } from '@/services/epgService';

function getAutoHideDelay(): number {
  return 3000;
}

const VOLUME_POPUP_DELAY = 3000;

function srtToVtt(srt: string): string {
  let vtt = 'WEBVTT\n\n';
  const blocks = srt.trim().replace(/\r\n/g, '\n').split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1].replace(/,/g, '.');
      const text = lines.slice(2).join('\n');
      vtt += `${timeLine}\n${text}\n\n`;
    }
  }
  return vtt;
}

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
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumePopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const digitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const iptvTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentChannelId, setCurrentChannelId] = useState<string | undefined>(undefined);
  const [currentChannelName, setCurrentChannelName] = useState<string | undefined>(undefined);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [currentType, setCurrentType] = useState(type);
  const [digitBuffer, setDigitBuffer] = useState('');
  const [tvFocusGroupIndex, setTvFocusGroupIndex] = useState(0);
  const [tvFocusChannelIndex, setTvFocusChannelIndex] = useState(0);
  const [tvFocusSection, setTvFocusSection] = useState<'groups' | 'channels'>('groups');
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [epgReady, setEpgReady] = useState(false);
  const epgProgramsRef = useRef<Map<string, ChannelProgramInfo>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [isChannelLoading, setIsChannelLoading] = useState(false);

  const {
    decoderMode, isControlsVisible, isChannelListVisible,
    setControlsVisible, setChannelListVisible,
    setMode, setPlatform, sources,
    setDecoderMode, setSource, setSubtitleUrl,
    levels, currentLevel, setLoopMode,
    isPlaying,
  } = usePlayerStore();

  const { autoTranslate, translationAppId, translationApiKey, targetLang } = useSubtitleStore();
  const currentChannel = useMemo(() => {
    if (mode !== 'iptv' || !currentChannelId) return undefined;
    return _channels.find(ch => ch.id === currentChannelId);
  }, [mode, currentChannelId, _channels]);

  useEffect(() => { setMode(mode); }, [mode, setMode]);
  useEffect(() => { setPlatform(platform); }, [platform, setPlatform]);
  useEffect(() => { setSource(url, type); }, [url, type, setSource]);

  useEffect(() => {
    const { rememberVolume } = useSettingsStore.getState();
    if (!rememberVolume) {
      usePlayerStore.getState().setVolume(1);
    }
  }, []);

  /** 通过 ResizeObserver 实时追踪播放器容器的实际宽度，确保 OSD 控制栏宽度始终与容器保持同步 */
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

  /** 进入 IPTV 播放器时通过 URL 匹配当前频道，初始化频道 ID、名称及 TV 焦点索引 */
  useEffect(() => {
    if (mode !== 'iptv' || !url || _channels.length === 0) return;
    const matched = _channels.find(ch => ch.url === url);
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
  }, [url, _channels, groups, mode]);

  /** EPG 数据加载：进入 IPTV 播放器时异步获取节目表，匹配所有频道 */
  useEffect(() => {
    if (mode !== 'iptv' || _channels.length === 0) return;
    let cancelled = false;

    const loadEPG = async () => {
      try {
        const { fetchAndParseEPG, matchAllChannels } = await import('@/services/epgService');
        const epgData = await fetchAndParseEPG();
        if (cancelled) return;

        const programs = matchAllChannels(_channels, epgData);
        epgProgramsRef.current = programs;
        setEpgReady(true);
      } catch {
        if (!cancelled) {
          setEpgReady(true);
        }
      }
    };

    loadEPG();
    return () => { cancelled = true; };
  }, [mode, _channels]);

  const playerCore = usePlayerCore({
    url: currentUrl,
    type: currentType,
    videoId,
    episodeId,
    decoderMode,
    onProgress,
    onEnded,
    onPlay,
    onPause,
    onError: useCallback((error: Error) => {
      setHasError(true);
      onError?.(error);
    }, [onError]),
  });

  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    const delay = getAutoHideDelay();
    autoHideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, delay);
  }, [setControlsVisible]);

  const showVolumePopupWithTimer = useCallback(() => {
    setShowVolumePopup(true);
    if (volumePopupTimerRef.current) clearTimeout(volumePopupTimerRef.current);
    volumePopupTimerRef.current = setTimeout(() => {
      setShowVolumePopup(false);
    }, VOLUME_POPUP_DELAY);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    resetAutoHideTimer();
  }, [setControlsVisible, resetAutoHideTimer]);

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, [setControlsVisible]);

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
    }

    if (isControlsVisible) {
      hideControls();
    } else {
      showControls();
    }
  }, [mode, isControlsVisible, showControls, hideControls, setChannelListVisible]);

  useEffect(() => {
    if (platform !== 'tv' || mode !== 'iptv') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChannelListVisible) return;

      const volume = usePlayerStore.getState().volume;

      switch (e.key) {
        case 'F1':
        case 'Info':
          e.preventDefault();
          if (isControlsVisible) {
            hideControls();
          } else {
            showControls();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (isControlsVisible) {
            hideControls();
          } else {
            showControls();
          }
          break;
        case 'ArrowUp':
        case 'VolumeUp':
          e.preventDefault();
          playerCore.setVolume(Math.min(1, volume + 0.1));
          showVolumePopupWithTimer();
          break;
        case 'ArrowDown':
        case 'VolumeDown':
          e.preventDefault();
          playerCore.setVolume(Math.max(0, volume - 0.1));
          showVolumePopupWithTimer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [platform, mode, isChannelListVisible, isControlsVisible, showControls, hideControls, showVolumePopupWithTimer, playerCore]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setRetryCount(prev => prev + 1);
  }, []);

  const handleImportSubtitle = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      let finalText = text;

      if (autoTranslate && translationAppId && translationApiKey) {
        try {
          const { translate } = await import('@/services/translator');
          const blocks = text.trim().replace(/\r\n/g, '\n').split('\n\n');
          const translatedBlocks: string[] = [];

          for (let i = 0; i < blocks.length; i += 10) {
            const batch = blocks.slice(i, i + 10);
            const textsToTranslate = batch.map(b => {
              const lines = b.split('\n');
              return lines.length >= 3 ? lines.slice(2).join('\n') : '';
            }).filter(t => t);

            if (textsToTranslate.length === 0) {
              translatedBlocks.push(...batch);
              continue;
            }

            const combined = textsToTranslate.join('\n');
            const translated = await translate({
              text: combined,
              from: 'auto',
              to: targetLang,
              appId: translationAppId,
              key: translationApiKey,
            });

            const translatedLines = translated.split('\n');
            let transIdx = 0;

            for (const b of batch) {
              const lines = b.split('\n');
              if (lines.length >= 3) {
                const translatedText = translatedLines[transIdx] || lines.slice(2).join('\n');
                lines.push('', translatedText);
                transIdx++;
              }
              translatedBlocks.push(lines.join('\n'));
            }
          }

          finalText = translatedBlocks.join('\n\n');
        } catch (err) {
          console.error('Subtitle translation failed:', err);
        }
      }

      let blob: Blob;
      if (file.name.endsWith('.srt')) {
        const vttContent = srtToVtt(finalText);
        blob = new Blob([vttContent], { type: 'text/vtt' });
      } else {
        blob = new Blob([finalText], { type: 'text/vtt' });
      }

      const blobUrl = URL.createObjectURL(blob);
      setSubtitleUrl(blobUrl);
    };
    reader.readAsText(file);
  }, [autoTranslate, translationAppId, translationApiKey, targetLang, setSubtitleUrl]);

  const handleChannelSelect = useCallback((channel: IPTVChannel) => {
    usePlayerStore.setState({ isPlaying: false });
    setIsChannelLoading(true);
    setHasError(false);
    setCurrentUrl(channel.url);
    setCurrentType('m3u8');
    setCurrentChannelId(channel.id);
    setCurrentChannelName(channel.name);
    setChannelListVisible(false);
    onChannelChange?.(channel);
  }, [setChannelListVisible, onChannelChange]);

  const handleChannelUp = useCallback(() => {
    const allChannels = groups.flatMap(g => g.channels);
    const idx = allChannels.findIndex(ch => ch.id === currentChannelId);
    if (idx > 0) handleChannelSelect(allChannels[idx - 1]);
  }, [groups, currentChannelId, handleChannelSelect]);

  const handleChannelDown = useCallback(() => {
    const allChannels = groups.flatMap(g => g.channels);
    const idx = allChannels.findIndex(ch => ch.id === currentChannelId);
    if (idx < allChannels.length - 1) handleChannelSelect(allChannels[idx + 1]);
  }, [groups, currentChannelId, handleChannelSelect]);

  const handleSourceSwitch = useCallback((index: number) => {
    const source = sources[index];
    if (source) {
      setCurrentUrl(source.url);
      setCurrentType(source.type);
      setSource(source.url, source.type);
    }
  }, [sources, setSource]);

  const handleScreenshot = useCallback(() => {
    const video = document.querySelector('.up-player-video') as HTMLVideoElement | null;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const link = document.createElement('a');
    link.download = `screenshot_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    canvas.remove();
  }, []);

  const handleLoopModeChange = useCallback((newMode: import('@/types/player').LoopMode) => {
    setLoopMode(newMode);
  }, [setLoopMode]);

  const handleToggleChannelList = useCallback(() => {
    setChannelListVisible(!isChannelListVisible);
  }, [isChannelListVisible, setChannelListVisible]);

  const activeGroup = groups[tvFocusGroupIndex];
  const activeChannels = useMemo(() => activeGroup?.channels ?? [], [activeGroup]);

  const handleTvFocusMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (tvFocusSection === 'groups') {
      switch (direction) {
        case 'up':
          setTvFocusGroupIndex(prev => Math.max(0, prev - 1));
          break;
        case 'down':
          setTvFocusGroupIndex(prev => Math.min(groups.length - 1, prev + 1));
          break;
        case 'right':
          setTvFocusSection('channels');
          setTvFocusChannelIndex(0);
          break;
      }
    } else {
      switch (direction) {
        case 'up':
          setTvFocusChannelIndex(prev => Math.max(0, prev - 1));
          break;
        case 'down':
          setTvFocusChannelIndex(prev => Math.min(activeChannels.length - 1, prev + 1));
          break;
        case 'left':
          setTvFocusSection('groups');
          break;
      }
    }
  }, [tvFocusSection, groups.length, activeChannels.length]);

  const handleTvFocusConfirm = useCallback(() => {
    if (tvFocusSection === 'channels' && activeChannels[tvFocusChannelIndex]) {
      handleChannelSelect(activeChannels[tvFocusChannelIndex]);
    }
  }, [tvFocusSection, activeChannels, tvFocusChannelIndex, handleChannelSelect]);

  const handleTvDigitInput = useCallback((digit: number) => {
    clearTimeout(digitTimerRef.current);
    const newBuffer = digitBuffer + String(digit);
    const globalIndex = parseInt(newBuffer, 10) - 1;

    let cumulative = 0;
    for (let g = 0; g < groups.length; g++) {
      const gChannels = groups[g].channels;
      if (globalIndex < cumulative + gChannels.length) {
        const channelIndex = globalIndex - cumulative;
        const channel = gChannels[channelIndex];
        if (channel) {
          setTvFocusGroupIndex(g);
          setTvFocusChannelIndex(channelIndex);
          setTvFocusSection('channels');
          handleChannelSelect(channel);
        }
        break;
      }
      cumulative += gChannels.length;
    }

    setDigitBuffer(newBuffer);
    digitTimerRef.current = setTimeout(() => setDigitBuffer(''), 500);
  }, [digitBuffer, groups, handleChannelSelect]);

  useTVRemote({
    platform,
    isChannelListVisible,
    onTogglePlay: () => playerCore.togglePlay(),
    onBack: () => onBack?.(),
    onVolumeUp: () => {
      playerCore.setVolume(Math.min(1, (usePlayerStore.getState().volume + 0.1)));
      showVolumePopupWithTimer();
    },
    onVolumeDown: () => {
      playerCore.setVolume(Math.max(0, (usePlayerStore.getState().volume - 0.1)));
      showVolumePopupWithTimer();
    },
    onToggleChannelList: handleToggleChannelList,
    onFocusMove: handleTvFocusMove,
    onFocusConfirm: handleTvFocusConfirm,
    onDigitInput: handleTvDigitInput,
  });

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
  }, [isChannelListVisible, hideControls, showControls]);

  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      if (volumePopupTimerRef.current) {
        clearTimeout(volumePopupTimerRef.current);
      }
    };
  }, []);

  /** 监听播放状态和错误状态，关闭频道切换加载指示器 */
  useEffect(() => {
    if (isChannelLoading && (isPlaying || hasError)) {
      setIsChannelLoading(false);
    }
  }, [isPlaying, hasError, isChannelLoading]);

  /** IPTV 模式：加载超时（HLS 自动重试不会触发 onError，需主动超时）
   *  用 ref 防抖：只在 URL 变化时重置计时器，忽略 isPlaying 波动 */
  useEffect(() => {
    if (mode !== 'iptv' || !currentUrl) return;

    // 清除上一次计时器
    clearTimeout(iptvTimeoutRef.current);

    // 启动新计时器：5 秒后若未播放，强制显示错误
    iptvTimeoutRef.current = setTimeout(() => {
      // 通过 store 读取最新状态，避免闭包过期
      const state = usePlayerStore.getState();
      if (!state.isPlaying) {
        setHasError(true);
      }
    }, 5000);

    return () => clearTimeout(iptvTimeoutRef.current);
  }, [mode, currentUrl]);
  // 仅依赖 mode 和 currentUrl，URL 不变时计时器不重置

  const volume = usePlayerStore(s => s.volume);

  const networkSpeed = useNetworkSpeed();

  const channelProgram = useMemo(() => {
    if (!epgReady || !currentChannelId) return undefined;
    return epgProgramsRef.current.get(currentChannelId);
  }, [currentChannelId, epgReady]);

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
      />

      {isChannelLoading && (
        <div className="up-channel-loading-overlay">
          <LoaderCircle size={24} className="up-channel-loading-icon" />
          <div className="up-channel-loading-speed">{hasError ? '--' : networkSpeed}</div>
        </div>
      )}

      <PlayerHeader
        mode={mode}
        title={title}
        channelName={currentChannelName || channelName}
        visible={isControlsVisible}
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
          totalSources={sources.length}
          containerWidth={containerWidth}
          onToggleChannelList={() => setChannelListVisible(true)}
          onSourceSwitch={handleSourceSwitch}
          onChannelUp={handleChannelUp}
          onChannelDown={handleChannelDown}
          onOpenSettings={() => {}}
          onOpenResolution={() => {}}
          onHeightChange={() => {}}
        />
      ) : (
        <ControlBar
          mode={mode}
          platform={platform}
          visible={isControlsVisible}
          containerRef={containerRef as React.RefObject<HTMLElement>}
          sources={sources}
          currentSourceIndex={0}
          onSourceSwitch={handleSourceSwitch}
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
          onLoopModeChange={handleLoopModeChange}
          levels={levels}
          currentLevel={currentLevel}
          onLevelChange={playerCore.switchLevel}
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