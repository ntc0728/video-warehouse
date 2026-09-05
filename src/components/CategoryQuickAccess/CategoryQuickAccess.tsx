/**
 * CategoryQuickAccess — 分类快速入口卡片
 * 7 个分类（全部 + 6 类型），彩色渐变背景 + Lucide 图标
 * 移动端只显示 6 个：全部、电影、剧集、综艺、动漫、排行榜
 */
import { LayoutGrid, Film, Tv, Mic2, Sparkles, Trophy, Camera } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useIsWideDesktop } from '@/hooks/useIsWideDesktop';
import './CategoryQuickAccess.css';

export type CategoryKey = 'all' | 'movie' | 'tv' | 'variety' | 'anime' | 'top' | 'documentary';

interface Category {
  key: CategoryKey;
  icon: typeof LayoutGrid;
  label: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { key: 'all', icon: LayoutGrid, label: '全部', color: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  { key: 'movie', icon: Film, label: '电影', color: 'linear-gradient(135deg, #ff4757, #ff6b81)' },
  { key: 'tv', icon: Tv, label: '剧集', color: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
  { key: 'variety', icon: Mic2, label: '综艺', color: 'linear-gradient(135deg, #f97316, #fb923c)' },
  { key: 'anime', icon: Sparkles, label: '动漫', color: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
  { key: 'documentary', icon: Camera, label: '纪录片', color: 'linear-gradient(135deg, #16a34a, #4ade80)' },
  { key: 'top', icon: Trophy, label: '排行榜', color: 'linear-gradient(135deg, #eab308, #facc15)' },
];

// 移动端只显示的分类
const MOBILE_CATEGORIES: CategoryKey[] = ['all', 'movie', 'tv', 'variety', 'anime', 'top'];

interface CategoryQuickAccessProps {
  onCategorySelect: (category: CategoryKey) => void;
}

export default function CategoryQuickAccess({ onCategorySelect }: CategoryQuickAccessProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  // >1280 桌面：入口上移到 hero 上方，图标小一号（xl → lg）
  const isWide = useIsWideDesktop();

  // 移动端只显示 6 个分类
  const displayCategories = isMobile
    ? CATEGORIES.filter(cat => MOBILE_CATEGORIES.includes(cat.key))
    : CATEGORIES;

  return (
    <section className={`category-quick-access${isTV ? ' category-quick-access--tv' : ''}`}>
      <div className="category-quick-access__inner">
        {displayCategories.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <button
              key={cat.key}
              className="category-quick-access__card"
              onClick={() => onCategorySelect(cat.key)}
              aria-label={`分类：${cat.label}`}
            >
              <div className="category-quick-access__icon-wrap" style={{ background: cat.color }}>
                <Icon icon={CatIcon} size={isMobile ? 'md' : isTV ? '2xl' : isWide ? 'lg' : 'xl'} />
              </div>
              <span className="category-quick-access__label">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
