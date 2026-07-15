/**
 * 网络错误提示组件
 * 展示网络请求失败信息，支持手动刷新重试
 */
import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './NetworkError.css';

interface NetworkErrorProps {
  error?: Error | null;
  onRetry?: () => void;
  isLoading?: boolean;
  message?: string;
  subtitle?: string;
}

export default function NetworkError({
  error,
  onRetry,
  isLoading = false,
  message,
  subtitle,
}: NetworkErrorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultMessage = message || '网络请求失败';

  return (
    <div className="network-error-container">
      <div className="network-error-icon">
        <AlertTriangle size={32} />
      </div>

      <div className="network-error-content">
        <div className="network-error-title">
          {defaultMessage}
        </div>

        {subtitle && (
          <div className="network-error-subtitle">
            {subtitle}
          </div>
        )}

        {error && (
          <div className="network-error-details">
            <button
              className="network-error-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '收起详情' : '查看详情'}
            </button>

            {isExpanded && (
              <div className="network-error-stack">
                <div className="network-error-message">{error.message}</div>
                {error.stack && (
                  <pre className="network-error-stack-trace">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {onRetry && (
        <button
          className="retry-btn"
          onClick={onRetry}
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw size={16} className="network-error-spin-icon" />
          ) : (
            <RefreshCw size={16} />
          )}
          <span>{isLoading ? '刷新中...' : '刷新'}</span>
        </button>
      )}
    </div>
  );
}

interface NetworkErrorInlineProps {
  error?: Error | null;
  onRetry?: () => void;
  isLoading?: boolean;
  message?: string;
}

/** 行内网络错误组件，适用于紧凑布局场景 */
export function NetworkErrorInline({
  error,
  onRetry,
  isLoading = false,
  message,
}: NetworkErrorInlineProps) {
  return (
    <div className="network-error-inline">
      <span className="network-error-inline-icon">
        <AlertTriangle size={16} />
      </span>
      <span className="network-error-inline-text">
        {message || error?.message || '网络错误'}
      </span>
      {onRetry && (
        <button
          className="network-error-inline-retry"
          onClick={onRetry}
          disabled={isLoading}
        >
          {isLoading ? '刷新中...' : '刷新'}
        </button>
      )}
    </div>
  );
}
