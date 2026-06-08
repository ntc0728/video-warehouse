/**
 * 空状态组件
 * 数据为空时展示的占位提示，支持自定义标题、描述和刷新按钮
 */
import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Result } from '@/components/ui';

interface EmptyProps {
  title?: string;
  description?: ReactNode;
  /** 刷新按钮点击回调，传入后显示刷新按钮 */
  onRetry?: () => void;
  /** 刷新按钮文案 */
  retryText?: string;
  /** 是否正在刷新中 */
  isRetrying?: boolean;
}

export default function Empty({
  title = '暂无数据',
  description,
  onRetry,
  retryText = '刷新',
  isRetrying = false,
}: EmptyProps) {
  return (
    <div className="empty-state-wrapper animate-fade-in">
      <Result
        status="waiting"
        title={title}
        description={description}
      />
      {onRetry && (
        <button
          className="empty-retry-btn"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <RefreshCw size={16} className="empty-retry-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          <span>{isRetrying ? '刷新中...' : retryText}</span>
        </button>
      )}
    </div>
  );
}
