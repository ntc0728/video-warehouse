/**
 * Header Context 相关类型定义
 * 单独拆分以满足 react-refresh/only-export-components 约束
 */
import type { ReactNode } from 'react';

export interface HeaderConfig {
  content?: ReactNode | null;
  showFilter?: boolean;
  onFilterClick?: (() => void) | null;
  immersive?: boolean;
}

export interface HeaderActionsValue {
  /** 统一处理「回到首页」:跨页时 navigate + reset;已在 / 时只滚到顶部 */
  goHome: () => void;
  /** 主动触发首页重置（仅跨页用,日常重复点击不再 remount HomePage） */
  triggerHomeReset: () => void;
  setHeaderConfig: (config: HeaderConfig) => () => void;
}

export interface HeaderStateValue {
  centerContent: ReactNode | null;
  showFilter: boolean;
  onFilterClick: (() => void) | null;
  immersive: boolean;
  homeResetKey: number;
}
