/**
 * RecordShell — 收藏页 / 历史页共用外壳（桌面 C + 移动 M6）
 *
 * 桌面（≥768px）· 方案 C：
 *   左侧固定筛选栏（标题 + 醒目搜索 + 影视/IPTV 分段 + 状态芯片竖排 + 批量/清除）
 *   右侧卡片主区（children）。侧栏 sticky，卡片滚动时常驻可见。
 *
 * 移动（≤767px）· 方案 M6（滚动折叠双态）：
 *   顶部 sticky 精简栏，初始展开（分段 + 搜索 + 状态芯片横滑）；
 *   向下滚动自动折叠掉状态芯片行，仅留分段 + 搜索 + 筛选按钮；
 *   点筛选按钮可在折叠态临时展开状态芯片；滚回顶部自动复原。
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Search, X, Trash2, ListChecks, SlidersHorizontal } from 'lucide-react';
import StatusTabs from '@/components/StatusTabs';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useCollapseOnScroll } from '@/hooks/useCollapseOnScroll';
import type { LucideIcon } from 'lucide-react';
import './RecordShell.css';

export interface RecordStatusTab {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  count: number;
}

interface RecordShellProps {
  /** 页面标题（我的收藏 / 观看历史） */
  title: string;
  /** 当前分类 tab */
  activeTab: 'video' | 'iptv';
  onTabChange: (tab: 'video' | 'iptv') => void;
  /** 是否有原始数据（决定是否显示搜索 / 操作） */
  showActions: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  batchMode: boolean;
  onToggleBatch: () => void;
  onClearAll: () => void;
  /** 搜索无结果时禁用批量/清除 */
  actionsDisabled: boolean;
  /** 状态筛选芯片（仅影视 tab 传入） */
  statusTabs?: RecordStatusTab[];
  activeStatus?: string;
  onStatusChange?: (key: string) => void;
  /** 页面类名（collection-page / history-page），承接页面级布局样式 */
  pageClassName?: string;
  children: ReactNode;
}

export default function RecordShell({
  title,
  activeTab,
  onTabChange,
  showActions,
  search,
  onSearchChange,
  searchPlaceholder,
  batchMode,
  onToggleBatch,
  onClearAll,
  actionsDisabled,
  statusTabs,
  activeStatus,
  onStatusChange,
  pageClassName = '',
  children,
}: RecordShellProps) {
  const scrollRef = useScrollContainer();
  const collapsed = useCollapseOnScroll(scrollRef);
  const [chipsOpen, setChipsOpen] = useState(false);

  const hasStatus = !!(statusTabs && statusTabs.length > 0 && activeStatus !== undefined && onStatusChange);

  // 滚回顶部（展开态）时复原临时展开的芯片
  useEffect(() => {
    if (!collapsed) setChipsOpen(false);
  }, [collapsed]);

  return (
    <div className={`page-padding record-page ${pageClassName} ${batchMode ? 'batch-mode' : ''}`}>
      <div
        className="record-shell"
        data-collapsed={collapsed ? '' : undefined}
        data-chips-open={chipsOpen ? '' : undefined}
      >
        <aside className="record-aside">
          <h1 className="record-aside__title">{title}</h1>

          <div className="category-segmented record-segmented">
            <button
              type="button"
              className={`category-segmented__item ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => onTabChange('video')}
            >
              影视
            </button>
            <button
              type="button"
              className={`category-segmented__item ${activeTab === 'iptv' ? 'active' : ''}`}
              onClick={() => onTabChange('iptv')}
            >
              IPTV
            </button>
          </div>

          {showActions && (
            <div className="record-search" role="search">
              <div className="record-search__field">
                <Search size={16} className="record-search__icon" aria-hidden="true" />
                <input
                  type="text"
                  className="record-search__input"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label="搜索"
                />
                <button
                  type="button"
                  className="record-search__clear"
                  onClick={() => onSearchChange('')}
                  aria-label="清空搜索"
                  tabIndex={-1}
                  aria-hidden={!search}
                  data-empty={search ? 'false' : 'true'}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* 折叠态筛选按钮：移动端折叠时临时展开状态芯片 */}
          {hasStatus && (
            <button
              type="button"
              className={`record-filter-toggle ${chipsOpen ? 'record-filter-toggle--active' : ''}`}
              onClick={() => setChipsOpen((v) => !v)}
              aria-label="筛选"
              aria-expanded={chipsOpen}
            >
              <SlidersHorizontal size={16} />
            </button>
          )}

          {hasStatus && (
            <StatusTabs
              className="record-status"
              tabs={statusTabs!}
              activeKey={activeStatus!}
              onChange={onStatusChange!}
            />
          )}

          {showActions && (
            <div className="toolbar-actions record-toolbar">
              <button
                type="button"
                className={`toolbar-btn toolbar-btn--icon ${batchMode ? 'toolbar-btn--active' : ''}`}
                disabled={actionsDisabled}
                onClick={onToggleBatch}
                aria-label={batchMode ? '退出批量' : '批量操作'}
              >
                <ListChecks size={16} />
                <span className="toolbar-btn__label">{batchMode ? '退出批量' : '批量操作'}</span>
              </button>
              <button
                type="button"
                className="toolbar-btn toolbar-btn--danger toolbar-btn--icon"
                disabled={actionsDisabled}
                onClick={onClearAll}
                aria-label="清除全部"
              >
                <Trash2 size={16} />
                <span className="toolbar-btn__label">清除全部</span>
              </button>
            </div>
          )}
        </aside>

        <div className="record-main">{children}</div>
      </div>
    </div>
  );
}
