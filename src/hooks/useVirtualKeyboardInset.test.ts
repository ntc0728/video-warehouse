import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVirtualKeyboardInset } from './useVirtualKeyboardInset';

type Listener = () => void;

interface FakeViewport {
  height: number;
  offsetTop: number;
  width: number;
  addEventListener: (type: string, fn: Listener) => void;
  removeEventListener: (type: string, fn: Listener) => void;
}

const listeners = new Map<string, Set<Listener>>();

function installViewport(height: number, offsetTop = 0): FakeViewport {
  listeners.clear();
  const vv: FakeViewport = {
    height,
    offsetTop,
    width: 390,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type, fn) => {
      listeners.get(type)?.delete(fn);
    },
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  return vv;
}

function emit(type: 'resize' | 'scroll'): void {
  listeners.get(type)?.forEach((fn) => fn());
}

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe('useVirtualKeyboardInset', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  afterEach(() => {
    delete (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    document.documentElement.removeAttribute('style');
  });

  it('无键盘：inset=0，可见高度/顶部按 visualViewport 写入', () => {
    installViewport(844, 0);
    renderHook(() => useVirtualKeyboardInset());

    expect(rootVar('--kb-inset')).toBe('0px');
    expect(rootVar('--kb-vvh')).toBe('844px');
    expect(rootVar('--kb-vvtop')).toBe('0px');
  });

  it('键盘弹起：inset=遮挡高度，--kb-vvh=可见高度', () => {
    const vv = installViewport(844, 0);
    renderHook(() => useVirtualKeyboardInset());

    vv.height = 500;
    emit('resize');

    expect(rootVar('--kb-inset')).toBe('344px');
    expect(rootVar('--kb-vvh')).toBe('500px');
    expect(rootVar('--kb-vvtop')).toBe('0px');
  });

  it('iOS 视口平移：inset 扣掉 offsetTop，同时写入 --kb-vvtop', () => {
    const vv = installViewport(844, 0);
    renderHook(() => useVirtualKeyboardInset());

    vv.height = 500;
    vv.offsetTop = 100;
    emit('scroll');

    expect(rootVar('--kb-inset')).toBe('244px');
    expect(rootVar('--kb-vvh')).toBe('500px');
    expect(rootVar('--kb-vvtop')).toBe('100px');
  });

  it('几十像素的工具栏伸缩不抬升浮层（<80px 视为假差）', () => {
    const vv = installViewport(844, 0);
    renderHook(() => useVirtualKeyboardInset());

    vv.height = 784;
    emit('resize');

    expect(rootVar('--kb-inset')).toBe('0px');
    // 可见高度仍如实写入
    expect(rootVar('--kb-vvh')).toBe('784px');
  });

  it('卸载时清掉三个变量，避免残留到其他页', () => {
    installViewport(500, 0);
    const { unmount } = renderHook(() => useVirtualKeyboardInset());
    expect(rootVar('--kb-inset')).toBe('344px');

    unmount();
    expect(rootVar('--kb-inset')).toBe('');
    expect(rootVar('--kb-vvh')).toBe('');
    expect(rootVar('--kb-vvtop')).toBe('');
  });
});
