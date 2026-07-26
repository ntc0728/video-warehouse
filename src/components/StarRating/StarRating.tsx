/**
 * 星级评分组件
 * 支持1-5星评分，点击相同星级可取消评分，hover 时预览评分效果
 * 增强：键盘可达性（方向键/Home/End/Enter）、ARIA radiogroup、点击回弹反馈
 */
import { useState, useRef } from 'react';
import { Star } from 'lucide-react';
import { useUserStore } from '@/stores';
import './StarRating.css';

interface StarRatingProps {
  videoId: string;
  size?: number;
  showLabel?: boolean;
}

export default function StarRating({ videoId, size = 18, showLabel = true }: StarRatingProps) {
  const { getRating, setRating } = useUserStore();
  const currentRating = getRating(videoId);
  const [hoverRating, setHoverRating] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);

  /** hover / 键盘预览时显示评分，否则显示实际评分 */
  const displayRating = hoverRating || currentRating;

  /** 点击评分：再次点击相同星级则取消评分（归零） */
  const handleClick = (rating: number) => {
    if (currentRating === rating) {
      setRating(videoId, 0);
    } else {
      setRating(videoId, rating);
    }
  };

  /** 键盘交互：方向键预览、Home/End 跳首末、Enter/Space 确认 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const base = hoverRating || currentRating;
    let next = base;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(5, base + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(1, base - 1);
        break;
      case 'Home':
        next = 1;
        break;
      case 'End':
        next = 5;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (base >= 1 && base <= 5) handleClick(base);
        return;
      default:
        return;
    }
    e.preventDefault();
    setHoverRating(next);
  };

  return (
    <div
      className="star-rating"
      role="radiogroup"
      aria-label="评分"
      ref={groupRef}
      onMouseLeave={() => setHoverRating(0)}
    >
      <div className="star-rating-stars">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= displayRating;
          // roving tabindex：仅当前评分星或第一颗可聚焦，便于键盘进入
          const tabStop = currentRating > 0 ? star === currentRating : star === 1;
          return (
            <button
              key={star}
              type="button"
              className={`star-btn ${active ? 'filled' : ''}`}
              role="radio"
              aria-checked={star <= currentRating}
              aria-label={`${star} 星${currentRating === star ? '（当前评分）' : ''}`}
              tabIndex={tabStop ? 0 : -1}
              onClick={() => handleClick(star)}
              onMouseEnter={() => setHoverRating(star)}
              onKeyDown={handleKeyDown}
            >
              <Star
                size={size}
                fill={active ? 'var(--color-favorite-active)' : 'none'}
                strokeWidth={active ? 0 : 1.5}
              />
            </button>
          );
        })}
      </div>
      {showLabel && currentRating > 0 && (
        <span className="star-rating-label">{currentRating}分</span>
      )}
    </div>
  );
}
