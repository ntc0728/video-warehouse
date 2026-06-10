import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Radio, X, Play } from 'lucide-react';
import { CustomScrollbar } from '@/components/common';
import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

interface TVFocus {
  groupIndex: number;
  channelIndex: number;
  activeSection: 'groups' | 'channels';
}

interface IPTVChannelListProps {
  visible: boolean;
  groups: IPTVGroup[];
  currentChannelId?: string;
  onSelectChannel: (channel: IPTVChannel) => void;
  onClose: () => void;
  tvFocus?: TVFocus;
  onTvFocusChange?: (focus: TVFocus) => void;
}

function MarqueeText({ text }: { text: string }) {
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
    <div ref={containerRef} className="marquee-container">
      <div className={`marquee-track ${overflows ? 'marquee-scrolling' : ''}`}>
        <span className="marquee-text">{text}</span>
        {overflows && <span className="marquee-text">{text}</span>}
      </div>
    </div>
  );
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

function getFirstChar(name: string): string {
  for (const ch of name) {
    if (/[\u4e00-\u9fff]/.test(ch)) return ch;
  }
  return name.charAt(0).toUpperCase() || '#';
}

function ChannelLogoCell({ channel }: { channel: IPTVChannel }) {
  const [imgError, setImgError] = useState(false);

  if (channel.logo && !imgError) {
    return (
      <img
        className="up-channel-item-logo"
        src={channel.logo}
        alt=""
        onError={() => setImgError(true)}
      />
    );
  }

  const char = getFirstChar(channel.name);
  const bgColor = getColorForName(channel.name);
  return (
    <div
      className="up-channel-item-logo-fallback"
      style={{ backgroundColor: bgColor }}
    >
      {char}
    </div>
  );
}

export default function IPTVChannelList({
  visible,
  groups,
  currentChannelId,
  onSelectChannel,
  onClose,
  tvFocus,
  onTvFocusChange,
}: IPTVChannelListProps) {
  const activeGroupIndexRef = useRef(0);
  const [localGroupIndex, setLocalGroupIndex] = useState(0);
  const channelsContainerRef = useRef<HTMLDivElement>(null);

  const isTvMode = !!onTvFocusChange;

  const activeGroupIndex = isTvMode
    ? (tvFocus?.groupIndex ?? activeGroupIndexRef.current)
    : localGroupIndex;
  const activeGroup = groups[activeGroupIndex];
  const activeChannels = activeGroup?.channels ?? [];

  const channelNumberOffset = useMemo(() => {
    let offset = 0;
    for (let i = 0; i < activeGroupIndex; i++) {
      offset += groups[i]?.channels.length ?? 0;
    }
    return offset;
  }, [groups, activeGroupIndex]);

  useEffect(() => {
    if (!tvFocus) {
      activeGroupIndexRef.current = 0;
    }
  }, [visible, tvFocus]);

  /** 频道列表打开时自动定位到当前播放频道的分组和滚动位置 */
  useEffect(() => {
    if (!visible || !currentChannelId || groups.length === 0) return;

    for (let g = 0; g < groups.length; g++) {
      const chIndex = groups[g].channels.findIndex(ch => ch.id === currentChannelId);
      if (chIndex >= 0) {
        activeGroupIndexRef.current = g;
        if (isTvMode) {
          onTvFocusChange?.({ groupIndex: g, channelIndex: chIndex, activeSection: 'channels' });
        } else {
          setLocalGroupIndex(g);
        }

        requestAnimationFrame(() => {
          if (!channelsContainerRef.current) return;
          const activeEl = channelsContainerRef.current.querySelector('.up-channel-item-active');
          if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        });
        break;
      }
    }
  }, [visible, currentChannelId, groups, isTvMode, onTvFocusChange]);

  const handleGroupSelect = useCallback((index: number) => {
    activeGroupIndexRef.current = index;
    if (onTvFocusChange) {
      onTvFocusChange({ groupIndex: index, channelIndex: 0, activeSection: 'channels' });
    } else {
      setLocalGroupIndex(index);
    }
  }, [onTvFocusChange]);

  const handleChannelSelect = useCallback((channel: IPTVChannel, channelIndex: number) => {
    onSelectChannel(channel);
    if (onTvFocusChange) {
      onTvFocusChange({
        groupIndex: activeGroupIndex,
        channelIndex,
        activeSection: 'channels',
      });
    }
  }, [onSelectChannel, onTvFocusChange, activeGroupIndex]);

  if (!visible) return null;

  return (
    <div className="up-channel-list-overlay" onClick={onClose}>
      <div className="up-channel-list" onClick={e => e.stopPropagation()}>
        <div className="up-channel-list-header">
          <Radio size={16} />
          <span>频道列表</span>
          <button className="up-channel-list-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="up-channel-list-body">
          {groups.length === 0 ? (
            <div className="up-channel-empty">暂无可用频道</div>
          ) : (
            <>
              <CustomScrollbar className="up-channel-groups" direction="vertical" autoHideDelay={500}>
                {groups.map((group, index) => (
                  <button
                    key={group.name}
                    className={`up-channel-group-item ${index === activeGroupIndex ? 'up-channel-group-active' : ''} ${tvFocus && tvFocus.activeSection === 'groups' && index === tvFocus.groupIndex ? 'up-channel-group-focused' : ''}`}
                    onClick={() => handleGroupSelect(index)}
                  >
                    <span className="up-channel-group-name">
                      <span className="up-channel-group-text">{group.name}</span>
                      <span className="up-channel-group-count">{group.channels.length}</span>
                    </span>
                  </button>
                ))}
              </CustomScrollbar>
              <CustomScrollbar className="up-channel-channels" ref={channelsContainerRef} direction="vertical" autoHideDelay={500}>
                {activeChannels.length === 0 ? (
                  <div className="up-channel-empty">该分组暂无频道</div>
                ) : (
                  activeChannels.map((channel, index) => (
                    <button
                      key={channel.id}
                      className={`up-channel-item ${channel.id === currentChannelId ? 'up-channel-item-active' : ''} ${tvFocus && tvFocus.activeSection === 'channels' && index === tvFocus.channelIndex ? 'up-channel-item-focused' : ''}`}
                      onClick={() => handleChannelSelect(channel, index)}
                    >
                      <span className="up-channel-item-num">{channelNumberOffset + index + 1}</span>
                      <ChannelLogoCell channel={channel} />
                      <span className="up-channel-item-name">
                        <MarqueeText text={channel.name} />
                      </span>
                      {channel.quality && (
                        <span className="up-channel-item-quality">{channel.quality}</span>
                      )}
                      {channel.id === currentChannelId && (
                        <Play size={12} className="up-channel-item-playing-icon" fill="currentColor" />
                      )}
                    </button>
                  ))
                )}
              </CustomScrollbar>
            </>
          )}
        </div>
      </div>
    </div>
  );
}