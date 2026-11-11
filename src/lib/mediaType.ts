import type { VideoType } from '@/types/video';

/** 详情/播放链路使用的媒体类型口径：电影 or 剧集（综艺/动漫走剧集结构） */
export type MediaType = 'movie' | 'tv';

/**
 * 解析媒体类型，供详情页 / 播放页向 CMS 取数时过滤使用。
 * 优先级：TMDB id 前缀（最可靠）→ Video.type 映射。
 * 入口（VideoCard / HeroBanner / HeroBili / Chart / HomeTopStrip）跳详情时把它放进
 * location.state；详情页网络加载分支优先读 state，缓存命中分支以缓存为准，
 * 两者都拿不到时回退 id 前缀（兼容历史 URL / 直接进入）。
 */
export function resolveMediaType(id?: string | number | null, videoType?: VideoType): MediaType | undefined {
  const sid = id == null ? '' : String(id);
  if (sid.startsWith('tmdb-movie-')) return 'movie';
  if (sid.startsWith('tmdb-tv-')) return 'tv';
  if (videoType === 'movie') return 'movie';
  // 剧集 / 综艺 / 动漫 均为「季 + 集」结构，统一按 tv 处理
  if (videoType === 'tv' || videoType === 'variety' || videoType === 'anime') return 'tv';
  return undefined;
}
