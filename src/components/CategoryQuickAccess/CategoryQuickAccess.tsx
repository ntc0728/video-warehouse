/**
 * CategoryQuickAccess — 分类快捷入口（全端彩色圆卡，点击跳 /browse）
 * ───────────────────────────────────────────────────────────────────
 * 历史：曾有宽屏 mega 面板三件套（CategoryQuickAccessNav 顶栏 chips /
 * CategoryQuickAccessPanel overlay / useCategoryOverlayStore + categoryPanelData），
 * 随 2026-09-30「首页大屏整改」（4a986d2，CategoryInlineBoard 合集行接管分类入口）
 * 退役；本文件与 AppLayout 挂载点、CSS ≥1024 分支于 2026-10-11 死代码清理一并删除。
 * home.spec 1.3c 保留「.cqa-nav / .cqa-overlay 恒不存在」的退役回归锁。
 */
import {
  Camera,
  Film,
  LayoutGrid,
  Mic2,
  Sparkles,
  Trophy,
  Tv,
} from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
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

/** 全端彩色圆卡入口（宽屏首页由 CategoryInlineBoard 合集行接管后本组件不再渲染，
 *  条件见 Home 的 isWide 分支） */
export default function CategoryQuickAccess({ onCategorySelect }: CategoryQuickAccessProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  const displayCategories = isMobile
    ? CATEGORIES.filter((cat) => MOBILE_CATEGORIES.includes(cat.key))
    : CATEGORIES;

  return (
    <section className="category-quick-access">
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
                <Icon icon={CatIcon} size={isMobile ? 'md' : isTV ? '2xl' : 'xl'} />
              </div>
              <span className="category-quick-access__label">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
