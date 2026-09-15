/**
 * 启动骨架 (#boot-splash) 测试用例
 * 覆盖: BOOT-001 ~ BOOT-013
 *
 * 被测对象是 index.html 内联脚本（React 首帧前执行的死 DOM），验证两点契约：
 *   1. 路由感知：data-shape 与 location 对齐（含 HashRouter 兜底、TV UA 档）；
 *   2. 视口填充：除 play/plain 外，全部 shape 逐行补块到「视口高 − header − 48」，
 *      bs-body 底边 ≥ 视口底 − 60（48 预留 + 12 取整容差）——宁多不缺。
 *
 * 手法：route 拦截 `src/main.tsx` 延迟 2.5s 再放行 —— 骨架只在 React 挂载前
 * 存在，直接 goto 会有「断言时骨架已被摘除」的竞态；延迟主入口让骨架窗口
 * 稳定可观测。收尾再验证骨架被正常摘除（主模块放行后 detached）。
 */
import { test, expect } from './fixtures/mock-tmdb';
import type { Page } from '@playwright/test';

/** 主入口模块 URL（dev = src/main.tsx，preview/dist = assets/index-*.js） */
const MAIN_BUNDLE_PATTERNS = ['**/src/main.tsx*', '**/assets/index-*.js'];

/** 主入口延迟放行，让 #boot-splash 稳定可见 */
async function holdSplash(page: Page, path: string) {
  for (const pattern of MAIN_BUNDLE_PATTERNS) {
    await page.route(pattern, async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
  }
  // commit：HTML 响应即返回，内联脚本已在解析时同步执行完填充
  await page.goto(path, { waitUntil: 'commit' });
  await page.waitForSelector('#boot-splash', { state: 'attached' });
}

/** 读取骨架关键几何：shape / bs-body 底边 / 视口高 / 占位块数 */
async function splashMetrics(page: Page) {
  return page.evaluate(() => {
    const splash = document.getElementById('boot-splash');
    const body = document.getElementById('bs-body');
    return {
      shape: splash?.getAttribute('data-shape') ?? null,
      cols: splash?.getAttribute('data-cols') ?? null,
      bottom: body?.getBoundingClientRect().bottom ?? 0,
      vh: window.innerHeight,
      blocks: document.querySelectorAll(
        '#boot-splash .bs-row, #boot-splash .bs-list, #boot-splash .bs-lines, #boot-splash .bs-sec',
      ).length,
    };
  });
}

test.describe('启动骨架：视口填充与路由感知', () => {
  // 各填充 shape：bs-body 底边须到达「视口底 − 60」以内
  const filledCases: [string, string][] = [
    ['/', 'home'],
    ['/browse', 'browse'],
    ['/chart', 'chart'],
    ['/collections', 'collections'],
    ['/history', 'history'],
    ['/iptv', 'iptv'],
    ['/detail/27205', 'detail'],
    ['/person/933260', 'person'],
  ];

  for (const [path, shape] of filledCases) {
    test(`BOOT: ${path} → shape=${shape} 填满首屏`, async ({ page }) => {
      await holdSplash(page, path);
      const m = await splashMetrics(page);
      expect(m.shape).toBe(shape);
      expect(m.blocks).toBeGreaterThan(0);
      // 48px 提示区预留 + 12px 取整容差
      expect(m.bottom).toBeGreaterThanOrEqual(m.vh - 60);
    });
  }

  test('BOOT: 1080p 视口 home 也填满（回归：曾只有 hero+1 行）', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await holdSplash(page, '/');
    const m = await splashMetrics(page);
    expect(m.shape).toBe('home');
    expect(m.bottom).toBeGreaterThanOrEqual(m.vh - 60);
  });

  test('BOOT: play 形态不填充，提示文案就位', async ({ page }) => {
    await holdSplash(page, '/iptv/play?url=x&id=y&name=z');
    const m = await splashMetrics(page);
    expect(m.shape).toBe('play');
    await expect(page.locator('#bs-tip')).toHaveText('正在打开播放器…');
  });

  test('BOOT: 未知路由 shape=plain', async ({ page }) => {
    await holdSplash(page, '/no-such-route');
    const m = await splashMetrics(page);
    expect(m.shape).toBe('plain');
  });

  test('BOOT: TV UA → data-cols=tv（列数恒 8/5 档）', async ({ page }) => {
    for (const pattern of MAIN_BUNDLE_PATTERNS) {
      await page.route(pattern, async (route) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route.continue();
      });
    }
    await page.addInitScript(() => {
      // UA 判 TV：绕过 localStorage settings 依赖
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (SMART-TV; Linux) AppleWebKit/537.36 Tizen/7.0',
        configurable: true,
      });
    });
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForSelector('#boot-splash', { state: 'attached' });
    expect(await page.locator('#boot-splash').getAttribute('data-cols')).toBe('tv');
  });

  test('BOOT: 主模块放行后骨架被摘除（不残留）', async ({ page, baseURL }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // React 首帧提交后摘除骨架；等待其 detached
    await page.waitForSelector('#boot-splash', { state: 'detached', timeout: 20000 });
    expect(page.url()).toBe(`${baseURL}/`);
  });
});
