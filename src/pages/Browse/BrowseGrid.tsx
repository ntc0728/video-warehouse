/**
 * 筛选页视频网格
 *
 * 支持两种数据源：
 *  - TMDBVideoItem[]（智能检索）
 *  - CMSResultItem[]（直链搜索，带 cmsSourceName）
 *
 * 网格使用 CSS Grid + auto-fill，自适应 2 → 7 列。
 */
import type { TMDBVideoItem } from '@/types';
import type { Video, VideoType } from '@/types/video';
import { VideoCard } from '@/components/VideoCard';
import { buildImageSrcSet } from '@/services/tmdbService';
import type { CMSResultItem } from './useCMSSearch';
import './Browse.css';

interface BrowseGridProps {
  /** TMDB 搜索结果（智能检索） */
  items?: TMDBVideoItem[];
  /** CMS 搜索结果（直链搜索） */
  cmsItems?: CMSResultItem[];
  /** 搜索关键词，用于标题高亮 */
  query?: string;
  /** 搜索模式 */
  mode?: 'smart' | 'cms';
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

export default function BrowseGrid({ items, cmsItems, query, mode = 'smart' }: BrowseGridProps) {
  // 智能检索模式
  if (mode === 'smart' && items && items.length > 0) {
    return (
      <div className="video-card-grid browse-card-grid">
        {items.map((item) => {
          const posterSrcSet = item.posterPath ? buildImageSrcSet(item.posterPath, ['w185', 'w342', 'w500', 'w780']) : undefined;
          return (
            <VideoCard
              key={item.id}
              video={toVideo(item)}
              rating={item.voteAverage}
              srcSet={posterSrcSet ?? undefined}
              sizes="(max-width: 767px) 33vw, (max-width: 1279px) 16vw, (max-width: 1919px) 12vw, 10vw"
              highlightQuery={query}
            />
          );
        })}
      </div>
    );
  }

  // 直链搜索模式
  if (mode === 'cms' && cmsItems && cmsItems.length > 0) {
    return (
      <div className="video-card-grid browse-card-grid">
        {cmsItems.map((item, idx) => (
          <VideoCard
            key={`${item.cmsSourceName}-${item.id}-${idx}`}
            video={item}
            overlayLabel={item.cmsSourceName}
            highlightQuery={query}
            navigateTo={`/play/${item.id}`}
            navigateState={{ sourceIndex: item.sourceIndex }}
          />
        ))}
      </div>
    );
  }

  return null;
}
