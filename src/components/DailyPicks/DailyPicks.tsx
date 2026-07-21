/**
 * 每日推荐轮播组件
 * 展示基于推荐算法生成的每日精选视频，支持自动轮播和触摸滑动切换
 * 基于 embla-carousel（shadcn/ui Carousel 模式）
 */
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useRecommendStore, useVideoStore } from '@/stores';
import { useIsMobile } from '@/hooks/useMediaQuery';
import LazyImage from '../LazyImage/LazyImage';
import './DailyPicks.css';

export default function DailyPicks() {
  const navigate = useNavigate();
  const { videos } = useVideoStore();
  const { dailyPicks, generateDailyPicks } = useRecommendStore();
  const isMobile = useIsMobile();
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 40 },
    [Autoplay({ delay: 4000, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  /** 首次加载时，若推荐列表为空则根据视频数据生成推荐 */
  useEffect(() => {
    if (dailyPicks.length === 0 && videos.length > 0) {
      generateDailyPicks(videos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyPicks.length, videos.length, generateDailyPicks]);

  /** 监听 embla 选中项变化 */
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  /** 页面可见性 API：后台暂停 autoplay，回来恢复 */
  useEffect(() => {
    if (!emblaApi) return;
    const plugins = emblaApi.plugins();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoplay = (plugins as any).autoplay as { stop: () => void; play: () => void } | undefined;
    if (!autoplay) return;

    const handleVisibility = () => {
      if (document.hidden) {
        autoplay.stop();
      } else {
        autoplay.play();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [emblaApi]);

  const scrollTo = useCallback((index: number) => {
    if (!emblaApi) return;
    emblaApi.scrollTo(index);
  }, [emblaApi]);

  if (dailyPicks.length === 0 || videos.length === 0) return null;

  return (
    <div className={`daily-carousel animate-fade-in ${isMobile ? '' : 'daily-carousel-pc'}`}>
      <div className="carousel-track" ref={emblaRef}>
        <div className="carousel-slides">
          {dailyPicks.map((pick) => (
            <div
              key={pick.id}
              className="carousel-slide"
              onClick={() => navigate(`/detail/${pick.videoId}`, { viewTransition: true })}
            >
              <div className="carousel-slide-cover">
                <LazyImage src={pick.cover} alt={pick.title} letter={pick.title?.charAt(0)} />
              </div>
              <div className="carousel-slide-overlay" />
              <div className="carousel-slide-content">
                <div className="carousel-slide-badge">
                  <Sparkles size={12} /> 每日推荐
                </div>
                <h3 className="carousel-slide-title">{pick.title}</h3>
                <p className="carousel-slide-reason">{pick.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="carousel-dots">
        {dailyPicks.map((_, idx) => (
          <button
            key={idx}
            className={`carousel-dot ${idx === selectedIndex ? 'active' : ''}`}
            onClick={() => scrollTo(idx)}
          />
        ))}
      </div>
    </div>
  );
}
