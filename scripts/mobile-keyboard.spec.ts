/**
 * 移动端输入框防聚焦放大 + 软键盘弹层几何
 *
 * 1. 防放大：iOS Safari / WKWebView 聚焦「计算字号 < 16px」的表单控件会局部放大视口。
 *    这里在 mobile-web / app / iPad 三种形态下量所有输入类探针的计算字号（≥16px）。
 * 2. 键盘几何：真实软键盘无法在 Playwright 里唤起，改为注入 useVirtualKeyboardInset
 *    输出的三个变量（--kb-inset / --kb-vvh / --kb-vvtop），断言底部弹层、全屏抽屉、
 *    居中弹窗、全屏子页的几何响应。
 */
import { type Page } from '@playwright/test';
import { test, expect } from './fixtures/mock-tmdb';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

const POLL = { intervals: [50, 100, 250, 500] };

/** 量各输入框（含真实顶栏搜索框）的计算字号 */
async function measureInputs(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const out: Record<string, number> = {};
    const fs = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

    const probes: Array<[string, () => HTMLElement]> = [
      ['search-box__input', () => {
        const el = document.createElement('input');
        el.className = 'search-box__input';
        return el;
      }],
      ['playlist-search-input', () => {
        const el = document.createElement('input');
        el.className = 'playlist-search-input';
        return el;
      }],
      ['settings-input', () => {
        const el = document.createElement('input');
        el.className = 'settings-input';
        return el;
      }],
      ['source-modal__input', () => {
        const el = document.createElement('input');
        el.className = 'source-modal__input';
        return el;
      }],
      ['grouppicker__search', () => {
        const el = document.createElement('input');
        el.className = 'grouppicker__search';
        return el;
      }],
      ['browse-pagination__jump-input', () => {
        const el = document.createElement('input');
        el.className = 'browse-pagination__jump-input';
        return el;
      }],
      ['proxy-setup__field > input', () => {
        const wrap = document.createElement('div');
        wrap.className = 'proxy-setup__field';
        wrap.appendChild(document.createElement('input'));
        return wrap;
      }],
      ['textarea', () => document.createElement('textarea')],
    ];

    for (const [name, make] of probes) {
      const el = make();
      document.body.appendChild(el);
      const target = name === 'proxy-setup__field > input' ? el.querySelector('input')! : el;
      out[name] = fs(target);
      el.remove();
    }

    const header = document.querySelector('.search-box__input');
    out.headerSearch = header ? fs(header) : 0;
    return out;
  });
}

async function waitHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await expect(page.locator('.search-box__input')).toBeVisible({ timeout: 10000 });
}

/** 注入键盘变量（模拟 iOS 键盘：布局视口不变，可见区上移/缩小） */
async function injectKeyboard(
  page: Page,
  vars: { inset: number; vvh: number; vvtop?: number },
): Promise<void> {
  await page.evaluate(({ inset, vvh, vvtop }) => {
    const root = document.documentElement.style;
    root.setProperty('--kb-inset', `${inset}px`);
    root.setProperty('--kb-vvh', `${vvh}px`);
    root.setProperty('--kb-vvtop', `${vvtop ?? 0}px`);
  }, vars);
}

async function assertAllInputs16(page: Page): Promise<void> {
  const sizes = await measureInputs(page);
  for (const [name, size] of Object.entries(sizes)) {
    expect(size, `${name} 计算字号`).toBeGreaterThanOrEqual(16);
  }
}

test.describe('移动端输入框防聚焦放大', () => {
  test.describe('mobile-web', () => {
    test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true, isMobile: true });

    test('MOBILE-KB-001: 全部输入类计算字号 ≥16px', async ({ page }) => {
      await waitHome(page);
      expect(await page.evaluate(() => document.documentElement.dataset.device)).toBe('mobile-web');
      await assertAllInputs16(page);
    });
  });

  test.describe('app', () => {
    test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true, isMobile: true });

    test('MOBILE-KB-002: app（WebView）顶栏搜索框也不再低于 16px', async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as Record<string, unknown>).Capacitor = {
          isNativePlatform: () => true,
          getPlatform: () => 'ios',
        };
      });
      await waitHome(page);
      expect(await page.evaluate(() => document.documentElement.dataset.device)).toBe('app');
      await assertAllInputs16(page);
    });
  });

  test.describe('iPad web', () => {
    test.use({ viewport: { width: 820, height: 1180 }, userAgent: IPAD_UA, hasTouch: true, isMobile: true });

    test('MOBILE-KB-003: 平板（无 data-device）由 pointer:coarse 兜底', async ({ page }) => {
      await waitHome(page);
      await assertAllInputs16(page);
    });
  });
});

test.describe('软键盘弹层几何', () => {
  test.describe('手机（iOS 键盘路径）', () => {
    test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true, isMobile: true });

    test('MOBILE-KB-004: 底部弹层贴在键盘上沿且高度不超可见区', async ({ page }) => {
      await waitHome(page);
      await injectKeyboard(page, { inset: 320, vvh: 524 });

      const geo = await page.evaluate(() => {
        const make = (cls: string) => {
          const el = document.createElement('div');
          el.className = cls;
          el.style.animation = 'none';
          // 移动端规则里 transform: translateY(100%) 是滑出起点（真实组件靠动画归零），
          // 探针关掉动画后必须一并清掉，否则量到的是「滑出屏幕」的位置。
          el.style.transform = 'none';
          el.style.height = '600px';
          document.body.appendChild(el);
          return el;
        };
        const sheet = make('bottomsheet-content-animate');
        const modal = make('modal-content-animate');
        const sheetRect = sheet.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();
        const sheetMaxH = parseFloat(getComputedStyle(sheet).maxHeight);
        const modalMaxH = parseFloat(getComputedStyle(modal).maxHeight);
        sheet.remove();
        modal.remove();
        return {
          sheetBottom: sheetRect.bottom,
          sheetHeight: sheetRect.height,
          sheetMaxH,
          modalBottom: modalRect.bottom,
          modalHeight: modalRect.height,
          modalMaxH,
        };
      });

      // 可见底 = 844 - 320 = 524
      expect(geo.sheetBottom).toBeCloseTo(524, 0);
      expect(geo.modalBottom).toBeCloseTo(524, 0);
      // 高度被可见区限制（不得把顶部顶出屏幕）
      expect(geo.sheetMaxH).toBeLessThanOrEqual(524);
      expect(geo.modalMaxH).toBeLessThanOrEqual(524);
      expect(geo.sheetHeight).toBeLessThanOrEqual(524);
      expect(geo.modalHeight).toBeLessThanOrEqual(524);
    });

    test('MOBILE-KB-005: 全屏抽屉缩到键盘上沿', async ({ page }) => {
      await page.goto('/browse', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.bmb', { timeout: 15000 });
      await injectKeyboard(page, { inset: 320, vvh: 524 });

      await page.locator('.bmb-filter-trigger').click();
      const drawer = page.locator('.drawer-content').first();
      await expect(drawer).toBeVisible({ timeout: 5000 });

      const rect = await drawer.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      });
      expect(rect.top).toBeCloseTo(0, 0);
      expect(rect.bottom).toBeCloseTo(524, 0);
      expect(rect.height).toBeCloseTo(524, 0);
    });

    test('MOBILE-KB-006: 全屏子页 body 底部让出键盘高度', async ({ page }) => {
      await page.goto('/source-checker', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.sub-page__body', { timeout: 10000 });
      await injectKeyboard(page, { inset: 320, vvh: 524 });

      const padding = await page
        .locator('.sub-page__body')
        .evaluate((el) => getComputedStyle(el).paddingBottom);
      expect(parseFloat(padding)).toBeCloseTo(320, 0);
    });

    test('MOBILE-KB-007: 搜索下拉高度跟随可见视口（不被键盘遮）', async ({ page }) => {
      await waitHome(page);
      // 替换 visualViewport：模拟键盘弹起后「可见区 300px + 顶部平移 100px」
      await page.evaluate(() => {
        const fake = {
          width: 390,
          height: 300,
          offsetTop: 100,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
      });

      await page.locator('.search-box__input').click();
      const dropdown = page.locator('.search-box-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 5000 });
      await expect
        .poll(
          () => dropdown.evaluate((el) => parseFloat(getComputedStyle(el).maxHeight)),
          { ...POLL, timeout: 3000 },
        )
        .toBeGreaterThan(0);

      const metrics = await dropdown.evaluate((el) => {
        const input = document.querySelector('.search-box__input')!;
        const visibleBottom =
          (window.visualViewport?.offsetTop ?? 0) +
          (window.visualViewport?.height ?? window.innerHeight);
        return {
          maxH: parseFloat(getComputedStyle(el).maxHeight),
          available: visibleBottom - input.getBoundingClientRect().bottom - 16,
        };
      });
      expect(metrics.maxH).toBeLessThanOrEqual(metrics.available + 1);
      // 旧实现按 innerHeight（844）算 → 会被下拉上限（约 360）封顶；新实现必须明显更矮
      expect(metrics.maxH).toBeLessThanOrEqual(330);
    });
  });

  test.describe('平板（iPad 居中弹窗）', () => {
    test.use({ viewport: { width: 820, height: 1180 }, userAgent: IPAD_UA, hasTouch: true, isMobile: true });

    test('MOBILE-KB-008: 居中弹窗在键盘上方的可见区重新居中', async ({ page }) => {
      await waitHome(page);
      await injectKeyboard(page, { inset: 320, vvh: 860, vvtop: 0 });

      const geo = await page.evaluate(() => {
        const el = document.createElement('div');
        el.className = 'modal-content-animate';
        el.style.animation = 'none';
        el.style.height = '600px';
        document.body.appendChild(el);
        const r = el.getBoundingClientRect();
        const maxH = parseFloat(getComputedStyle(el).maxHeight);
        el.remove();
        return { centerY: r.top + r.height / 2, maxH };
      });

      // 可见区 860 高 → 中心 430（不再是布局视口 1180/2=590）
      expect(geo.centerY).toBeCloseTo(430, 0);
      expect(geo.maxH).toBeLessThanOrEqual(860);
    });
  });
});
