import { describe, it, expect, vi, beforeEach } from 'vitest';
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

/** 页面刷新回调替身：计数「是否真的触发了刷新」 */
const refreshSpy = vi.fn(() => Promise.resolve());

beforeEach(() => {
  refreshSpy.mockClear();
});

/** 只注册刷新回调、不渲染任何 DOM 的页面替身（模拟真实页面仅注册 hook） */
function Harness({ variant, enabled = true }: { variant?: 'default' | 'settings'; enabled?: boolean }) {
  usePullToRefresh(refreshSpy, { variant, enabled });
  return null;
}

/** 滚动容器（真实 DOM，commit 阶段 ref 就绪）+ 全局浮层 + 页面替身 */
function Tree({
  variant,
  scrollRef,
  enabled,
  showHarness = true,
}: {
  variant: 'default' | 'settings';
  scrollRef: RefObject<HTMLDivElement>;
  enabled?: boolean;
  /** false = 模拟页面卸载（浮层做页面实例切换时的手势/刷新作废） */
  showHarness?: boolean;
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
          {showHarness && <Harness variant={variant} enabled={enabled} />}
        </PullToRefreshProvider>
      </ScrollContainerContext.Provider>
    </>
  );
}

function mount(variant: 'default' | 'settings' = 'settings', enabled = true) {
  const scrollRef = createRef<HTMLDivElement>();
  const utils = render(<Tree variant={variant} scrollRef={scrollRef} enabled={enabled} />);
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

/**
 * 接管条件（PullToRefreshOverlay 的 claim 守卫）。
 * 这些守卫的用意是「不干扰正常交互」：只有「滚动容器在顶部 + 按住 + 明确向下拖」才接管。
 * 任一守卫失效都会被用户感知为误吞点击 / 莫名刷新，故此处分条钉死。
 */
describe('PullToRefreshOverlay · 接管条件', () => {
  const phase = () => document.querySelector('.ptr-indicator')!.getAttribute('data-phase');

  const drag = (target: EventTarget, clientY: number, init: Record<string, unknown> = {}) => {
    firePtr(target, 'pointerdown', { clientY: 0 });
    firePtr(target, 'pointermove', { clientY, ...init });
  };

  it('页面注册 enabled:false 时不接管', () => {
    const { scroll } = mount('settings', false);
    drag(scroll, 120);
    expect(phase()).toBe('idle');
    firePtr(window, 'pointerup');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('滚动容器不在顶部（scrollTop > 0）时不接管', () => {
    const { scroll } = mount();
    scroll.scrollTop = 40;
    drag(scroll, 120);
    expect(phase()).toBe('idle');
  });

  it('位移未超过 6px 的微移不接管（避免误吞轻触）', () => {
    const { scroll } = mount();
    drag(scroll, 5);
    expect(phase()).toBe('idle');
    firePtr(window, 'pointerup');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('无按键的指针移动（buttons=0）不接管', () => {
    const { scroll } = mount();
    drag(scroll, 120, { buttons: 0 });
    expect(phase()).toBe('idle');
  });

  it('桌面端鼠标非左键拖动不接管', () => {
    const { scroll } = mount();
    drag(scroll, 120, { pointerType: 'mouse', buttons: 2 });
    expect(phase()).toBe('idle');
  });

  it('已进入 armed 后向上回移：进度归零回 idle，松手也不触发刷新', () => {
    const { scroll } = mount();
    firePtr(scroll, 'pointerdown', { clientY: 0 });
    firePtr(scroll, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('armed');
    expect(document.querySelector('.ptr-overlay__indicator')!.getAttribute('data-drag')).toBe('true');

    firePtr(scroll, 'pointermove', { clientY: -20 }); // 回移到起点之上 → dy <= 0
    expect(phase()).toBe('idle');

    firePtr(window, 'pointerup');
    expect(phase()).toBe('idle');
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

/**
 * 手势归属 / 生命周期仲裁：浮层、内滚容器、输入框、斜滑、多指、取消、切页。
 * 这些是「PTR 与页面交互同时生效」的根因面，任何一条失效都会回到误触/误刷新。
 */
describe('PullToRefreshOverlay · 手势归属与生命周期', () => {
  const phase = () => document.querySelector('.ptr-indicator')!.getAttribute('data-phase');

  /** 与真实滚动容器同构的最小桩：声明 overflow 且有溢出 */
  const scrollableInner = () => {
    const el = document.createElement('div');
    el.style.overflowY = 'auto';
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 300 });
    return el;
  };

  it('内层可滚动列表上的下拉不接管（手势归列表）', () => {
    const { page } = mount();
    const list = scrollableInner();
    const item = document.createElement('div');
    list.appendChild(item);
    page.appendChild(list);

    firePtr(item, 'pointerdown', { clientY: 0 });
    firePtr(item, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('idle');
  });

  it('浮层（role=dialog / data-ptr=off）内下拉不接管', () => {
    const { page } = mount();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    dialog.appendChild(body);
    page.appendChild(dialog);

    firePtr(body, 'pointerdown', { clientY: 0 });
    firePtr(body, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('idle');

    const optedOut = document.createElement('div');
    optedOut.setAttribute('data-ptr', 'off');
    const content = document.createElement('div');
    optedOut.appendChild(content);
    page.appendChild(optedOut);
    firePtr(content, 'pointerdown', { clientY: 0 });
    firePtr(content, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('idle');
  });

  it('输入框内下拉不接管（文本选择/光标拖动）', () => {
    const { page } = mount();
    const input = document.createElement('input');
    page.appendChild(input);

    firePtr(input, 'pointerdown', { clientY: 0 });
    firePtr(input, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('idle');
  });

  it('斜滑（横向位移占优）不接管；转为纵向后仍可正常接管', () => {
    const { page } = mount();
    firePtr(page, 'pointerdown', { clientX: 0, clientY: 0 });
    // dx=120, dy=20 → 横向手势（Hero/灯箱/横向 chips 的典型斜滑）
    firePtr(page, 'pointermove', { clientX: 120, clientY: 20 });
    expect(phase()).toBe('idle');
    // 同一手势转回纵向 → 接管
    firePtr(page, 'pointermove', { clientX: 0, clientY: 120 });
    expect(phase()).toBe('armed');
    firePtr(window, 'pointercancel');
  });

  it('pointercancel 视为中止：回弹且不刷新', () => {
    const { scroll } = mount();
    firePtr(scroll, 'pointerdown', { clientY: 0 });
    firePtr(scroll, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('armed');

    firePtr(window, 'pointercancel');
    expect(phase()).toBe('idle');
    firePtr(window, 'pointerup');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('第二根手指按下 → 中止本次下拉，且不刷新', () => {
    const { scroll } = mount();
    firePtr(scroll, 'pointerdown', { pointerId: 1, clientY: 0 });
    firePtr(scroll, 'pointermove', { pointerId: 1, clientY: 120 });
    expect(phase()).toBe('armed');

    firePtr(scroll, 'pointerdown', { pointerId: 2, clientY: 100 });
    expect(phase()).toBe('idle');
    firePtr(scroll, 'pointermove', { pointerId: 2, clientY: 300 });
    expect(phase()).toBe('idle');

    firePtr(window, 'pointerup', { pointerId: 2 });
    firePtr(window, 'pointerup', { pointerId: 1 });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('手势中途页面实例切换 → 立即回 idle，松手不刷新', () => {
    const scrollRef = createRef<HTMLDivElement>();
    const { rerender, page } = mount();
    firePtr(page, 'pointerdown', { clientY: 0 });
    firePtr(page, 'pointermove', { clientY: 120 });
    expect(phase()).toBe('armed');

    rerender(<Tree variant="settings" scrollRef={scrollRef} showHarness={false} />);
    expect(phase()).toBe('idle');
    firePtr(window, 'pointerup');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('刷新中切页：作废旧结算，新页（无 handler）保持 idle', async () => {
    const deferred: { resolve: (() => void) | null } = { resolve: null };
    refreshSpy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          deferred.resolve = resolve;
        }),
    );
    const scrollRef = createRef<HTMLDivElement>();
    const { rerender } = mount();
    const indicator = () => document.querySelector('.ptr-indicator')!.getAttribute('data-phase');

    firePtr(screen.getByTestId('page'), 'pointerdown', { clientY: 0 });
    firePtr(screen.getByTestId('page'), 'pointermove', { clientY: 120 });
    firePtr(window, 'pointerup');
    await waitFor(() => expect(refreshSpy).toHaveBeenCalled());
    expect(indicator()).toBe('refreshing');

    // 页面卸载：浮层复位，旧 Promise 的 settle 因代际失效而不得再驱动 UI
    rerender(<Tree variant="settings" scrollRef={scrollRef} showHarness={false} />);
    expect(indicator()).toBe('idle');

    await act(async () => {
      deferred.resolve?.();
      await Promise.resolve();
    });
    expect(indicator()).toBe('idle');
  });
});
