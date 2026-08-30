import type { CSSProperties, ReactNode, Ref } from 'react';
import StatusTabs from '@/components/StatusTabs';
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

export default function RecordShell({
  activeTab = 'video',
  onTabChange,
  statusTabs,
  activeStatus,
  onStatusChange,
  fusedCategories,
  actions,
  pageClassName = '',
  containerRef,
  isBatchMode = false,
  children,
}: RecordShellProps) {
  const hasStatus = !!(statusTabs && statusTabs.length > 0 && activeStatus !== undefined && onStatusChange);
  const hasFused = !!(fusedCategories && fusedCategories.tabs.length > 0);

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
                {actions && <div className="record-actions">{actions}</div>}
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
