/**
 * 加载状态组件
 * 展示加载进度条和提示文字，支持全屏和内联两种模式
 */
import { ProgressBar } from '@/components/ui';

interface LoadingProps {
  tip?: string;
  fullScreen?: boolean;
}

export default function Loading({ tip = '加载中...', fullScreen = false }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <ProgressBar />
        <span>{tip}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <ProgressBar />
      <span>{tip}</span>
    </div>
  );
}
