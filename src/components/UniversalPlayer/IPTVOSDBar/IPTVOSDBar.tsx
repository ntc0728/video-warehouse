import { useState, useMemo, useEffect, useRef } from 'react';
import { useNetworkSpeed } from '@/hooks';
import { SIZE_VAR, type IconSize } from '@/components/ui/Icon';
import './IPTVOSDBar.css';

interface ProgramInfo {
  title: string;
  start: string;
  end: string;
}

interface IPTVOSDBarProps {
  visible: boolean;
  hasError?: boolean;
  channelName: string;
  channelLogo?: string;
  currentProgram?: ProgramInfo;
  nextProgram?: ProgramInfo;
  channelNumber?: number;
  currentSourceIndex: number;
  totalSources: number;
  audioTracks: { id: number; name: string; language: string; default: boolean }[];
  onToggleChannelList: () => void;
  onSourceSwitch?: (index: number) => void;
  onOpenSettings?: () => void;
  onOpenResolution?: () => void;
  onOpenAudioTrack?: () => void;
  onHeightChange?: (bottomOffset: number) => void;
  epgStatus?: 'idle' | 'loading' | 'success' | 'error';
  onRefreshEpg?: () => void;
  onOpenProgramGuide?: () => void;
  /** Timeshift state */
  isTimeshifted?: boolean;
  latencyLabel?: string;
  onReturnToLive?: () => void;
}

function getInitials(name: string): string {
  const chars = name.replace(/[\s-]/g, '').split('');
  const firstChars: string[] = [];
  for (const ch of chars) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      firstChars.push(ch);
    }
    if (firstChars.length >= 2) break;
  }
  if (firstChars.length > 0) return firstChars.join('');
  return name.slice(0, 2).toUpperCase();
}

const LOGO_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
}

function LogoFallback({ name }: { name: string }) {
  const initials = getInitials(name);
  const bgColor = getColorForName(name);
  return (
    <div className="iptv-osd-logo-fallback" style={{ backgroundColor: bgColor }}>
      <span>{initials}</span>
    </div>
  );
}

function formatTime(hhmm: string): string {
  return hhmm;
}

function formatCurrentTime(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      setOverflows(el.scrollWidth > el.clientWidth);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={containerRef} className={`marquee-container ${className}`}>
      <div className={`marquee-track ${overflows ? 'marquee-scrolling' : ''}`}>
        <span className="marquee-text">{text}</span>
        {overflows && <span className="marquee-text">{text}</span>}
      </div>
    </div>
  );
}

/* ----- MDI (Material Design Icons) — Apache 2.0 ----- */

function MdiCogIcon({ size = 'xs' }: { size?: IconSize }) {
  return (
    <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
    </svg>
  );
}

function MdiViewListIcon({ size = 'xs' }: { size?: IconSize }) {
  return (
    <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9,5V9H21V5M9,19H21V15H9M9,14H21V10H9M4,9H8V5H4M4,19H8V15H4M4,14H8V10H4V14Z" />
    </svg>
  );
}

function MdiSwapHorizontalVariantIcon({ size = 'xs' }: { size?: IconSize }) {
  return (
    <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4,6L8,10V7H16A2,2 0 0,1 18,9A2,2 0 0,1 16,11H8A4,4 0 0,0 4,15A4,4 0 0,0 8,19H16V22L20,18L16,14V17H8A2,2 0 0,1 6,15A2,2 0 0,1 8,13H16A4,4 0 0,0 20,9A4,4 0 0,0 16,5H8V2L4,6Z" />
    </svg>
  );
}

function MdiResolutionIcon({ size = 'xs' }: { size?: IconSize }) {
  return (
    <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M6,4V20H18V4H6M8,17H10V15H8V17M8,13H10V7H8V13M12,17H14V10H12V17M12,9H14V7H12V9M16,17H18V13H16V17M16,11H18V7H16V11Z" />
    </svg>
  );
}

function MdiAudioTrackIcon({ size = 'xs' }: { size?: IconSize }) {
  return (
    <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17S7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z" />
    </svg>
  );
}

function MdiTimetableIcon({ size = 'xs' }: { size?: IconSize }) {
  return (
    <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,12H15.5V14.82L17.94,16.23L17.19,17.53L14,15.69V12M4,2H18A2,2 0 0,1 20,4V10.1C21.24,11.36 22,13.09 22,15A7,7 0 0,1 15,22C13.09,22 11.36,21.24 10.1,20H4A2,2 0 0,1 2,18V4A2,2 0 0,1 4,2M4,15V18H8.67C8.24,17.09 8,16.07 8,15H4M4,8H10V5H4V8M18,8V5H12V8H18M4,13H8.29C8.63,12.15 9.1,11.4 9.67,10.75H4V13Z" />
    </svg>
  );
}

export default function IPTVOSDBar({
  visible,
  hasError = false,
  channelName,
  channelLogo,
  currentProgram,
  nextProgram,
  channelNumber,
  currentSourceIndex = 0,
  totalSources = 1,
  audioTracks = [],
  onToggleChannelList,
  onSourceSwitch,
  onOpenSettings,
  onOpenResolution,
  onOpenAudioTrack,
  onHeightChange,
  epgStatus = 'idle',
  onRefreshEpg,
  onOpenProgramGuide,
  isTimeshifted = false,
  latencyLabel = '',
  onReturnToLive,
}: IPTVOSDBarProps) {
  const [logoError, setLogoError] = useState(false);
  const [tick, setTick] = useState(0);
  const controlsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const networkSpeed = useNetworkSpeed();

  const hasCurrentTitle = !!currentProgram?.title;

  // tick 触发每秒重算当前时间；formatCurrentTime 内部读取 Date.now()，故依赖 tick 是必要的
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentTimeStr = useMemo(() => formatCurrentTime(), [tick]);

  useEffect(() => {
    setLogoError(false);
  }, [channelLogo]);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  /** 监听控制栏位置变化，通知父组件频道列表应有的底部偏移量（控制栏顶部到播放器底部的距离） */
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const check = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const parentHeight = parent.clientHeight;
      const topOffset = el.offsetTop;
      const bottomOffset = Math.max(0, parentHeight - topOffset);
      onHeightChange?.(bottomOffset);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  const sourceText = totalSources <= 1 ? '线路 1' : `线路 ${currentSourceIndex + 1}/${totalSources}`;


  return (
    <div
      ref={barRef}
      className={`iptv-osd-bar ${visible ? 'iptv-osd-visible' : 'iptv-osd-hidden'}`}
    >
      <div className="iptv-osd-left">
        {channelNumber != null && (
          <span className="iptv-osd-channel-number">{String(channelNumber).padStart(3, '0')}</span>
        )}
        <div className="iptv-osd-channel-row">
          <div className="iptv-osd-logo-wrapper">
            {channelLogo && !logoError ? (
              <img
                className="iptv-osd-logo"
                src={channelLogo}
                alt={channelName}
                onError={() => setLogoError(true)}
              />
            ) : (
              <LogoFallback name={channelName} />
            )}
          </div>
          <MarqueeText text={channelName} className="iptv-osd-name-marquee" />
        </div>
      </div>

      <div className="iptv-osd-center">
        <div className="iptv-osd-program-row">
          <span className="iptv-osd-current-label">
            <span className="iptv-osd-label-prefix">正在播放：</span>
            {epgStatus === 'error' ? (
              <span className="iptv-osd-program-placeholder">暂无节目单{onRefreshEpg && <button className="iptv-osd-refresh-epg" onClick={onRefreshEpg}>刷新</button>}</span>
            ) : hasCurrentTitle ? (
               <MarqueeText text={currentProgram.title} className="iptv-osd-program-marquee" />
            ) : (
              <span className="iptv-osd-program-placeholder">--</span>
            )}
          </span>
        </div>
        <div className="iptv-osd-next-row">
          <span className="iptv-osd-current-label">
            <span className="iptv-osd-label-prefix">下一节目：</span>
            {epgStatus === 'error' ? (
              <span className="iptv-osd-program-placeholder">暂无节目单</span>
            ) : nextProgram ? (
              <MarqueeText
                text={`${nextProgram.title} ${formatTime(nextProgram.start)} - ${formatTime(nextProgram.end)}`}
                className="iptv-osd-program-marquee"
              />
            ) : (
              <span className="iptv-osd-program-placeholder">--</span>
            )}
          </span>
        </div>
        {isTimeshifted && (
          <div className="iptv-osd-timeshift-row">
            <button className="iptv-osd-timeshift-btn" onClick={onReturnToLive}>
              <span className="iptv-osd-timeshift-dot" />
              <span>{latencyLabel}</span>
              <span className="iptv-osd-timeshift-hint">· 点击回到直播</span>
            </button>
          </div>
        )}
        <div
          className="iptv-osd-controls-row"
          ref={controlsRef}
        >
          <div className="iptv-osd-btn-group">
            <button className="iptv-osd-control-btn no-border" onClick={onOpenSettings} title="设置">
              <MdiCogIcon size="xs" />
              <span>设置</span>
            </button>
            <button className="iptv-osd-control-btn no-border" onClick={onToggleChannelList} title="频道列表">
              <MdiViewListIcon size="xs" />
              <span>列表</span>
            </button>
            {onOpenProgramGuide && (
              <button className="iptv-osd-control-btn no-border" onClick={onOpenProgramGuide} title="节目单">
                <MdiTimetableIcon size="xs" />
                <span>节目单</span>
              </button>
            )}
          </div>
          <div className="iptv-osd-btn-group">
            <button className="iptv-osd-control-btn no-border" onClick={() => onSourceSwitch?.((currentSourceIndex + 1) % totalSources)} title="换源">
              <MdiSwapHorizontalVariantIcon size="xs" />
              <span>换源</span>
            </button>
            <button className="iptv-osd-control-btn no-border" onClick={onOpenResolution} title="清晰度">
              <MdiResolutionIcon size="xs" />
              <span>清晰度</span>
            </button>
            {audioTracks.length > 1 && (
              <button className="iptv-osd-control-btn no-border" onClick={onOpenAudioTrack} title="音轨">
                <MdiAudioTrackIcon size="xs" />
                <span>音轨</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="iptv-osd-right">
        <span className="iptv-osd-network-speed">{hasError ? '-- KB/S' : networkSpeed}</span>
        <span className="iptv-osd-source-text">{sourceText}</span>
        <span className="iptv-osd-time">{currentTimeStr}</span>
      </div>
    </div>
  );
}
