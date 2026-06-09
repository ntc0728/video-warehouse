/**
 * 滚动容器 Context
 *
 * AppLayout 在最外层 CustomScrollbar 上创建 ref，并通过 Context 向下共享。
 * 子页面（Home / Browse / IPTV / Detail 等）通过 useScrollContainer() 拿到同一个
 * 滚动容器 ref，用于：
 *  - useScrollRestore：保存/恢复滚动位置
 *  - 主动调用 scrollTo（IPTV 切换分组、usePagination 跳页等）
 *  - BackToTopButton：监听 scrollTop,超过阈值时显示按钮
 *
 * 替换旧的 `document.querySelector('main')` 死代码 — 项目中根本不存在 <main> 元素。
 */
import { createContext, useContext, type RefObject } from 'react';

export type ScrollContainerRef = RefObject<HTMLElement | null>;

export const ScrollContainerContext = createContext<ScrollContainerRef | null>(null);

export function useScrollContainer(): ScrollContainerRef {
  return useContext(ScrollContainerContext) ?? { current: null };
}
