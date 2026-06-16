/**
 * IPTV 频道卡片组件
 * 展示单个 IPTV 频道信息，支持点击播放、收藏切换和代理播放
 */
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, CheckCircle, XCircle } from 'lucide-react';
import type { IPTVChannel } from '@/types/iptv';
import { useIPTVStore } from '@/stores';
import { useIsTV } from '@/hooks/useMediaQuery';
import { shouldProxy } from '@/services/iptvService';
import LazyImage from '../LazyImage/LazyImage';
import './IPTVChannelCard.css';

interface IPTVChannelCardProps {
  channel: IPTVChannel;
  hideFavorite?: boolean;
  batchMode?: boolean;
}

const IPTVChannelCard = memo(function IPTVChannelCard({ channel, hideFavorite = false, batchMode = false }: IPTVChannelCardProps) {
  const navigate = useNavigate();
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const setSelectedChannel = useIPTVStore((s) => s.setSelectedChannel);
  const recordPlay = useIPTVStore((s) => s.recordPlay);
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
  const sourceNames = useIPTVStore((s) => s.settings.sourceNames);
  const [isAnimating, setIsAnimating] = useState(false);
  const isTV = useIsTV();

  const sourceName = channel.sourceId && sourceNames
    ? sourceNames[parseInt(channel.sourceId.replace('source-', ''), 10)]
    : undefined;

  /** 点击播放：记录播放历史，根据代理规则构建播放地址并跳转 */
  const handlePlay = useCallback(() => {
    if (batchMode) return;
    setSelectedChannel(channel);
    recordPlay(channel.id);
    const useProxy = shouldProxy(channel.url, proxyUrl, proxyPattern);
    const playUrl = useProxy
      ? `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(channel.url)}`
      : channel.url;
    navigate(`/iptv/play?url=${encodeURIComponent(playUrl)}`, { state: { from: '/iptv' }, viewTransition: true });
  }, [batchMode, channel, proxyUrl, proxyPattern, setSelectedChannel, recordPlay, navigate]);

  /** 收藏切换，带弹跳动画反馈 */
  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    toggleFavorite(channel.id);
    setTimeout(() => setIsAnimating(false), 450);
  }, [toggleFavorite, channel.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePlay();
    }
  }, [handlePlay]);

  // 固定入场延迟：所有卡片共享同一个 delay,消除"靠后批次 index 累加导致
  // 末尾卡片等数百毫秒才淡入"的问题。首屏 60 张几乎同时淡入,整体节奏仍
  // 由 cardFadeIn (0.18s) 提供。
  const staggerDelay = { animationDelay: '0.012s' };
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTitleOverflow, setIsTitleOverflow] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => {
      const overflow = el.scrollWidth > el.clientWidth;
      setIsTitleOverflow(overflow);
      if (overflow) {
        el.style.setProperty('--marquee-dist', `-${el.scrollWidth - el.clientWidth}px`);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [channel.name]);

  return (
    <div
      className={`iptv-channel-card ${channel.isAvailable === false ? 'unavailable' : ''} animate-card-enter btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:rounded-lg`}
      style={staggerDelay}
      onClick={handlePlay}
      tabIndex={isTV ? 0 : undefined}
      onKeyDown={isTV ? handleKeyDown : undefined}
    >
      <div className="card-body">
        <div className="iptv-card-cover">
          <LazyImage
            src={channel.logo || ''}
            alt={channel.name}
            letter={channel.name.charAt(0)}
            loadingVariant="brand"
          />
          {/* 批量模式下隐藏封面元素 */}
          {!batchMode && channel.isAvailable !== undefined && (
            <div className={`availability-badge ${channel.isAvailable ? 'available' : 'unavailable'}`}>
              {channel.isAvailable ? <CheckCircle size={8} /> : <XCircle size={8} />}
            </div>
          )}
          {!batchMode && channel.group ? (
            <span className="iptv-card-group">{channel.group}</span>
          ) : null}
          {!batchMode && sourceName && (
            <span className="iptv-card-source">{sourceName}</span>
          )}
        </div>
        <div className="iptv-card-info">
          <h3
            ref={titleRef}
            className={`iptv-card-title${isTitleOverflow ? ' marquee' : ''}`}
            title={channel.name}
          >{channel.name}</h3>
        </div>
      </div>
      {/* 批量模式下隐藏收藏按钮 */}
      {!batchMode && !hideFavorite && (
        <button
          className={`iptv-card-favorite ${channel.isFavorite ? 'visible active' : 'hover-visible'} ${isAnimating ? 'animate-pop-bounce' : ''}`}
          onClick={handleFavorite}
          aria-label={channel.isFavorite ? '取消收藏' : '添加收藏'}
        >
          <Heart
            size={13}
            fill={channel.isFavorite ? 'var(--color-favorite-active)' : 'none'}
            color={channel.isFavorite ? 'var(--color-favorite-active)' : 'currentColor'}
          />
        </button>
      )}
    </div>
  );
});

export default IPTVChannelCard;
