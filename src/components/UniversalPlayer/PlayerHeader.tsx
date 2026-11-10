import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PlayerMode } from '@/types/player';
import FullscreenButton from './ControlBar/FullscreenButton';
import { Icon } from "@/components/ui/Icon";

/**
 * header 标题跑马灯：溢出时循环滚动完整显示标题 + 集数 badge。
 * 复用 IPTVOSDBar/IPTVChannelList 同款 marquee-container / marquee-track /
 * marquee-scrolling 类与 marquee-scroll keyframes（副本文案由 scrollWidth 检出后插入，
 * 尾部 padding 保证 translateX(-50%) 无缝）。
 * 2026-11-11：换源后集名变长（badge 163→225px）令单行总宽超容器 30px，原
 * text-overflow:ellipsis 会整段丢弃 badge 折成「剧名…」——改为滚动，不再省略。
 */
function HeaderTitleMarquee({ title, episodeLabel }: { title: string; episodeLabel?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title, episodeLabel]);

  const content = (
    <>
      {title}
      {episodeLabel && <span className="up-header-episode-badge">{episodeLabel}</span>}
    </>
  );

  return (
    <span ref={containerRef} className="up-header-title marquee-container">
      <span className={`marquee-track ${overflows ? 'marquee-scrolling' : ''}`}>
        <span className="marquee-text up-header-title-text">{content}</span>
        {overflows && (
          <span className="marquee-text up-header-title-text" aria-hidden="true">{content}</span>
        )}
      </span>
    </span>
  );
}

interface PlayerHeaderProps {
  mode: PlayerMode;
  title: string;
  episodeLabel?: string;
  channelName?: string;
  visible: boolean;
  showFullscreenButton?: boolean;
  /** 播放错误态：透传给 FullscreenButton，错误时禁用全屏（C4 守卫一致） */
  hasError?: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onBack: () => void;
  onActivity?: () => void;
  /** 右上角操作组（移动端/App 端点播页：画中画 · 投屏 · 更多设置） */
  actions?: React.ReactNode;
}

export default function PlayerHeader({
  mode,
  title,
  episodeLabel,
  channelName,
  visible,
  showFullscreenButton = true,
  hasError = false,
  containerRef,
  onBack,
  onActivity,
  actions,
}: PlayerHeaderProps) {
  const displayTitle = mode === 'iptv' ? (channelName || title) : title;

  return (
    <div
      className={`up-player-header ${visible ? 'up-player-header-visible' : 'up-player-header-hidden'}`}
      onMouseMove={onActivity}
    >
      <button className="up-header-back" onClick={(e) => { e.stopPropagation(); onBack(); }}>
        <Icon icon={ArrowLeft} size="sm" />
        <span>返回</span>
      </button>
      <HeaderTitleMarquee title={displayTitle} episodeLabel={episodeLabel} />
      {actions}
      {showFullscreenButton && <FullscreenButton containerRef={containerRef} hasError={hasError} />}
    </div>
  );
}
