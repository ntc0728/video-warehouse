/**
 * 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，防止整个应用崩溃，
 * 展示错误信息和重新加载按钮
 */
import { Component, ReactNode } from 'react';
import { Result, Button } from '@/components/ui';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <Result
            status="error"
            title="页面加载失败"
            description={
              <div className="text-left">
                <p className="text-red-600 mb-2">{this.state.error?.message || '发生了未知错误'}</p>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">
                    <summary className="cursor-pointer">查看详细信息</summary>
                    {this.state.errorInfo.componentStack}
                  </details>
                )}
                <Button color="primary" className="mt-4" onClick={this.handleReload}>
                  重新加载
                </Button>
              </div>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
