/**
 * RouteTransition — 路由级过渡动画容器
 *
 * 优先使用浏览器 View Transitions API（Chrome/Edge/Safari 18+），
 * 不支持时自动降级为 CSS animation。
 *
 * View Transitions API 提供原生 cross-fade，无需手动管理 key/animation。
 */
import { type ReactNode } from 'react';
import './RouteTransition.css';

interface RouteTransitionProps {
  children: ReactNode;
}

export default function RouteTransition({ children }: RouteTransitionProps) {
  return (
    <div className="rt-container">
      {children}
    </div>
  );
}
