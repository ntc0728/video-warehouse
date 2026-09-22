/**
 * 启动骨架 (#boot-splash) 全 shape 截图采集（一次性验证脚本，非回归用例）
 *
 * 目的：
 *  1. 验证「除首页外，刷新任意路由也会看到启动骨架」——按路由分支出不同 shape；
 *  2. 采集全部 11 种 shape（light + dark 主题）截图到 docs/screenshots/boot-splash/；
 *  3. 验证骨架在 React 首帧后被摘除、无残留（首页 / 与 收藏页 /collections 各验一次）。
 *
 * 手法同 boot-splash.spec.ts：route 拦截主入口延迟 3s 放行，让骨架稳定可见。
 * 运行：npm run test:e2e:shots（= e2e-skeleton.mjs --all --dev 本脚本，ad-hoc 120s 预算）
 */
import { test, expect } from './fixtures/mock-tmdb';
import type { Page } from '@playwright/test';
import fs from 'fs';
// 别名导入：循环里的路由变量名叫 path，会遮蔽模块名
import nodePath from 'path';

const OUT_DIR = 'docs/screenshots/boot-splash';

/** 主入口延迟放行，让 #boot-splash 稳定可见。
 *  延迟期间 main.tsx 被拦、React 挂不了 → 骨架必然在；CDP 截图在 goto 后 ~300ms
 *  即完成，故 3s 已绰绰有余。⚠️ 勿再调回 10s：每个用例收尾要等满这段延迟
 *  （Playwright 等 in-flight route handler），29 用例 ×10s /3worker ≈100s 会撞
 *  ad-hoc 档 120s 预算被击杀；3s → ~30s 稳进。截图走 CDP 无字体等待，不需长延迟兜底。 */
async function holdSplash(page: Page, path_: string) {
  for (const pattern of ['**/src/main.tsx*', '**/assets/index-*.js']) {
    await page.route(pattern, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
  }
  // 骨架 logo 走 /src/ 路径的 dev 裸请求，在模块图被延迟拦截时可能挂起，
  // 拖住 document.fonts.ready → 截图 hang；直接 abort（真实场景有 onerror 隐藏兜底）
  await page.route('**/src/assets/icon/KinoTV.webp', (route) => route.abort());
  await page.goto(path_, { waitUntil: 'commit' });
  /* 等就绪标记而非裸 attached：两段式（2026-09-22）下第一段 plain 从解析即存在，
     第二段同构换形延迟 PLAIN_MS 才发生。[data-shape-ready] 由换形/构建/填充完成后挂，
     精确同步到「第二段已就位、React 未摘除」窗口（本脚本拦主模块 3s ≫ 换形延时）。 */
  await page.waitForSelector('#boot-splash[data-shape-ready]', { state: 'attached' });
}

/** 覆盖 localStorage 里的 theme（启动内联脚本在解析期读 app-settings 写 data-theme） */
async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    const raw = localStorage.getItem('app-settings');
    const parsed = raw ? JSON.parse(raw) : { state: {} };
    parsed.state.theme = t;
    localStorage.setItem('app-settings', JSON.stringify(parsed));
  }, theme);
}

// 11 种 shape：路由 → 期望 data-shape（与 index.html 内联脚本判定表一一对应）
const SHAPE_CASES: [string, string][] = [
  ['/', 'home'],
  ['/iptv', 'iptv'],
  ['/browse', 'browse'],
  ['/chart', 'chart'],
  ['/collections', 'collections'],
  ['/history', 'history'],
  ['/detail/27205', 'detail'],
  ['/person/933260', 'person'],
  ['/play/tmdb-550', 'player'],
  ['/iptv/play?url=x&id=y&name=z', 'play'],
  ['/no-such-route', 'plain'],
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`启动骨架截图（${theme}）`, () => {
    for (const [path, shape] of SHAPE_CASES) {
      test(`shot: ${path} → shape=${shape}`, async ({ page }) => {
        test.setTimeout(60000);
        await setTheme(page, theme);
        await holdSplash(page, path);
        const actual = await page.locator('#boot-splash').getAttribute('data-shape');
        expect(actual).toBe(shape);
        // 用 CDP 直接截图：Playwright 的 screenshot 会等字体/资源就绪，
        // 而骨架窗口内主模块被拦、字体链路未闭合 → 必然 hang；CDP 无此等待
        const cdp = await page.context().newCDPSession(page);
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(nodePath.join(OUT_DIR, `${shape}-${theme}.png`), Buffer.from(data, 'base64'));
      });
    }
  });
}

test.describe('启动骨架截图（1920×1080 light，多视口取证）', () => {
  // 用户核查时问「在多少视口下测试的」：默认档 1280×720 之外，
  // 补 1920 档（栏宽 260 / 右卡 3 列 / poster 8 列）取证
  const WIDE_CASES: [string, string][] = [
    ['/', 'home'],
    ['/collections', 'collections'],
    ['/detail/27205', 'detail'],
  ];
  for (const [path, shape] of WIDE_CASES) {
    test(`shot@1920: ${path} → shape=${shape}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await setTheme(page, 'light');
      await holdSplash(page, path);
      const cdp = await page.context().newCDPSession(page);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(nodePath.join(OUT_DIR, `${shape}-1920-light.png`), Buffer.from(data, 'base64'));
    });
  }
});

test.describe('启动骨架摘除验证（不放行延迟，走真实挂载流程）', () => {
  for (const path of ['/', '/collections', '/iptv', '/chart']) {
    test(`detach: ${path} 骨架被摘除无残留`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#boot-splash', { state: 'detached', timeout: 20000 });
      expect(await page.locator('#boot-splash').count()).toBe(0);
    });
  }
});
