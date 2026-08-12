/**
 * IPTV 频道卡片组件
 * 展示单个 IPTV 频道信息，支持点击播放、收藏切换和代理播放
 */
import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, CheckCircle, XCircle, Tv } from 'lucide-react';
import type { IPTVChannel } from '@/types/iptv';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useIsTV } from '@/hooks/useMediaQuery';
import { buildChannelPlayUrl } from '@/services/iptvService';
import { resolveChannelLogoCandidates, markLogoFailed, markLogoSucceeded } from '@/services/channelLogo';
import type { EPGChannelInfo, EPGChannelIndex } from '@/services/epgService';
import LazyImage from '../LazyImage/LazyImage';
import { isImageLoaded } from '../LazyImage/imageCache';
import './IPTVChannelCard.css';
import { Icon } from "@/components/ui/Icon";

interface IPTVChannelCardProps {
  channel: IPTVChannel;
  hideFavorite?: boolean;
  batchMode?: boolean;
  /** 当前 tab 该频道的检测结果（由 IPTV 页按组传入，独立于其他 tab）；undefined 表示未检测 */
  availability?: boolean;
  /** EPG 频道列表（含 XMLTV icon），用于台标二级回退来源；由 IPTV 页懒加载后传入 */
  epgChannels?: EPGChannelInfo[];
  /** EPG 频道预索引（O(1) 匹配，避免每卡片全量遍历数千 EPG 频道）；由页面层一次性构建 */
  epgIndex?: EPGChannelIndex;
}

const IPTVChannelCard = memo(function IPTVChannelCard({ channel, hideFavorite = false, batchMode = false, availability, epgChannels, epgIndex }: IPTVChannelCardProps) {
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const setSelectedChannel = useIPTVStore((s) => s.setSelectedChannel);
  const recordPlay = useIPTVStore((s) => s.recordPlay);
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
  const sourceNames = useIPTVStore((s) => s.settings.sourceNames);
  const [isAnimating, setIsAnimating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() => isImageLoaded(channel.logo || ''));
  // IPTV 失败占位（横向 cover 专属）：覆盖 KinoTV 纵向品牌占位图（浅蓝+播放图标不协调），
  // 改用 Tv 图标居中显示，覆盖层 data-show 切换，无障碍 + 视觉与视频占位区分
  const [imageError, setImageError] = useState(false);
  const isTV = useIsTV();
  // 无 logo 时使用字母占位，也应显示收藏按钮
  const showFavorite = !batchMode && !hideFavorite && (imageLoaded || !channel.logo);

  const sourceName = channel.sourceId && sourceNames
    ? sourceNames[parseInt(channel.sourceId.replace('source-', ''), 10)]
    : undefined;
  // 当前所在页（收藏/历史/列表等），用作深链兜底返回来源。
  // 正常应用内导航由 useSmartBack 走浏览器原生后退（navigate(-1)）回退到本页，
  // 此 from 仅在深链直达 /iptv/play 时作为兜底。
  const location = useLocation();

  /** 台标候选链（三级回退）：M3U tvg-logo → EPG icon → 在线台标库，全失败走字母占位 */
  const logoCandidates = useMemo(
    () => resolveChannelLogoCandidates(channel, epgChannels, proxyUrl, epgIndex),
    [channel, epgChannels, proxyUrl, epgIndex]
  );

  /** 构建播放链接：根据代理规则生成最终 URL（统一入口，预留 UA/Referer 携带） */
  const to = useMemo(() => {
    if (batchMode) return '#';
    const playUrl = buildChannelPlayUrl(channel, proxyUrl, proxyPattern);
    const params = new URLSearchParams({ url: encodeURIComponent(playUrl) });
    params.set('id', channel.id);
    params.set('name', channel.name);
    return `/iptv/play?${params.toString()}`;
  }, [batchMode, channel, proxyUrl, proxyPattern]);

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
  // 末尾卡片等数百毫秒才淡入"的问题。首屏卡片几乎同时上移淡入,整体节奏
  // 由 fadeInUp (0.4s) 提供（与收藏页视频 tab 的卡片出场动画一致）。
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

  const cardClassName = `iptv-channel-card ${availability === false ? 'unavailable' : ''} animate-fade-in-up btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:rounded-lg`;

  const cardBody = (
    <div className="card-body">
      <div className="iptv-card-cover">
        <LazyImage
          src={logoCandidates[0] ?? ''}
          srcCandidates={logoCandidates.slice(1)}
          alt={channel.name}
          loadingVariant="brand"
          /* fallbackSrc="" 强制不渲染 KinoTV 纵向品牌占位图（浅蓝+播放图标），
             横向 cover（3:2）下不协调；改用下方专属 Tv 图标占位 */
          fallbackSrc=""
          onLoad={(url) => {
            setImageLoaded(true);
            // 成功记忆：跨会话优先复用该 URL，避免下次重新走候选链
            if (url) markLogoSucceeded(url);
          }}
          onError={(_, failedUrl) => {
            setImageError(true);
            // 候选 URL 失败后记入失败记忆，避免后续重复请求
            if (failedUrl) markLogoFailed(failedUrl);
          }}
        />
        {/* 横向 cover 失败专属占位：浅灰色 Tv 图标居中，半透明，
           与视频（点击播放）的播放图标语义区分（IPTV 是直播频道） */}
        <div className="iptv-card-cover__glyph" data-show={imageError} aria-hidden="true">
          <Icon icon={Tv} size="lg" />
        </div>
        {/* 批量模式下隐藏封面元素；检测结果来自当前 tab（availability prop），独立于其他 tab。
            封面图加载失败（imageError 为 true）时隐藏左上角徽标，保证占位图干净 */}
        {!batchMode && availability !== undefined && !imageError && (
          <div className={`availability-badge ${availability ? 'available' : 'unavailable'}`}>
            {availability ? <Icon icon={CheckCircle} size="xs" /> : <Icon icon={XCircle} size="xs" />}
            <span className="availability-badge__label">{availability ? '可用' : '不可用'}</span>
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
          state={{ from: location.pathname }}
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
          <Icon icon={Heart} size="xs"
                              fill={channel.isFavorite ? 'var(--color-favorite-active)' : 'none'}
                              color={channel.isFavorite ? 'var(--color-favorite-active)' : 'currentColor'}
                            />
        </button>
      )}
    </div>
  );
});

export default IPTVChannelCard;
