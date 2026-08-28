import { describe, it, expect } from 'vitest';
import { render, waitFor, screen, act } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { ScrollContainerContext } from '@/hooks/useScrollContext';
import { PullToRefreshProvider, usePullToRefresh } from './PullToRefreshContext';
import { PullToRefreshOverlay } from './PullToRefreshOverlay';

// jsdom 的 PointerEvent 支持不稳定，用裸 Event + 手动字段确保 overlay 的
// addEventListener('pointerdown'/'pointermove') 能真实收到事件。
// 注意：当前实现要求 pointermove 带 buttons 真值（e.buttons）才接管下拉，
// 故默认补 buttons:1 模拟「按住拖动中」；如需模拟点击/轻触可在 init 覆盖为 0。
function firePtr(el: EventTarget, type: string, init: Record<string, unknown> = {}) {
  const evt = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(evt, {
    clientX: 0,
    clientY: 0,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'touch',
    ...init,
  });
  act(() => {
    el.dispatchEvent(evt);
  });
  return evt;
}

/** 只注册刷新回调、不渲染任何 DOM 的页面替身（模拟真实页面仅注册 hook） */
function Harness({ variant }: { variant?: 'default' | 'settings' }) {
  usePullToRefresh(() => Promise.resolve(), { variant, enabled: true });
  return null;
}

/** 滚动容器（真实 DOM，commit 阶段 ref 就绪）+ 全局浮层 + 页面替身 */
function Tree({
  variant,
  scrollRef,
}: {
  variant: 'default' | 'settings';
  scrollRef: RefObject<HTMLDivElement>;
}) {
  return (
    <>
      <div ref={scrollRef} data-testid="scroll">
        <div data-testid="page" />
      </div>
      <ScrollContainerContext.Provider
        value={scrollRef as unknown as RefObject<HTMLElement | null>}
      >
        <PullToRefreshProvider>
          <PullToRefreshOverlay />
          <Harness variant={variant} />
        </PullToRefreshProvider>
      </ScrollContainerContext.Provider>
    </>
  );
}

function mount(variant: 'default' | 'settings' = 'settings') {
  const scrollRef = createRef<HTMLDivElement>();
  const utils = render(<Tree variant={variant} scrollRef={scrollRef} />);
  return {
    ...utils,
    scroll: screen.getByTestId('scroll') as HTMLDivElement,
    page: screen.getByTestId('page') as HTMLDivElement,
  };
}

describe('PullToRefreshOverlay', () => {
  it('下拉越过阈值进入 armed，且页面内容绝不发生位移', () => {
    const { scroll, page } = mount();
    const indicator = () => document.querySelector('.ptr-overlay__indicator')!;

    firePtr(scroll, 'pointerdown', { clientY: 0 });
    // 下拉 120px（渐进阻尼 → 约 66px，> THRESHOLD=52 → armed）
    firePtr(scroll, 'pointermove', { clientY: 120 });

    // data-phase 在指示器本体（.ptr-indicator）上，data-drag 在浮层位移容器上
    expect(document.querySelector('.ptr-indicator')!.getAttribute('data-phase')).toBe('armed');
    expect(indicator().getAttribute('data-drag')).toBe('true');
    // 关键约束：页面内容不得有任何 transform（页面绝不下移）
    expect(page.style.transform).toBe('');
  });

  it('越过阈值松手触发 refreshing，并在 resolve 后自动回弹 idle', async () => {
    const { scroll } = mount();
    const phase = () => document.querySelector('.ptr-indicator')!.getAttribute('data-phase');

    firePtr(scroll, 'pointerdown', { clientY: 0 });
    firePtr(scroll, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('armed');

    firePtr(window, 'pointerup');
    expect(phase()).toBe('refreshing');

    // onRefresh resolve → success 停留 600ms → 自动回弹 idle（同时消费定时器，避免 act 警告）
    await waitFor(() => expect(phase()).toBe('success'), { timeout: 2000 });
    await waitFor(() => expect(phase()).toBe('idle'), { timeout: 2000 });
  });

  it('未越过阈值松手回到 idle（不触发刷新）', () => {
    const { scroll } = mount();
    const phase = () => document.querySelector('.ptr-indicator')!.getAttribute('data-phase');

    firePtr(scroll, 'pointerdown', { clientY: 0 });
    // 仅下拉 50px（渐进阻尼 → 约 35px，< THRESHOLD=52 → pulling）
    firePtr(scroll, 'pointermove', { clientY: 50 });
    expect(phase()).toBe('pulling');

    firePtr(window, 'pointerup');
    expect(phase()).toBe('idle');
  });

  it('变体切换（settings↔default）实时生效，无需先下拉', async () => {
    const { rerender } = mount('settings');
    const indicator = () => document.querySelector('.ptr-overlay__indicator')!;

    expect(indicator().className).toContain('ptr-overlay__indicator--settings');

    const scrollRef = createRef<HTMLDivElement>();
    rerender(
      <Tree variant="default" scrollRef={scrollRef} />,
    );

    await waitFor(() => {
      expect(indicator().className).toContain('ptr-overlay__indicator--default');
    });
    expect(indicator().className).not.toContain('ptr-overlay__indicator--settings');
  });
});
