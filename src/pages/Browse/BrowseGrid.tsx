/**
 * 筛选页视频网格
 *
 * 接收 TMDBVideoItem 列表，映射为 VideoCard 需要的 Video 形状。
 * 网格使用 CSS Grid + auto-fill，自适应 2 → 7 列。
 */
import { VideoCard } from '@/components/VideoCard';
import type { TMDBVideoItem } from '@/stores/useTMDBStore';
import type { Video, VideoType } from '@/types/video';
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
    <div className="browse-grid">
      {items.map((item, idx) => (
        <VideoCard
          key={item.id}
          video={toVideo(item)}
          index={idx}
          rating={item.voteAverage}
        />
      ))}
    </div>
  );
}
