/**
 * 筛选页视频网格
 *
 * 接收 TMDBVideoItem 列表，映射为 VideoCard 需要的 Video 形状。
 * 网格使用 CSS Grid + auto-fill，自适应 2 → 7 列。
 *
 * 设计:
 *  - 单一职责:仅渲染真实卡片,加载态由父级控制
 *  - 性能:不需要 useMemo
 */
import type { TMDBVideoItem } from '@/stores/useTMDBStore';
import type { Video, VideoType } from '@/types/video';
import { VideoCard } from '@/components/VideoCard';
import { buildImageSrcSet } from '@/services/tmdbService';
import './Browse.css';

interface BrowseGridProps {
  items: TMDBVideoItem[];
}

function toVideo(item: TMDBVideoItem): Video {
  return {
    id: item.id,
    title: item.title,
    cover: item.cover,
    type: item.type as VideoType,
    year: item.year,
    tags: item.tags,
    description: item.description,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function BrowseGrid({ items }: BrowseGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="video-card-grid browse-card-grid">
      {items.map((item) => {
        // 为 TMDB poster 图片生成响应式 srcSet
        const posterSrcSet = item.posterPath ? buildImageSrcSet(item.posterPath, ['w185', 'w342', 'w500', 'w780']) : undefined;
        return (
          <VideoCard
            key={item.id}
            video={toVideo(item)}
            rating={item.voteAverage}
            srcSet={posterSrcSet ?? undefined}
            sizes="(max-width: 767px) 33vw, (max-width: 1279px) 16vw, (max-width: 1919px) 12vw, 10vw"
          />
        );
      })}
    </div>
  );
}
