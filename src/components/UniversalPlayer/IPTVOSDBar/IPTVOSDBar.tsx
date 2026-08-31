import { useState, useMemo, useEffect, useRef } from 'react';
import { useNetworkSpeed } from '@/hooks';
import { SIZE_VAR, type IconSize } from '@/components/ui/Icon';
import { markLogoFailed, markLogoSucceeded } from '@/services/channelLogo';
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
  /** 台标候选链（含 channelLogo 本身），失败时依次尝试；未提供时退回单 channelLogo */
  channelLogoCandidates?: string[];
  currentProgram?: ProgramInfo;
  nextProgram?: ProgramInfo;
  channelNumber?: number;
  currentSourceIndex: number;
  totalSources: number;
  audioTracks: { id: number; name: string; language: string; default: boolean }[];
  onToggleChannelList: () => void;
  onSourceSwitch?: (index: number) => void;
  onOpenAudioTrack?: () => void;
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
  channelLogoCandidates,
  currentProgram,
  nextProgram,
  channelNumber,
  currentSourceIndex = 0,
  totalSources = 1,
  audioTracks = [],
  onToggleChannelList,
  onSourceSwitch,
  onOpenAudioTrack,
  epgStatus = 'idle',
  onRefreshEpg,
  onOpenProgramGuide,
  isTimeshifted = false,
  latencyLabel = '',
  onReturnToLive,
}: IPTVOSDBarProps) {
  const [logoError, setLogoError] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const controlsRef = useRef<HTMLDivElement>(null);
  const networkSpeed = useNetworkSpeed();

  // 候选链：优先用完整候选，未提供时退回单 channelLogo
  const logoCandidates = channelLogoCandidates && channelLogoCandidates.length > 0
    ? channelLogoCandidates
    : (channelLogo ? [channelLogo] : []);
  const logoUrl = logoCandidates[logoIndex];

  const hasCurrentTitle = !!currentProgram?.title;

  // tick 触发每秒重算当前时间；formatCurrentTime 内部读取 Date.now()，故依赖 tick 是必要的
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentTimeStr = useMemo(() => formatCurrentTime(), [tick]);

  useEffect(() => {
    // 频道切换（channelLogo 变化）时重置候选下标与错误态
    setLogoError(false);
    setLogoIndex(0);
  }, [channelLogo]);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const sourceText = totalSources <= 1 ? '线路 1' : `线路 ${currentSourceIndex + 1}/${totalSources}`;


  return (
    <div
      className={`iptv-osd-bar ${visible ? 'iptv-osd-visible' : 'iptv-osd-hidden'}`}
    >
      <div className="iptv-osd-left">
        {channelNumber != null && (
          <span className="iptv-osd-channel-number">{String(channelNumber).padStart(3, '0')}</span>
        )}
        <div className="iptv-osd-channel-row">
          <div className="iptv-osd-logo-wrapper">
            {logoUrl && !logoError ? (
              <img
                className="iptv-osd-logo"
                src={logoUrl}
                alt={channelName}
                onError={() => {
                  markLogoFailed(logoUrl);
                  if (logoIndex + 1 < logoCandidates.length) {
                    setLogoIndex((i) => i + 1);
                  } else {
                    setLogoError(true);
                  }
                }}
                onLoad={() => {
                  // 成功记忆：跨会话优先复用该 URL
                  markLogoSucceeded(logoUrl);
                }}
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
