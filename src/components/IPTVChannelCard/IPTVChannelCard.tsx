/**
 * IPTV 频道卡片组件
 * 展示单个 IPTV 频道信息，支持点击播放、收藏切换和代理播放
 */
import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, CheckCircle, XCircle } from 'lucide-react';
import type { IPTVChannel } from '@/types/iptv';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useIsTV } from '@/hooks/useMediaQuery';
import { shouldProxy, buildProxyUrl } from '@/services/iptvService';
import LazyImage from '../LazyImage/LazyImage';
import { isImageLoaded } from '../LazyImage/imageCache';
import './IPTVChannelCard.css';

interface IPTVChannelCardProps {
  channel: IPTVChannel;
  hideFavorite?: boolean;
  batchMode?: boolean;
}

const IPTVChannelCard = memo(function IPTVChannelCard({ channel, hideFavorite = false, batchMode = false }: IPTVChannelCardProps) {
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const setSelectedChannel = useIPTVStore((s) => s.setSelectedChannel);
  const recordPlay = useIPTVStore((s) => s.recordPlay);
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
  const sourceNames = useIPTVStore((s) => s.settings.sourceNames);
  const [isAnimating, setIsAnimating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() => isImageLoaded(channel.logo || ''));
  const isTV = useIsTV();
  // 无 logo 时使用字母占位，也应显示收藏按钮
  const showFavorite = !batchMode && !hideFavorite && (imageLoaded || !channel.logo);

  const sourceName = channel.sourceId && sourceNames
    ? sourceNames[parseInt(channel.sourceId.replace('source-', ''), 10)]
    : undefined;

  /** 构建播放链接：根据代理规则生成最终 URL */
  const to = useMemo(() => {
    if (batchMode) return '#';
    const useProxy = shouldProxy(channel.url, proxyUrl, proxyPattern);
    const playUrl = useProxy
      ? buildProxyUrl(channel.url, proxyUrl)
      : channel.url;
    const params = new URLSearchParams({ url: encodeURIComponent(playUrl) });
    params.set('id', channel.id);
    params.set('name', channel.name);
    return `/iptv/play?${params.toString()}`;
  }, [batchMode, channel.url, channel.id, channel.name, proxyUrl, proxyPattern]);

  /** 跳转前记录播放历史与当前选中频道 */
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (batchMode) {
      e.preventDefault();
      return;
    }
    setSelectedChannel(channel);
    recordPlay(channel.id);
  }, [batchMode, channel, setSelectedChannel, recordPlay]);

  /** 收藏切换，带弹跳动画反馈 */
  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    toggleFavorite(channel.id);
    setTimeout(() => setIsAnimating(false), 450);
  }, [toggleFavorite, channel.id]);

  // 固定入场延迟：所有卡片共享同一个 delay,消除"靠后批次 index 累加导致
  // 末尾卡片等数百毫秒才淡入"的问题。首屏 60 张几乎同时淡入,整体节奏仍
  // 由 cardFadeIn (0.18s) 提供。
  const staggerDelay = { animationDelay: '0.012s' };
  const titleRef = useRef<HTMLDivElement>(null);
  const [isTitleOverflow, setIsTitleOverflow] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => {
      const textEl = el.querySelector('.iptv-card-title-text') as HTMLElement | null;
      if (!textEl) return;
      const overflow = textEl.scrollWidth > el.clientWidth;
      setIsTitleOverflow(overflow);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [channel.name]);

  const cardClassName = `iptv-channel-card ${channel.isAvailable === false ? 'unavailable' : ''} animate-card-enter btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:rounded-lg`;

  const cardBody = (
    <div className="card-body">
      <div className="iptv-card-cover">
        <LazyImage
          src={channel.logo || ''}
          alt={channel.name}
          letter={channel.name.charAt(0)}
          loadingVariant="brand"
          onLoad={() => setImageLoaded(true)}
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
        <div
          ref={titleRef}
          className={`iptv-card-title${isTitleOverflow ? ' marquee' : ''}`}
          title={channel.name}
        >
          <span className="iptv-card-title-track">
            <span className="iptv-card-title-text">{channel.name}</span>
            {isTitleOverflow && (
              <span className="iptv-card-title-text">{channel.name}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="iptv-channel-card-wrap">
      {batchMode ? (
        <div
          className={cardClassName}
          style={staggerDelay}
          aria-label={`播放 ${channel.name}`}
          tabIndex={isTV ? 0 : undefined}
        >
          {cardBody}
        </div>
      ) : (
        <Link
          to={to}
          state={{ from: '/iptv' }}
          className={cardClassName}
          style={staggerDelay}
          onClick={handleClick}
          aria-label={`播放 ${channel.name}`}
          tabIndex={isTV ? 0 : undefined}
        >
          {cardBody}
        </Link>
      )}
      {/* 批量模式下隐藏收藏按钮 */}
      {showFavorite && (
        <button
          type="button"
          className={`iptv-card-favorite ${channel.isFavorite ? 'visible active' : 'hover-visible'} ${isAnimating ? 'animate-pop-bounce' : ''}`}
          onClick={handleFavorite}
          aria-label={channel.isFavorite ? '取消收藏' : '添加收藏'}
          aria-pressed={channel.isFavorite}
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
