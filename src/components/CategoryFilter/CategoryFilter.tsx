/**
 * 分类筛选组件
 * 根据视频列表动态生成分类标签，支持按类型筛选视频
 */
import { useCallback, useMemo } from 'react';
import { useVideoStore } from '@/stores';
import type { VideoType } from '@/types/video';

const categoryLabels: Record<string, string> = {
  movie: '电影',
  tv: '剧集',
  variety: '综艺',
  anime: '动漫',
};

export default function CategoryFilter() {
  const { videos, filter, setFilter, clearFilter } = useVideoStore();

  /** 从视频列表中提取去重后的类型，生成分类选项 */
  const categories = useMemo(() => {
    const typeSet = new Set<string>();
    videos.forEach(v => {
      if (v.type) typeSet.add(v.type);
    });
    const types = Array.from(typeSet).sort();
    return [
      { key: '', label: '全部' },
      ...types.map(type => ({
        key: type,
        label: categoryLabels[type] || type,
      })),
    ];
  }, [videos]);

  const handleTabChange = useCallback(
    (key: string) => {
      if (key === '') {
        clearFilter();
      } else {
        setFilter({ type: key as VideoType });
      }
    },
    [setFilter, clearFilter]
  );

  return (
    <div className="category-filter">
      <div className="category-tags">
        {categories.map((cat) => (
          <button
            key={cat.key}
            className={`category-tag ${(filter.type || '') === cat.key ? 'active' : ''}`}
            onClick={() => handleTabChange(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
