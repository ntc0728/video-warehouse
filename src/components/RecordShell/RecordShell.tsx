import type { CSSProperties, ReactNode } from 'react';
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

interface RecordShellProps {
  /** 当前分类 tab */
  activeTab: 'video' | 'iptv';
  onTabChange: (tab: 'video' | 'iptv') => void;
  /** 状态筛选标签页（仅影视 tab 传入） */
  statusTabs?: RecordStatusTab[];
  activeStatus?: string;
  onStatusChange?: (key: string) => void;
  /** 页面类名（collection-page / history-page），承接页面级布局样式 */
  pageClassName?: string;
  children: ReactNode;
}

export default function RecordShell({
  activeTab,
  onTabChange,
  statusTabs,
  activeStatus,
  onStatusChange,
  pageClassName = '',
  children,
}: RecordShellProps) {
  const hasStatus = !!(statusTabs && statusTabs.length > 0 && activeStatus !== undefined && onStatusChange);

  return (
    <div className={`page-padding record-page page-transition-enter--stagger ${pageClassName}`}>
      <div className="record-shell" style={{ '--stagger': 0 } as CSSProperties}>
        <div className="record-main">
          <aside className="record-aside">
            <div className="record-filter-row">
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
          </aside>

          {children}
        </div>
      </div>
    </div>
  );
}
