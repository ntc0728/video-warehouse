import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import StatusTabs from '@/components/StatusTabs';
import { Icon } from '@/components/ui/Icon';
import type { LucideIcon } from 'lucide-react';
import './RecordShell.css';
import './BatchActionBar.css';

export interface RecordStatusTab {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  count: number;
}

/** 融合分类栏配置（历史页「综合/视频/IPTV」）：传入时替代「影视/IPTV 分段 + 状态筛选」 */
export interface FusedCategories {
  tabs: RecordStatusTab[];
  active: string;
  onChange: (key: string) => void;
}

/** 桌面端内嵌筛选条配置（方案 C，2026-09-06）：状态 chips 常驻 + 排序弹层 */
export interface RecordInlineFilter {
  statusOptions: { key: string; label: string; color?: string }[];
  statusFilter: string;
  onStatusChange: (key: string) => void;
  sortOptions: { value: string; label: string }[];
  sortBy: string;
  onSortChange: (value: string) => void;
}

interface RecordShellProps {
  /** 当前分类 tab（非融合模式下的「影视/IPTV」分段控件使用） */
  activeTab?: 'video' | 'iptv';
  onTabChange?: (tab: 'video' | 'iptv') => void;
  /** 状态筛选标签页（仅影视 tab 传入） */
  statusTabs?: RecordStatusTab[];
  activeStatus?: string;
  onStatusChange?: (key: string) => void;
  /** 融合分类栏（历史页）：渲染 StatusTabs 替代「影视/IPTV 分段 + 状态筛选」，不传时保持原行为 */
  fusedCategories?: FusedCategories;
  /** 桌面端内嵌筛选条：分隔线 + 状态 chips + 排序弹层（≥768 非 app 显示；
   *  融合 tab 为 IPTV 时整段隐藏——状态/排序仅作用于影视项，IPTV 下无效） */
  inlineFilter?: RecordInlineFilter;
  /** 「⋯」溢出菜单内容（仅空间不足的桌面断点 768–1199 显示；≥1200 由 CSS 恢复
   *  直接显示 actions 里的清空按钮、隐藏本菜单） */
  overflowActions?: ReactNode;
  /** 附加操作按钮组（历史页：更多筛选/清空历史/批量管理），渲染在 record-aside 右侧 */
  actions?: ReactNode;
  /** 页面类名（collection-page / history-page），承接页面级布局样式 */
  pageClassName?: string;
  /** 外部传入的容器 ref（用于 TV 空间导航） */
  containerRef?: Ref<HTMLDivElement>;
  /** 批量管理模式 */
  isBatchMode?: boolean;
  children: ReactNode;
}

/** 点击外部/Esc 关闭的弹层容器（排序菜单与「⋯」溢出菜单共用） */
function usePopoverClose(open: boolean, onClose: () => void) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);
  return wrapRef;
}

/** 排序弹层（方案 C）：胶囊按钮 + chips 列表弹层，替代「更多筛选」面板里的常驻排序行 */
function SortMenu({ sortOptions: options, sortBy, onSortChange }: Pick<RecordInlineFilter, 'sortOptions' | 'sortBy' | 'onSortChange'>) {
  const [open, setOpen] = useState(false);
  const wrapRef = usePopoverClose(open, () => setOpen(false));
  const current = options.find((o) => o.value === sortBy);
  return (
    <div className="record-sort-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`record-filter-chip record-sort-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon icon={ArrowUpDown} size="xs" />
        排序：{current?.label ?? sortBy}
      </button>
      {open && (
        <div className="record-pop" role="menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`record-pop-item${sortBy === opt.value ? ' is-active' : ''}`}
              onClick={() => { onSortChange(opt.value); setOpen(false); }}
              role="menuitem"
            >
              {opt.label}
              {sortBy === opt.value && <span className="record-pop-item__tick" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 「⋯」溢出菜单：低频/危险操作收纳——仅空间不足的桌面断点（768–1199）显示，
 *  ≥1200 空间充足时由 CSS 恢复直接显示清空按钮、隐藏本菜单（用户拍板 2026-09-06） */
function OverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = usePopoverClose(open, () => setOpen(false));
  return (
    <div className="record-overflow-wrap" ref={wrapRef}>
      <button
        type="button"
        className="action-btn record-overflow-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="更多操作"
      >
        <Icon icon={MoreHorizontal} size="sm" />
      </button>
      {open && (
        <div className="record-pop record-pop--right" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function RecordShell({
  activeTab = 'video',
  onTabChange,
  statusTabs,
  activeStatus,
  onStatusChange,
  fusedCategories,
  inlineFilter,
  overflowActions,
  actions,
  pageClassName = '',
  containerRef,
  isBatchMode = false,
  children,
}: RecordShellProps) {
  const hasStatus = !!(statusTabs && statusTabs.length > 0 && activeStatus !== undefined && onStatusChange);
  const hasFused = !!(fusedCategories && fusedCategories.tabs.length > 0);
  // 方案 C（E-②）：IPTV tab 下状态/排序仅作用于影视项，显示无效筛选是认知噪音 → 整段隐藏
  const showInlineFilter = !!(inlineFilter && (!hasFused || fusedCategories!.active !== 'iptv'));

  return (
    <div ref={containerRef} className={`page-padding record-page${isBatchMode ? ' batch-mode' : ''} ${pageClassName}`}>
      <div className="record-shell" style={{ '--stagger': 0 } as CSSProperties}>
        <div className="record-main">
          <aside className="record-aside">
            {hasFused ? (
              <div className="record-filter-row record-filter-row--fused">
                <StatusTabs
                  className="record-status record-status--fused"
                  tabs={fusedCategories.tabs}
                  activeKey={fusedCategories.active}
                  onChange={fusedCategories.onChange}
                />
                {showInlineFilter && (
                  <div className="record-inline-filter">
                    <span className="record-inline-divider" aria-hidden="true" />
                    {inlineFilter.statusOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`record-filter-chip record-filter-chip--status${inlineFilter.statusFilter === opt.key ? ' is-active' : ''}`}
                        style={opt.color ? ({ '--chip-dot-color': opt.color } as CSSProperties) : undefined}
                        onClick={() => inlineFilter.onStatusChange(opt.key)}
                      >
                        <span className="record-filter-chip__dot" aria-hidden="true" />
                        {opt.label}
                      </button>
                    ))}
                    <SortMenu
                      sortOptions={inlineFilter.sortOptions}
                      sortBy={inlineFilter.sortBy}
                      onSortChange={inlineFilter.onSortChange}
                    />
                  </div>
                )}
                {actions && <div className="record-actions">{actions}</div>}
                {overflowActions && <OverflowMenu>{overflowActions}</OverflowMenu>}
              </div>
            ) : (
              <>
                <div className="record-filter-row">
                  <div className="category-segmented record-segmented">
                    <button
                      type="button"
                      className={`category-segmented__item ${activeTab === 'video' ? 'active' : ''}`}
                      onClick={() => onTabChange?.('video')}
                    >
                      影视
                    </button>
                    <button
                      type="button"
                      className={`category-segmented__item ${activeTab === 'iptv' ? 'active' : ''}`}
                      onClick={() => onTabChange?.('iptv')}
                    >
                      IPTV
                    </button>
                  </div>

                  <div className={`record-status-group${!hasStatus ? ' record-status-group--hidden' : ''}`}>
                    {hasStatus && (
                      <StatusTabs
                        className="record-status"
                        tabs={statusTabs!}
                        activeKey={activeStatus!}
                        onChange={onStatusChange!}
                      />
                    )}
                  </div>
                </div>
                {actions && <div className="record-actions">{actions}</div>}
              </>
            )}
          </aside>

          {children}
        </div>
      </div>
    </div>
  );
}
