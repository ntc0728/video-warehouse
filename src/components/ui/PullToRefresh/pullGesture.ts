/**
 * 下拉刷新手势归属解析（纯函数，可单测）
 *
 * 背景：PTR 此前只认「全局滚动容器 + 向下 6px」，于是与页内浮层、内滚列表、
 * 横向手势、输入框选择等交互同时生效（指示器在浮层下面看不见，刷新却真的发生）。
 * 这里把「这次手势归谁」收成一次判定：
 *
 * 1. 起点在浮层内（dialog / listbox / menu / 显式 data-ptr="off"）→ 不接管；
 * 2. 起点在输入类元素内（文本选择 / 光标拖动）→ 不接管；
 * 3. 起点不在页面滚动容器内（portal 到 body 的非浮层节点）→ 不接管；
 * 4. 起点与页面滚动容器之间存在可纵向滚动的内层容器 → 不接管（归内层列表）；
 * 5. 其余情况归页面滚动容器，由调用方再校验 scrollTop 与轴向。
 */

/** 声明式排除：浮层角色 + 页面可主动标记 `data-ptr="off"` */
export const PTR_OPT_OUT_SELECTOR = [
  '[data-ptr="off"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="listbox"]',
  '[role="menu"]',
].join(',');

export type PtrVetoReason = 'overlay' | 'editable' | 'outside-page' | 'inner-scroll';

export interface PtrOwnerResolution {
  /** 本次手势归属的滚动容器；null = 不接管 */
  owner: HTMLElement | null;
  /** owner 为 null 时的原因（便于单测/排查，不参与业务分支） */
  reason?: PtrVetoReason;
}

/** 目标是否属于文本输入 / 可编辑区域（文本选择、光标拖动不应触发刷新） */
export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  return Boolean(
    el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'),
  );
}

/** 元素当前是否是一个「可纵向滚动且内容溢出」的容器 */
export function isVerticalScrollable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const doc = el.ownerDocument;
  const view = doc?.defaultView;
  const computed = view ? view.getComputedStyle(el) : null;
  const overflowY = el.style.overflowY || computed?.overflowY || '';
  if (!/^(auto|scroll|overlay)$/.test(overflowY)) return false;
  return el.scrollHeight - el.clientHeight > 1;
}

/**
 * 解析一次 pointerdown 的手势归属。
 *
 * @param path         事件 composedPath()（须含页面滚动容器，portal 节点也可正确回溯）
 * @param pageScroller 全局滚动容器（`.app-shell__scroll`）；为空时按「不在页面内」处理
 */
export function resolvePtrOwner(
  path: readonly EventTarget[],
  pageScroller: HTMLElement | null,
): PtrOwnerResolution {
  const els = path.filter((n): n is Element => n instanceof Element);
  if (els.length === 0) return { owner: null, reason: 'outside-page' };

  // 1) 浮层 / 声明式排除
  if (els.some((el) => el.matches?.(PTR_OPT_OUT_SELECTOR))) {
    return { owner: null, reason: 'overlay' };
  }

  // 2) 输入框 / 可编辑区域
  if (isEditableElement(els[0])) return { owner: null, reason: 'editable' };

  // 3) 页面滚动容器必须出现在路径上（portal 到 body 的浮层/提示不接管）
  if (!pageScroller) return { owner: null, reason: 'outside-page' };
  const pageIndex = els.indexOf(pageScroller);
  if (pageIndex < 0) return { owner: null, reason: 'outside-page' };

  // 4) 页面滚动容器之下若有可纵向滚动的内层容器，手势归内层（PTR 不抢）
  for (let i = 0; i < pageIndex; i += 1) {
    if (isVerticalScrollable(els[i])) return { owner: null, reason: 'inner-scroll' };
  }

  return { owner: pageScroller };
}
