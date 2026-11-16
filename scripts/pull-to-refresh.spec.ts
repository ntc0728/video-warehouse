/**
 * 移动端全局下拉刷新（PTR）手势归属
 *
 * 覆盖：横向/斜向手势不得触发刷新；页面纵向下拉可正常接管；
 * 全屏子页与页内浮层（筛选抽屉）内的下拉不得刷新底层页面。
 *
 * 手势用 PointerEvent 合成（pointerdown → pointermove… → pointerup），
 * 原因：Playwright 没有触摸滑动 API，而真实鼠标拖拽会命中页面自身的
 * 鼠标拖拽/文本选择路径，噪声大于收益。合成事件仍走真实 DOM 路径
 * （composedPath 决定归属）、真实滚动容器与 React 状态，足以锁住回归。
 */
import { type Page } from '@playwright/test';
import { test, expect } from './fixtures/mock-tmdb';

const MOBILE = { viewport: { width: 390, height: 844 } };

interface DragOptions {
  selector: string;
  dx: number;
  dy: number;
  /** false = 只发 pointerdown + pointermove（用于断言拖拽峰值状态） */
  release?: boolean;
}

/** 在给定元素上合成一次触摸指针拖拽（坐标只影响位移量，目标元素决定 DOM 路径） */
async function fireDrag(page: Page, opts: DragOptions) {
  await page.evaluate(({ selector, dx, dy, release }) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`PTR spec: missing ${selector}`);
    const make = (type: string, clientX: number, clientY: number, buttons: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 11,
        pointerType: 'touch',
        isPrimary: true,
        clientX,
        clientY,
        buttons,
        button: 0,
      });
    el.dispatchEvent(make('pointerdown', 0, 0, 1));
    const steps = 8;
    for (let i = 1; i <= steps; i += 1) {
      el.dispatchEvent(make('pointermove', (dx * i) / steps, (dy * i) / steps, 1));
    }
    if (release !== false) el.dispatchEvent(make('pointerup', dx, dy, 0));
  }, opts);
}

async function firePointerUp(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 11,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 0,
        clientY: 0,
        buttons: 0,
      }),
    );
  });
}

/** 页面滚动容器回顶（PTR 只在顶部接管） */
async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('.app-shell__scroll');
    if (el) el.scrollTop = 0;
  });
}

const phaseOf = (page: Page) =>
  page.locator('.ptr-indicator').getAttribute('data-phase');
const dragFlag = (page: Page) =>
  page.locator('.ptr-overlay__indicator').getAttribute('data-drag');

test.describe('PTR 下拉刷新手势归属', () => {
  test.use(MOBILE);

  test('PTR-001: 首页 banner 斜向滑动只翻页，不接管下拉刷新', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-banner__main', { timeout: 15000 });
    await scrollToTop(page);
    await expect(page.locator('.ptr-indicator')).toHaveAttribute('data-phase', 'idle');

    // 横向占优的斜滑：dx=120 / dy=18（真实翻页手势常带纵向抖动）
    await fireDrag(page, { selector: '.hero-banner__main', dx: 120, dy: 18, release: false });
    expect(await dragFlag(page)).not.toBe('true');
    expect(await phaseOf(page)).toBe('idle');

    await firePointerUp(page);
    expect(await phaseOf(page)).toBe('idle');
  });

  test('PTR-002: 页面纵向下拉正常接管，刷新结束后回弹', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home-page__content', { timeout: 15000 });
    await scrollToTop(page);

    await fireDrag(page, { selector: '.home-page__content', dx: 0, dy: 130, release: false });
    await expect.poll(() => dragFlag(page), { timeout: 3000 }).toBe('true');
    await expect.poll(() => phaseOf(page), { timeout: 3000 }).toBe('armed');

    await firePointerUp(page);
    await expect
      .poll(() => phaseOf(page), { timeout: 4000 })
      .toMatch(/refreshing|success/);
    await expect.poll(() => phaseOf(page), { timeout: 8000 }).toBe('idle');
  });

  test('PTR-003: 设置全屏子页内下拉不接管', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.settings-menu-item', { timeout: 10000 });
    await page.locator('.settings-menu-item', { hasText: '外观' }).first().click();
    await page.waitForSelector('.settings-subpage', { timeout: 5000 });
    await scrollToTop(page);

    await fireDrag(page, { selector: '.settings-subpage__body', dx: 0, dy: 130, release: false });
    expect(await dragFlag(page)).not.toBe('true');
    expect(await phaseOf(page)).toBe('idle');

    await firePointerUp(page);
    expect(await phaseOf(page)).toBe('idle');
  });

  test('PTR-004: 筛选抽屉内下拉不刷新底层 Browse 页', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bmb', { timeout: 15000 });
    await scrollToTop(page);

    await page.locator('.bmb-filter-trigger').click();
    const drawer = page.locator('.drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    await fireDrag(page, { selector: '.drawer-body', dx: 0, dy: 130, release: false });
    expect(await dragFlag(page)).not.toBe('true');
    expect(await phaseOf(page)).toBe('idle');

    await firePointerUp(page);
    expect(await phaseOf(page)).toBe('idle');
  });
});
