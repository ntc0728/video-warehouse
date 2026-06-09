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
    <div className="video-card-grid">
      {items.map((item) => (
        <VideoCard
          key={item.id}
          video={toVideo(item)}
          rating={item.voteAverage}
        />
      ))}
    </div>
  );
}
