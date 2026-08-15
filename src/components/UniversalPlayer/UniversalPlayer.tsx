import { useState, useCallback, useRef, useEffect, useMemo, Component, type ReactNode } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { toast } from '@/components/ui';
import { useNetworkSpeed, useNetworkQuality } from '@/hooks';
import { buildProxyUrl } from '@/services/iptvService';
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
import type { EPGProgram, ParsedEPGData } from '@/services/epgService';
import { Rewind, FastForward, X } from 'lucide-react';
import { PlayerContext } from './context/PlayerContext';
import { useIPTVChannelInit, usePlayerClickHandler, useBufferMonitor } from './modules';
import { resolveChannelLogoCandidates } from '@/services/channelLogo';
import type { UniversalPlayerProps } from '@/types/player';
import type { IPTVChannel } from '@/types/iptv';
import type { SourceType } from '@/types/video';
import { ERROR_CODE_BARE_STREAM } from './adapters/HLSAdapter';
import { Icon } from "@/components/ui/Icon";
import { isNativePlatform } from '@/lib/platform';
import { useIsMobileLayout, useIsRealPhone } from '@/hooks/useMediaQuery';
import HeaderActions from './MobileUI/HeaderActions';
import MobileMoreSheet from './MobileUI/MobileMoreSheet';
import SubtitleSettingsModal from './MobileUI/SubtitleSettingsModal';
import CastSheet from './MobileUI/CastSheet';

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
  seasonNumber,
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
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [showProgramGuide, setShowProgramGuide] = useState(false);
  const [programGuideData, setProgramGuideData] = useState<EPGProgram[]>([]);
  const [programGuideChannelName, setProgramGuideChannelName] = useState('');
  const [timeshiftSupported, setTimeshiftSupported] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [playClickAnim, setPlayClickAnim] = useState(false);
  // D1 裸流降级：HLS 解析失败（非 HLS 清单）时临时覆盖播放器类型为 flv，
  // 复用同一 URL 重建 mpegts.js 重试（URL 变化时复位）
  const [degradedType, setDegradedType] = useState<SourceType | null>(null);
  // 移动端布局判定（app 端恒真）：移动端/App 端点播页走「精简控制栏 + 右上角操作组 + 底部弹窗」布局
  const isMobileLayout = useIsMobileLayout();
  // 操作类提示的「移动端居中」仅针对真实移动设备（App / 真实手机 UA）：
  // 桌面浏览器窄窗（视口 <768 但非移动设备）仍走右上角 .up-player-toast（与桌面一致）。
  const isMobileDevice = isNativePlatform() || useIsRealPhone();
  // 头部是否真正有操作控件（桌面端 = IPTV 全屏按钮；移动端点播 = 画中画/投屏/更多设置）。
  // 用于桌面 toast 锚点：有控件 → 锚在控件下方避让；无控件 → 紧贴右上角。
  // CSS 无法感知按钮渲染状态，必须 JS 判定后写全局标记（与 data-mobile-layout 同模式）。
  const hasHeaderRightControls = showHeaderFullscreen || (isMobileLayout && mode === 'video');
  // 头部全屏按钮仅 IPTV 播放页非 TV 端渲染，且被 CSS 移到右下角
  // （.iptv-player-page .up-header-fullscreen-btn position:fixed bottom-right）；
  // 头部右上角从不渲染控件 → 桌面操作类提示紧贴右上角（.up-player-toast top: space-lg）。
  const showHeaderFullscreen = mode === 'iptv' && platform !== 'tv' && !isNativePlatform();
  // 移动端弹窗状态
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [castSheetOpen, setCastSheetOpen] = useState(false);
  const [subtitleSheetOpen, setSubtitleSheetOpen] = useState(false);
  // 定时关闭（分钟；0 = 关闭）
  const [sleepMinutes, setSleepMinutes] = useState(0);
  // 投屏激活状态（右上角图标常亮提示）
  const [castActive, setCastActive] = useState(false);

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
  const { epgReady, epgProgramsRef, epgStatus, epgError, epgChannels } = useEPGData({ mode, channels: _channels });

  // toast 位置：播放器页面 → 中间靠上（body 标记驱动全局 CSS 重定位 sonner）
  useEffect(() => {
    document.body.dataset.playerToast = 'active';
    return () => {
      delete document.body.dataset.playerToast;
    };
  }, []);

  // 桌面端 toast 定位几何：把全局 sonner（错误/警告类）约束到播放器内水平居中 + 贴近上边框
  // （header 之下），并给操作类提示提供「头部右控件下方」锚点。
  // 因 sonner 是 fixed 视口容器，必须用 JS 测量播放器矩形写 CSS 变量才能相对播放器居中。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const header = el.querySelector<HTMLElement>('.up-player-header');
    const updateVars = () => {
      const rect = el.getBoundingClientRect();
      const headerH = header?.getBoundingClientRect().height ?? 0;
      const root = document.documentElement;
      root.style.setProperty('--player-toast-left', `${rect.left}px`);
      root.style.setProperty('--player-toast-width', `${rect.width}px`);
      // sonner top = 播放器顶 + header 高（贴近上边框、不遮 header）
      root.style.setProperty('--player-toast-top', `${rect.top + headerH}px`);
      root.style.setProperty('--player-header-height', `${headerH}px`);
    };
    updateVars();
    const ro = new ResizeObserver(updateVars);
    ro.observe(el);
    if (header) ro.observe(header);
    window.addEventListener('scroll', updateVars, true);
    window.addEventListener('resize', updateVars);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', updateVars, true);
      window.removeEventListener('resize', updateVars);
    };
  }, []);

  // EPG 加载失败时显示 toast
  useEffect(() => {
    if (epgStatus === 'error' && epgError && mode === 'iptv') {
      toast.show({ content: `EPG: ${epgError}`, type: 'error' });
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

  // 当前频道台标候选链（三级回退）：M3U tvg-logo → EPG icon → 在线台标库
  const channelLogoCandidates = useMemo(
    () => (currentChannel ? resolveChannelLogoCandidates(currentChannel, epgChannels, proxyUrl) : []),
    [currentChannel, epgChannels, proxyUrl]
  );

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

  const currentUrlRef = useRef(currentUrl);
  currentUrlRef.current = currentUrl;

  // A3 播放失败自动切代理：每 URL 最多重试一次（防死循环）
  const proxyRetriedRef = useRef(false);

  // C1 自动切线路：仅含音频时按「频道名」每频道最多自动切 1 次线路（防线路间死循环）。
  // /iptv/play 为独立全屏路由，离开页面即卸载组件，标记随之失效，无需手动清理。
  const audioOnlyLineSwitchedRef = useRef<Set<string>>(new Set());
  const currentChannelRef = useRef(currentChannel);
  currentChannelRef.current = currentChannel;
  const channelsRef = useRef(_channels);
  channelsRef.current = _channels;
  const handleSourceSwitchRef = useRef(handleSourceSwitch);
  handleSourceSwitchRef.current = handleSourceSwitch;

  // D1 裸流降级标记：每 URL 仅降级 1 次（mpegts.js 也失败则走 C1 切线路 / A3 切代理）
  const bareStreamRetriedRef = useRef<Set<string>>(new Set());

const playerCore = usePlayerCore({
url: mode === 'iptv' ? (currentUrl || url) : url,
type: (mode === 'iptv' ? (degradedType ?? currentType ?? type) : type) as SourceType,
videoId,
vodId,
episodeUrl,
cmsSourceId,
episodeLabel,
seasonNumber,
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
      // C1 视频轨检测：仅含音频的源（manifest 无视频轨）——音频可能已开始播放，
      // 无论播放状态都走 toast（不触发全屏错误）。
      // IPTV 模式自动切线路：存在同名其它线路（sourceId 不同）时自动切到第一条其它线路，
      // 每频道名仅自动切 1 次防线路间死循环；无其它线路或已切过则仅 toast 提示
      if (error.message.includes('仅含音频')) {
        // 已确认源可播放音频（无视频轨）：停止加载动画，避免 spinner 一直转
        usePlayerStore.getState().setPlayerLoading(false);
        const channel = currentChannelRef.current;
        if (mode === 'iptv' && channel) {
          const sameNameChannels = channelsRef.current.filter(
            ch => ch.name === channel.name && ch.sourceId !== channel.sourceId
          );
          if (sameNameChannels.length > 0 && !audioOnlyLineSwitchedRef.current.has(channel.name)) {
            audioOnlyLineSwitchedRef.current.add(channel.name);
            handleSourceSwitchRef.current(0, mode, channel, channelsRef.current, usePlayerStore.getState().sources, {
              content: '该源仅含音频，已自动切换线路…',
              type: 'warning',
            });
            return;
          }
        }
        toast.show({ content: error.message, type: 'error' });
        onError?.(error);
        return;
      }
      // D1 裸流降级：HLS 解析失败（manifestParsingError → BARE_STREAM）说明内容非 HLS 清单，
      // 极可能是裸 TS/FLV 流。降级到 mpegts.js 重试同一 URL（每 URL 仅 1 次防循环，
      // 再次失败则走下方 C1 切线路 / A3 切代理）。worker 端 m3u8-proxy 已支持裸流透传，
      // 因此代理 URL 无需改写即可被 mpegts.js 拉流。
      if ((error as Error & { code?: string }).code === ERROR_CODE_BARE_STREAM && mode === 'iptv') {
        // 已确认内容是裸流（将降级 mpegts.js）：停止加载动画，避免 spinner 一直转
        usePlayerStore.getState().setPlayerLoading(false);
        if (!bareStreamRetriedRef.current.has(currentUrl)) {
          bareStreamRetriedRef.current.add(currentUrl);
          setDegradedType('flv');
          toast.show({ content: '检测到裸流，切换解码方式重试…', type: 'warning' });
          return;
        }
      }
      // A3 播放中失败自动切代理：直连播放时网络类错误（CORS 分片失败/源站不可达）
      // → 若当前 URL 不是代理地址且有可用代理，自动切换重试（每 URL 仅 1 次，防循环）
      if (mode === 'iptv' && proxyUrl && !currentUrl.includes('/m3u8-proxy') && !currentUrl.includes('/ts-proxy')) {
        if (!proxyRetriedRef.current) {
          proxyRetriedRef.current = true;
          const proxied = buildProxyUrl(currentUrl, proxyUrl);
          toast.show({ content: '直连失败，自动切换代理播放…', type: 'warning' });
          setCurrentUrl(proxied);
          return;
        }
      }
      // If video is already playing (e.g. audio works but video decode fails),
      // show non-blocking toast instead of the full error overlay
      if (videoElementRef.current && !videoElementRef.current.paused) {
        toast.show({ content: error.message, type: 'error' });
        return;
      }
      setHasError(true);
      onError?.(error);
    }, [currentUrl, onError, mode, proxyUrl, buildProxyUrl, setCurrentUrl]),
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
    mode,
    isChannelListVisible,
    playerCore: { togglePlay: () => playerCore.togglePlay(), setVolume: (v) => playerCore.setVolume(v) },
    groups,
    onChannelSelect: handleChannelSelect,
    onToggleChannelList: () => setChannelListVisible(!isChannelListVisible),
    // TV 遥控器音量调节弹音量柱
    showVolumePopup: showVolumePopupWithTimer,
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

    // 先弹窗（内容区加载中），避免阻塞等待 EPG 网络请求导致"弹窗显示很慢"
    setShowProgramGuide(true);
    showControls();

    try {
      const {
        getCachedEPGData, fetchAndParseEPG,
        getChannelProgramsWithStatus: getProgs, matchEPGChannel,
      } = await import('@/services/epgService');
      const currentCh = _channels.find(c => c.id === currentChannelId);

      const applyEPG = (epgData: ParsedEPGData) => {
        const matchedChannel = currentCh
          ? matchEPGChannel(currentCh.name, currentCh.tvgId, epgData.channels)
          : null;
        const matchedId = matchedChannel?.id || currentChannelId;
        if (matchedId) setProgramGuideData(getProgs(matchedId, epgData));
      };

      // 1) 缓存优先：先渲染已有节目单（无网络请求，弹窗立即可见）
      const cached = await getCachedEPGData();
      if (cached.channels.length > 0) applyEPG(cached);
      // 2) 后台刷新：请求合并（重复点击共享一次网络拉取）；失败静默保留缓存
      const fresh = await fetchAndParseEPG();
      applyEPG(fresh);
    } catch {
      // 保留缓存结果；无缓存则节目单为空
    }
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
  const isPiP = usePlayerStore(s => s.isPiP);
  const networkSpeed = useNetworkSpeed();
  const networkQuality = useNetworkQuality();
  // 当前播放流类型（HLS 时显示清晰度卡）；与 useIPTVNavigation 的 currentType 区分命名
  const streamType = usePlayerStore(s => s.currentType);
  const isHls = streamType === 'm3u8';

  // 移动端更多设置：字幕 / 后台听视频 / 字幕样式（store 运行时字段）
  const subtitleEnabled = usePlayerStore(s => s.subtitleEnabled);
  const setSubtitleEnabled = usePlayerStore(s => s.setSubtitleEnabled);
  const backgroundPlay = usePlayerStore(s => s.backgroundPlay);
  const setBackgroundPlay = usePlayerStore(s => s.setBackgroundPlay);
  const subtitleSettings = usePlayerStore(s => s.subtitleSettings);
  const updateSubtitleSettings = usePlayerStore(s => s.updateSubtitleSettings);
  const mirror = usePlayerStore(s => s.mirror);
  const setMirror = usePlayerStore(s => s.setMirror);
  const aspectRatio = usePlayerStore(s => s.aspectRatio);
  const setAspectRatio = usePlayerStore(s => s.setAspectRatio);
  const playbackRate = usePlayerStore(s => s.playbackRate);
  const loopMode = usePlayerStore(s => s.loopMode);
  const playerProgress = usePlayerStore(s => s.progress);
  const playerDuration = usePlayerStore(s => s.duration);

  // 字幕翻译设置（双语 / 目标语言）
  const {
    autoTranslate, setAutoTranslate, targetLang, setTargetLang,
    translationAppId, translationApiKey,
  } = useSettingsStore();
  const translationConfigured = Boolean(translationAppId && translationApiKey);
  // 字幕大字号开关 = 字号 >= 40
  const subtitleBigFont = subtitleSettings.fontSize >= 40;

  // 定时关闭：到时暂停播放（睡眠定时器，0 = 关闭）。
  // playerCore 对象每次渲染重建（内部 callback 稳定），用 ref 避免定时器随渲染重置。
  const playerCoreRef = useRef(playerCore);
  playerCoreRef.current = playerCore;
  useEffect(() => {
    if (sleepMinutes <= 0) return;
    const timer = setTimeout(() => {
      playerCoreRef.current.pause();
      setSleepMinutes(0);
      toast.show({ content: '定时关闭：已暂停播放', type: 'success' });
    }, sleepMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [sleepMinutes]);

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

  // URL 或频道变化时重置错误状态与代理重试标记
  useEffect(() => {
    setHasError(false);
    proxyRetriedRef.current = false;
    // D1：切换频道/URL 时复位裸流降级状态（新 URL 是全新 key，天然独立计数）
    setDegradedType(null);
  }, [url, currentUrl]);

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
    <ToastProvider mobileCenter={isMobileDevice}>
    <ToastTrigger mode={mode} />
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

      {/* 预加载完成待播放 / 暂停状态显示播放按钮（IPTV 直播加载即播，不显示中间播放按钮）。
          !isPlayerLoading：切源/加载失败前 isReadyToPlay 残留 true 时禁止闪现播放图标 */}
      {isReadyToPlay && !isPlaying && !hasError && !isBuffering && !isPlayerLoading && mode !== 'iptv' && (
        <div
          className="up-player-paused-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPlayClickAnim(true);
            setTimeout(() => {
              setPlayClickAnim(false);
              // 用 togglePlay（而非 play）：togglePlay 会设置 userPlayRequested 标记，
              // ToastTrigger 据此显示「播放」提示；直接 play() 不设标记、
              // 且 autoPlayToastShownRef 已被首次自动播放置真 → 手动续播无提示（历史回归点）
              playerCore.togglePlay();
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
          {seekIndicator === 'left' ? <Icon icon={Rewind} size="2xl" /> : <Icon icon={FastForward} size="2xl" />}
          <span>6s</span>
        </div>
      )}

      <PlayerHeader
        mode={mode}
        title={title}
        episodeLabel={episodeLabel}
        channelName={currentChannelName || channelName}
        visible={isControlsVisible || hasError}
        /* TV 端 IPTV 播放页默认全屏，不显示放大图标；非 TV 端放大图标移至右下角（CSS）。
           9.1：app 端播放页已全屏铺满（且进入即锁定横屏），不再显示全屏按钮 */
        showFullscreenButton={showHeaderFullscreen}
        containerRef={containerRef as React.RefObject<HTMLElement>}
        onBack={() => onBack?.()}
        onActivity={resetAutoHideTimer}
        actions={
          isMobileLayout && mode === 'video' ? (
            <HeaderActions
              isPiP={isPiP}
              onTogglePiP={playerCore.togglePiP}
              castActive={castActive}
              onCastClick={() => setCastSheetOpen(true)}
              onMoreClick={() => setMoreSheetOpen(true)}
            />
          ) : undefined
        }
      />

      {mode === 'iptv' ? (
        <IPTVOSDBar
          visible={isControlsVisible}
          hasError={hasError}
          channelName={currentChannelName || channelName || ''}
          channelLogo={channelLogoCandidates[0] ?? ''}
          channelLogoCandidates={channelLogoCandidates}
          currentProgram={channelProgram?.current ?? currentChannel?.currentProgram}
          nextProgram={channelProgram?.next ?? currentChannel?.nextProgram}
          channelNumber={channelNumber}
          currentSourceIndex={0}
          totalSources={mode === 'iptv' ? iptvSourceCount : sources.length}
          audioTracks={audioTracks}
          onToggleChannelList={() => setChannelListVisible(true)}
          onSourceSwitch={(index) => handleSourceSwitch(index, mode, currentChannel, _channels, sources)}
          onOpenAudioTrack={handleAudioTrackSelect}
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
          isMobile={isMobileLayout}
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

      {/* 移动端/App 端：控制栏隐藏时在播放器底部边缘展示细播放进度线（桌面端不渲染） */}
      {isMobileLayout && mode === 'video' && (
        <div
          className={`up-mobile-progress-edge${!isControlsVisible ? ' up-mobile-progress-edge-visible' : ''}`}
          aria-hidden="true"
        >
          <div
            className="up-mobile-progress-edge__inner"
            style={{ width: `${playerDuration > 0 && Number.isFinite(playerDuration) ? Math.min(100, (playerProgress / playerDuration) * 100) : 0}%` }}
          />
        </div>
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
                <Icon icon={X} size="sm" />
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

      {/* 移动端/App 端点播页：右上角操作组对应的底部弹窗（更多设置 / 投屏 / 字幕二级弹窗） */}
      {isMobileLayout && mode === 'video' && (
        <>
          <MobileMoreSheet
            visible={moreSheetOpen}
            onClose={() => setMoreSheetOpen(false)}
            currentRate={playbackRate}
            onPlaybackRateChange={playerCore.setPlaybackRate}
            loopMode={loopMode}
            onLoopModeChange={setLoopMode}
            levels={levels}
            currentLevel={currentLevel}
            onLevelChange={playerCore.switchLevel}
            isHls={isHls}
            sleepMinutes={sleepMinutes}
            onSleepChange={setSleepMinutes}
            backgroundPlay={backgroundPlay}
            onBackgroundPlayChange={setBackgroundPlay}
            subtitleEnabled={subtitleEnabled}
            onSubtitleToggle={setSubtitleEnabled}
            onOpenSubtitleSettings={() => {
              setMoreSheetOpen(false);
              setSubtitleSheetOpen(true);
            }}
            onImportSubtitle={(file) => handleImportSubtitle(file)}
            mirror={mirror}
            onMirrorToggle={setMirror}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
          />
          <CastSheet
            visible={castSheetOpen}
            onClose={() => setCastSheetOpen(false)}
            url={url}
            title={title}
            onCastActiveChange={setCastActive}
          />
          <SubtitleSettingsModal
            visible={subtitleSheetOpen}
            onClose={() => setSubtitleSheetOpen(false)}
            autoTranslate={autoTranslate}
            onAutoTranslateChange={setAutoTranslate}
            bigFont={subtitleBigFont}
            onBigFontChange={(on) => updateSubtitleSettings({ fontSize: on ? 40 : 24 })}
            targetLang={targetLang}
            onTargetLangChange={setTargetLang}
            translationConfigured={translationConfigured}
          />
        </>
      )}
    </div>
    </PlayerContext.Provider>
    </PlayerErrorBoundary>
    </ToastProvider>
  );
}
