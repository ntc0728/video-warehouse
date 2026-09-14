/**
 * 空状态组件
 * 数据为空时展示的占位提示，支持自定义标题、描述和刷新按钮
 */
import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Result } from '@/components/ui';
import type { ResultStatus } from '@/components/ui';
import { Icon } from "@/components/ui/Icon";

interface EmptyProps {
  title?: string;
  description?: ReactNode;
  /**
   * 图标语义（默认 waiting）。
   * 2026-09-14：原为硬编码 waiting —— 网络失败与「搜不到」共用同一副时钟图标，
   * 用户分不清「没有这个内容」和「没加载出来」。加载失败请传 error。
   */
  status?: ResultStatus;
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
  status = 'waiting',
  onRetry,
  retryText = '刷新',
  isRetrying = false,
}: EmptyProps) {
  return (
    <div className="empty-state-wrapper animate-fade-in">
      <Result
        status={status}
        title={title}
        description={description}
      />
      {onRetry && (
        <button
          className="retry-btn"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <Icon icon={RefreshCw} size="sm" className="empty-retry-spin" />
          ) : (
            <Icon icon={RefreshCw} size="sm" />
          )}
          <span>{isRetrying ? '刷新中...' : retryText}</span>
        </button>
      )}
    </div>
  );
}
