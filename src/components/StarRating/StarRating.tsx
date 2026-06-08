/**
 * 星级评分组件
 * 支持1-5星评分，点击相同星级可取消评分，hover 时预览评分效果
 */
import { useState } from 'react';
import { Star } from 'lucide-react';
import { useRatingStore } from '@/stores';
import './StarRating.css';

interface StarRatingProps {
  videoId: string;
  size?: number;
  showLabel?: boolean;
}

export default function StarRating({ videoId, size = 18, showLabel = true }: StarRatingProps) {
  const { getRating, setRating } = useRatingStore();
  const currentRating = getRating(videoId);
  const [hoverRating, setHoverRating] = useState(0);

  /** hover 时显示预览评分，否则显示实际评分 */
  const displayRating = hoverRating || currentRating;

  /** 点击评分：再次点击相同星级则取消评分（归零） */
  const handleClick = (rating: number) => {
    if (currentRating === rating) {
      setRating(videoId, 0);
    } else {
      setRating(videoId, rating);
    }
  };

  return (
    <div className="star-rating">
      <div className="star-rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star-btn ${star <= displayRating ? 'filled' : ''}`}
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
          >
            <Star
              size={size}
              fill={star <= displayRating ? 'var(--color-favorite-active)' : 'none'}
              strokeWidth={star <= displayRating ? 0 : 1.5}
            />
          </button>
        ))}
      </div>
      {showLabel && currentRating > 0 && (
        <span className="star-rating-label">{currentRating}分</span>
      )}
    </div>
  );
}
