/**
 * 骨架 shimmer 原语 — 各页面骨架占位的公共最小积木。
 *
 * 职责边界（2026-09-12 骨架整改）：
 *  - 本组件只提供「一块会扫光的占位矩形」，不含任何页面结构；
 *  - 页面骨架必须由各页自行组合（Browse / Collections / Person / IPTV /
 *    Detail 各有专属 XxxSkeleton，结构对齐该页真实布局、随视口分档），
 *    禁止再造一个跨页复用的「整套通用骨架」；
 *  - 几何（宽高 / 圆角 / 比例）一律由调用方的修饰类或 inline style 决定。
 */
import type { CSSProperties } from 'react';
import './Skeleton.css';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export default function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={`skeleton-block${className ? ` ${className}` : ''}`} style={style} />
  );
}
