/**
 * BrowseHeader — 筛选页 Header
 *
 * 结构（3 列 grid）：
 *  - 左：分类（纯显示，不可点击；显示当前 category 名 + "分类"标签）
 *  - 中：搜索框（公共 SearchBox variant="browse"，居中显示；从 URL ?q= 同步）
 *  - 右：结果数（loading 中显示"加载中…"）
 *
 * 设计说明：
 *  - 原"返回首页"按钮已删除（用户需求）。回首页改用顶部 logo 或移动端 TabBar 首页按钮。
 *  - 分类区域视觉上复用原 back 按钮的胶囊 + 描边样式，保持视觉一致；不可交互。
 *  - 搜索框与顶部导航共用 SearchBox 组件，自动同步 URL ?q= 参数。
 *
 * 主题感知：light/dark 自动适配。
 */
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_LABELS } from './constants';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import SearchBox from '@/components/SearchBox';
import './Browse.css';

interface BrowseHeaderProps {
  category: CategoryKey;
  totalResults: number;
  isLoading: boolean;
}

export default function BrowseHeader({ category, totalResults, isLoading }: BrowseHeaderProps) {
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';

  return (
    <header className="browse-header">
      {/* 左：分类（纯显示；不响应点击，复用原 back 的胶囊 + 描边样式） */}
      <div className="browse-header__category" aria-label={`当前分类：${CATEGORY_LABELS[category] ?? '筛选'}`}>
        <span className="browse-header__category-label">分类</span>
        <span className="browse-header__category-name">
          {CATEGORY_LABELS[category] ?? '筛选'}
        </span>
      </div>

      {/* 中：搜索框（居中显示；用公共 SearchBox 组件） */}
      <div className="browse-header__search">
        <SearchBox variant="browse" defaultValue={urlQ} />
      </div>

      {/* 右：结果数 */}
      <div className="browse-header__count" aria-live="polite">
        {isLoading ? (
          <span className="browse-header__count-loading">加载中…</span>
        ) : (
          <span>共 {totalResults.toLocaleString('zh-CN')} 条</span>
        )}
      </div>
    </header>
  );
}
