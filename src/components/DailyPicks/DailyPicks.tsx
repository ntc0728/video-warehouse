/**
 * 每日推荐轮播组件
 * 展示基于推荐算法生成的每日精选视频，支持自动轮播和触摸滑动切换
 */
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const isMobile = useIsMobile();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef(0);

  /** 首次加载时，若推荐列表为空则根据视频数据生成推荐 */
  useEffect(() => {
    if (dailyPicks.length === 0 && videos.length > 0) {
      generateDailyPicks(videos);
    }
    // videos 通过 useVideoStore selector 读取，本身变化不频繁
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyPicks.length, videos.length, generateDailyPicks]);

  /** 启动自动轮播，每4秒切换一张 */
  const startAutoPlay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % dailyPicks.length);
    }, 4000);
  }, [dailyPicks.length]);

  useEffect(() => {
    if (dailyPicks.length > 1) {
      startAutoPlay();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dailyPicks.length, startAutoPlay]);

  const goTo = useCallback((index: number) => {
    setCurrentSlide(index);
    startAutoPlay();
  }, [startAutoPlay]);

  /** 触摸开始时记录起始位置并暂停自动轮播 */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  /** 触摸结束时根据滑动距离判断方向，超过50px则切换幻灯片 */
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goTo((currentSlide + 1) % dailyPicks.length);
      } else {
        goTo((currentSlide - 1 + dailyPicks.length) % dailyPicks.length);
      }
    }
    startAutoPlay();
  }, [currentSlide, dailyPicks.length, goTo, startAutoPlay]);

  if (dailyPicks.length === 0 || videos.length === 0) return null;

  if (isMobile) {
    return (
      <div className="daily-carousel animate-fade-in">
        <div
          className="carousel-track"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="carousel-slides"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
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
              className={`carousel-dot ${idx === currentSlide ? 'active' : ''}`}
              onClick={() => goTo(idx)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="daily-carousel daily-carousel-pc animate-fade-in">
      <div
        className="carousel-track"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="carousel-slides"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
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
            className={`carousel-dot ${idx === currentSlide ? 'active' : ''}`}
            onClick={() => goTo(idx)}
          />
        ))}
      </div>
    </div>
  );
}
