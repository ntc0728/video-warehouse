import { describe, expect, it } from 'vitest';
import {
  isEditableElement,
  isVerticalScrollable,
  resolvePtrOwner,
} from './pullGesture';

/** 构造一个「纵向可滚动」的容器（jsdom 不跑布局，尺寸需手动桩） */
function scrollableEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 500 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 300 });
  return el;
}

function plainEl(): HTMLDivElement {
  return document.createElement('div');
}

function mountTree(...nodes: HTMLElement[]): HTMLDivElement {
  const root = document.createElement('div');
  nodes.forEach((n) => root.appendChild(n));
  document.body.appendChild(root);
  return root;
}

describe('resolvePtrOwner · 手势归属', () => {
  it('页面内容（无内滚容器）→ 归页面滚动容器', () => {
    const scroller = scrollableEl();
    const page = plainEl();
    const card = plainEl();
    mountTree(scroller).appendChild(page);
    page.appendChild(card);

    expect(resolvePtrOwner([card, page, scroller], scroller)).toEqual({ owner: scroller });
  });

  it('浮层（role=dialog / data-ptr=off）内 → 不接管', () => {
    const scroller = scrollableEl();
    const page = plainEl();
    const dialog = plainEl();
    dialog.setAttribute('role', 'dialog');
    const btn = plainEl();
    mountTree(scroller).appendChild(page);
    page.appendChild(dialog);
    dialog.appendChild(btn);

    expect(resolvePtrOwner([btn, dialog, page, scroller], scroller).reason).toBe('overlay');

    const off = plainEl();
    off.setAttribute('data-ptr', 'off');
    const inner = plainEl();
    page.appendChild(off);
    off.appendChild(inner);
    expect(resolvePtrOwner([inner, off, page, scroller], scroller).reason).toBe('overlay');
  });

  it('输入框 / contenteditable 内 → 不接管', () => {
    const scroller = scrollableEl();
    const page = plainEl();
    const input = document.createElement('input');
    const editable = plainEl();
    editable.setAttribute('contenteditable', 'true');
    mountTree(scroller).appendChild(page);
    page.append(input, editable);

    expect(isEditableElement(input)).toBe(true);
    expect(resolvePtrOwner([input, page, scroller], scroller).reason).toBe('editable');
    expect(resolvePtrOwner([editable, page, scroller], scroller).reason).toBe('editable');
  });

  it('层间存在可纵向滚动的内层容器 → 不接管（归内层列表）', () => {
    const scroller = scrollableEl();
    const page = plainEl();
    const list = scrollableEl();
    const item = plainEl();
    mountTree(scroller).appendChild(page);
    page.appendChild(list);
    list.appendChild(item);

    expect(isVerticalScrollable(list)).toBe(true);
    expect(resolvePtrOwner([item, list, page, scroller], scroller).reason).toBe('inner-scroll');
  });

  it('内层容器未溢出（不可滚）→ 仍归页面滚动容器', () => {
    const scroller = scrollableEl();
    const page = plainEl();
    const list = plainEl();
    list.style.overflowY = 'auto'; // 声明了 overflow，但内容不溢出
    const item = plainEl();
    mountTree(scroller).appendChild(page);
    page.appendChild(list);
    list.appendChild(item);

    expect(isVerticalScrollable(list)).toBe(false);
    expect(resolvePtrOwner([item, list, page, scroller], scroller)).toEqual({ owner: scroller });
  });

  it('路径不含页面滚动容器（portal 到 body 的非浮层）→ 不接管', () => {
    const scroller = scrollableEl();
    const host = plainEl();
    const node = plainEl();
    mountTree(scroller).appendChild(host);
    host.appendChild(node);

    expect(resolvePtrOwner([node, host], scroller).reason).toBe('outside-page');
    expect(resolvePtrOwner([node, host], null).reason).toBe('outside-page');
  });
});
