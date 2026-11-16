import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import SourceDetectPill, { type SourceStatusCell, type SourceDetectPillSummary } from './SourceDetectPill';

const cells: SourceStatusCell[] = [
  { index: 0, name: '爱奇艺资源', state: 'ok' },
  { index: 1, name: '茅台资源', state: 'unsupported', detail: '该源不支持关键词搜索' },
  { index: 2, name: '电影天堂', state: 'empty' },
  { index: 3, name: '豆瓣资源', state: 'fail', detail: '网络连接失败，请检查网络或代理设置' },
];

const summary: SourceDetectPillSummary = { ok: 1, empty: 1, unsupported: 1, fail: 1 };

function renderPill(over: Partial<ComponentProps<typeof SourceDetectPill>> = {}) {
  return render(
    <SourceDetectPill
      status="done"
      done={4}
      total={4}
      summary={summary}
      cells={cells}
      {...over}
    />,
  );
}

describe('SourceDetectPill（源状态 = 本次搜索结果口径）', () => {
  it('有数据时状态点为绿，计数回显 done/total', () => {
    const { container } = renderPill();
    expect(container.querySelector('.sdp-dot')?.className).toContain('is-ok');
    expect(container.querySelector('.sdp-count')?.textContent).toBe('4/4');
  });

  it('零有数据时状态点按「失败 / 不支持搜索」降级（不再一律绿）', () => {
    const fail = renderPill({
      summary: { ok: 0, empty: 0, unsupported: 0, fail: 2 },
      cells: [],
    });
    expect(fail.container.querySelector('.sdp-dot')?.className).toContain('is-fail');
    fail.unmount();

    const warn = renderPill({
      summary: { ok: 0, empty: 0, unsupported: 2, fail: 0 },
      cells: [],
    });
    expect(warn.container.querySelector('.sdp-dot')?.className).toContain('is-warn');
  });

  it('hover 展开逐源落点：四种状态各有标记，原因走 title', () => {
    const { container } = renderPill();
    fireEvent.mouseEnter(container.querySelector('.sdp')!);

    expect(document.querySelectorAll('.sdp-cell.is-ok')).toHaveLength(1);
    expect(document.querySelectorAll('.sdp-cell.is-unsupported')).toHaveLength(1);
    expect(document.querySelectorAll('.sdp-cell.is-empty')).toHaveLength(1);
    expect(document.querySelectorAll('.sdp-cell.is-fail')).toHaveLength(1);
    expect(document.querySelector('.sdp-cell.is-unsupported')?.getAttribute('title')).toBe('该源不支持关键词搜索');
    expect(document.querySelector('.sdp-cell.is-fail')?.getAttribute('title')).toContain('网络连接失败');

    // 汇总按非零分类展示（零计数不占位）
    const popText = document.querySelector('.sdp-pop')?.textContent ?? '';
    expect(popText).toContain('总源数');
    expect(popText).toContain('有数据');
    expect(popText).toContain('不支持搜索');
  });

  it('running 态展示轮播文本，且不展开浮层', () => {
    const { container } = renderPill({
      status: 'running',
      done: 1,
      runningText: '正在查询电影天堂…',
    });
    expect(container.querySelector('.sdp-label')?.textContent).toBe('正在查询电影天堂…');
    fireEvent.mouseEnter(container.querySelector('.sdp')!);
    expect(document.querySelector('.sdp-pop')).toBeNull();
  });
});
