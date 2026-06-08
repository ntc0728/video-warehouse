/**
 * 回到顶部按钮组件
 * 监听指定滚动容器的滚动位置，超过阈值时显示按钮，点击平滑滚动到顶部
 */
import { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import './BackToTop.css';

interface BackToTopProps {
  scrollRef: React.RefObject<HTMLElement | null>;
  threshold?: number;
}

export default function BackToTop({ scrollRef, threshold = 400 }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  /** 监听滚动事件，超过阈值时显示按钮 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setVisible(el.scrollTop > threshold);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef, threshold]);

  const handleClick = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollRef]);

  if (!visible) return null;

  return (
    <button className="back-to-top animate-pop-in" onClick={handleClick}>
      <ArrowUp size={20} />
    </button>
  );
}
