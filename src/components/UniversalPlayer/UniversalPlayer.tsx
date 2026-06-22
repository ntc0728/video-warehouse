import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePlayerStore, useSubtitleStore, useIPTVStore } from '@/stores';
import { useNetworkSpeed } from '@/hooks';
import { usePlayerCore } from './hooks/usePlayerCore';
import { useTVRemote } from './hooks/useTVRemote';
import { useSettingsStore } from '@/stores';
import { shouldProxy } from '@/services/iptvService';
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
import type { ChannelProgramInfo } from '@/services/epgService';

function getAutoHideDelay(): number {
  return 3000;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
  const lastRetryRef = useRef(0);
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
  const [seekIndicator, setSeekIndicator] = useState<'left' | 'right' | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerDownTimeRef = useRef(0);
  const pointerDownXRef = useRef(0);
  const hasLongPressedRef = useRef(false);

  const {
    decoderMode, isControlsVisible, isChannelListVisible,
    setControlsVisible, setChannelListVisible,
    setMode, setPlatform, sources,
    setDecoderMode, setSource, setSubtitleUrl,
    levels, currentLevel,
    isPlaying, audioTracks, currentAudioTrack, isBuffering,
  } = usePlayerStore();

  const { autoTranslate, translationAppId, translationApiKey, targetLang } = useSubtitleStore();
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
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

  /** EPG 数据加载：进入 IPTV 播放器时从缓存获取节目表，缓存为空时自动拉取 */
  useEffect(() => {
    if (mode !== 'iptv' || _channels.length === 0) return;
    let cancelled = false;

    const loadEPG = async () => {
      try {
        const { getCachedEPGData, fetchAndParseEPG, matchAllChannels } = await import('@/services/epgService');
        let epgData = await getCachedEPGData();
        if (cancelled) return;

        // 缓存为空时自动拉取
        if (!epgData || epgData.channels.length === 0) {
          try {
            epgData = await fetchAndParseEPG();
          } catch {
            // 拉取失败不影响播放
          }
        }
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

  const currentUrlRef = useRef(currentUrl);
  currentUrlRef.current = currentUrl;

  const playerCore = usePlayerCore({
    url: currentUrl,
    type: currentType,
    videoId,
    episodeId,
    decoderMode,
    retryCount,
    onProgress,
    onEnded,
    onPlay,
    onPause,
    onError: useCallback((error: Error) => {
      // 忽略旧流的错误事件
      if (currentUrlRef.current !== currentUrl) return;
      setHasError(true);
      onError?.(error);
    }, [currentUrl, onError]),
  });

  /** 轮询音轨列表：HLS manifest 解析后 audioTracks 会逐步填充 */
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

  /** 缓冲检测：监听 video waiting/playing/canplay 事件，适用于所有模式 */
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

  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    const { isPlaying: playing } = usePlayerStore.getState();
    if (!playing || activePopover) return;
    const delay = getAutoHideDelay();
    autoHideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, delay);
  }, [setControlsVisible, activePopover]);

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
    setActivePopover(null);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, [setControlsVisible]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    setSeekIndicator(null);
  }, []);

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
  }, [mode, playerCore, showControls, isControlsVisible, setChannelListVisible, handleToggleFullscreen]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.up-control-bar') || target.closest('.up-player-header') || target.closest('.up-channel-list-overlay') || target.closest('.iptv-osd-bar') || target.closest('.iptv-volume-popup')) {
      return;
    }

    pointerDownTimeRef.current = Date.now();
    pointerDownXRef.current = e.clientX;
    hasLongPressedRef.current = false;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const isLeftSide = relX < rect.width * 0.4;
    const isRightSide = relX > rect.width * 0.6;

    if (!isLeftSide && !isRightSide) return;

    longPressTimerRef.current = setTimeout(() => {
      hasLongPressedRef.current = true;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      const direction = isLeftSide ? 'left' : 'right';
      setSeekIndicator(direction);
      const doSeek = () => {
        const video = document.querySelector('.up-player-video') as HTMLVideoElement | null;
        if (!video) return;
        const seekAmount = direction === 'left' ? -6 : 6;
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seekAmount));
      };
      doSeek();
      seekIntervalRef.current = setInterval(doSeek, 500);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

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
    const now = Date.now();
    if (now - lastRetryRef.current < 1000) return;
    lastRetryRef.current = now;
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
    setHasError(false);
    setCurrentChannelId(channel.id);
    setCurrentChannelName(channel.name);
    const useProxy = shouldProxy(channel.url, proxyUrl, proxyPattern);
    const playUrl = useProxy
      ? `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(channel.url)}`
      : channel.url;
    setCurrentUrl(playUrl);
    setChannelListVisible(false);
    onChannelChange?.(channel);
  }, [setChannelListVisible, onChannelChange, proxyUrl, proxyPattern]);

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
    // IPTV 模式：多源切换，找同名频道的下一个源
    if (mode === 'iptv' && currentChannel) {
      const sameNameChannels = _channels.filter(
        ch => ch.name === currentChannel.name && ch.sourceId !== currentChannel.sourceId
      );
      if (sameNameChannels.length === 0) return;
      const nextChannel = sameNameChannels[index % sameNameChannels.length];
      if (nextChannel) {
        const useProxy = shouldProxy(nextChannel.url, proxyUrl, proxyPattern);
        const playUrl = useProxy
          ? `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(nextChannel.url)}`
          : nextChannel.url;
        setCurrentUrl(playUrl);
        setCurrentChannelId(nextChannel.id);
        setCurrentChannelName(nextChannel.name);
        onChannelChange?.(nextChannel);
      }
      return;
    }
    // 非 IPTV 模式：原有逻辑
    const source = sources[index];
    if (source) {
      setCurrentUrl(source.url);
      setCurrentType(source.type);
      setSource(source.url, source.type);
    }
  }, [mode, currentChannel, _channels, sources, setSource, proxyUrl, proxyPattern, onChannelChange]);

  const handleAudioTrackSelect = useCallback(() => {
    const tracks = usePlayerStore.getState().audioTracks;
    const current = usePlayerStore.getState().currentAudioTrack;
    if (tracks.length <= 1) return;
    const nextIndex = tracks.findIndex(t => t.id === current) + 1;
    const nextTrack = tracks[nextIndex % tracks.length];
    playerCore.setCurrentAudioTrack(nextTrack.id);
    usePlayerStore.getState().setCurrentAudioTrack(nextTrack.id);
  }, [playerCore]);

  /** IPTV 多源：当前频道在其他源中的可用线路数 */
  const iptvSourceCount = useMemo(() => {
    if (mode !== 'iptv' || !currentChannel) return 0;
    return _channels.filter(
      ch => ch.name === currentChannel.name && ch.sourceId !== currentChannel.sourceId
    ).length;
  }, [mode, currentChannel, _channels]);

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
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, []);

  /**
   * 错误态下强制显示 OSD 且禁用自动隐藏。
   * - hasError: false → true：立即唤起 OSD，清空自动隐藏计时器
   * - hasError: true → false（重试 / 切频道成功）：恢复 3 秒自动隐藏
   */
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

  /** IPTV 模式：加载超时（HLS 自动重试不会触发 onError，需主动超时）
   *  用 ref 防抖：只在 URL 变化时重置计时器，忽略 isPlaying 波动 */
  useEffect(() => {
    if (mode !== 'iptv' || !currentUrl) return;

    // URL 变化时清除旧错误状态
    setHasError(false);

    // 清除上一次计时器
    clearTimeout(iptvTimeoutRef.current);

    // 启动新计时器：iOS 原生 HLS 启动链路较长，给予 30s；其余平台 15s
    iptvTimeoutRef.current = setTimeout(() => {
      // 通过 store 读取最新状态，避免闭包过期
      const state = usePlayerStore.getState();
      if (!state.isPlaying) {
        setHasError(true);
      }
    }, isIOS() ? 20000 : 15000);

    return () => clearTimeout(iptvTimeoutRef.current);
  }, [mode, currentUrl]);
  // 仅依赖 mode 和 currentUrl，URL 不变时计时器不重置

  /** 错误恢复清除：播放成功恢复时自动清除错误状态 */
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

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
          onSourceSwitch={handleSourceSwitch}
          onChannelUp={handleChannelUp}
          onChannelDown={handleChannelDown}
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