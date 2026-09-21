/**
 * 启动骨架 ↔ 真实页「七视口同构」取证（2026-09-21，单真源收敛后的回归证据）
 *
 * 背景：用户质问「不同视口下的骨架就不能和真实显示的页面结构相同吗」。根因是骨架列数
 * 曾有一份 JS 手抄断点表（colCount）+ 一套内联 CSS 媒体阶梯，是 layout-tokens.css 之外的
 * 第二真源，与真实网格必然漂移。收敛后骨架网格一律读注入的 var(--card-cols 等)，与真实页
 * 共读同一份 token。本脚本把「同构」变成机器可断言 + 可视化取证：
 *
 *   对 7 个视口（375 / 768 / 1024 / 1280 / 1440 / 1920 / 2560）× 6 组网格，逐一验证
 *     ① 启动骨架网格实际列数（#boot-splash .bs-row--{kind}，读注入 token）
 *     ② 真实页网格实际列数（注入真实类名探针，读 bundle token）
 *     ③ :root token 计算值
 *   三者必须相等 —— 相等即「任意视口骨架与真实页同构」。
 *
 *   同时各存两张截图到 docs/screenshots/boot-splash-iso/：
 *     {key}-{w}-splash.png（启动骨架）/ {key}-{w}-real.png（真实页渲染态），供人工比对。
 *
 * 运行：node scripts/e2e-skeleton.mjs scripts/boot-splash-iso.spec.ts
 *   （preview dist 模式最省事：dist 已含注入的 layout-tokens；--dev 亦可，注入插件 dev 生效）
 */
import { test, expect } from './fixtures/mock-tmdb';
import type { Page } from '@playwright/test';
import fs from 'fs';
import nodePath from 'path';

const OUT_DIR = 'docs/screenshots/boot-splash-iso';
const PROBE_ID = '__iso_probe';
const PROBE = `#${PROBE_ID}`;

/** 七视口：移动 → 平板 → 小桌面 → 桌面 → 大屏 → 1080p → 2K，覆盖全部断点阶梯档位 */
const VIEWPORTS = [375, 768, 1024, 1280, 1440, 1920, 2560];

/**
 * 同构对照矩阵：每行 = 一组「启动骨架网格 ↔ 真实页网格」，二者共读同一 token。
 *  - shape       启动骨架形态（路由派生），决定 splash 里出现哪种 .bs-row--{rowKind}
 *  - splashRoute 采集骨架截图的路由
 *  - rowKind     骨架网格类名后缀（.bs-row--{rowKind}）
 *  - token       二者共读的列数 token（第三方对照）
 *  - realRoute   承载真实网格 CSS 的路由（Vite 按路由懒加载 chunk，CSS 只在该页存在）
 *  - realHtml    注入探针的最小真实 DOM（类名/祖先链必须与真实 CSS 选择器完全一致）
 *  - realSel     读列数的真实网格选择器
 */
interface IsoCase {
  key: string;
  shape: string;
  splashRoute: string;
  rowKind: string;
  token: string;
  realRoute: string;
  realHtml: string;
  realSel: string;
}

const CASES: IsoCase[] = [
  {
    key: 'home-poster',
    shape: 'home',
    splashRoute: '/',
    rowKind: 'poster',
    token: '--card-cols',
    // 首页真实态是横滚行（TMDBMovieRow），无 .video-card-grid；--card-cols 的规范消费方
    // 是 Browse/Collections 的 .video-card-grid，故在 /browse 上取真实列数做同构对照。
    realRoute: '/browse',
    realHtml: '<div class="video-card-grid"></div>',
    realSel: `${PROBE} .video-card-grid`,
  },
  {
    key: 'browse-poster',
    shape: 'browse',
    splashRoute: '/browse',
    rowKind: 'poster',
    token: '--card-cols',
    realRoute: '/browse',
    realHtml: '<div class="video-card-grid"></div>',
    realSel: `${PROBE} .video-card-grid`,
  },
  {
    key: 'collections-poster',
    shape: 'collections',
    splashRoute: '/collections',
    rowKind: 'poster',
    token: '--card-cols',
    realRoute: '/collections',
    realHtml: '<div class="video-card-grid"></div>',
    realSel: `${PROBE} .video-card-grid`,
  },
  {
    key: 'collections-channel',
    shape: 'collections',
    splashRoute: '/collections',
    rowKind: 'channel',
    token: '--iptv-cols',
    realRoute: '/collections',
    realHtml: '<div class="iptv-channel-grid"></div>',
    realSel: `${PROBE} .iptv-channel-grid`,
  },
  {
    key: 'history-record',
    shape: 'history',
    splashRoute: '/history',
    rowKind: 'record',
    token: '--history-cols',
    realRoute: '/history',
    // History.css 规则写作 .history-content .history-group-body .history-grid，探针必须
    // 复刻完整祖先链，少一层就只剩 display:block、读列数得 -1（skeleton.spec.ts 同款坑）。
    realHtml:
      '<div class="history-content"><div class="history-group-body"><div class="history-grid"></div></div></div>',
    realSel: `${PROBE} .history-content .history-group-body .history-grid`,
  },
  {
    key: 'iptv-page',
    shape: 'iptv',
    splashRoute: '/iptv',
    rowKind: 'iptvpage',
    token: '--iptv-page-cols',
    realRoute: '/iptv',
    realHtml: '<div class="iptv-page"><div class="iptv-channel-grid"></div></div>',
    realSel: `${PROBE} .iptv-page .iptv-channel-grid`,
  },
];

/** 主入口延迟放行，让 #boot-splash 稳定可见（手法同 boot-splash-shots.spec.ts）。
 *  延迟期间 main.tsx 被拦、React 挂不了 → 骨架必然在；读列数 + CDP 截图在 data-shape-ready
 *  后 ~200ms 内完成，故 1.5s 已足够（比 shots 的 3s 更短：本脚本用例数是它的 ~1.4 倍，
 *  收紧单例延迟以留足 ad-hoc 120s 预算）。 */
async function holdSplash(page: Page, path_: string) {
  for (const pattern of ['**/src/main.tsx*', '**/assets/index-*.js']) {
    await page.route(pattern, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
  }
  // 骨架 logo 走 /src/ 裸请求，模块图被延迟拦截时可能挂起拖住 fonts.ready；直接 abort
  await page.route('**/src/assets/icon/KinoTV.webp', (route) => route.abort());
  await page.goto(path_, { waitUntil: 'commit' });
  await page.waitForSelector('#boot-splash[data-shape-ready]', { state: 'attached' });
}

/** 读 computed 列数：grid-template-columns 展开后按列值个数计（none → -1，缺节点 → -2） */
async function readCols(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return -2;
    const raw = getComputedStyle(el).gridTemplateColumns.trim();
    if (!raw || raw === 'none') return -1;
    return raw.split(/\s+/).filter(Boolean).length;
  }, selector);
}

/** 读 :root 上数字 token 的计算值 */
async function readToken(page: Page, token: string): Promise<number> {
  return page.evaluate((t) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(t).trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  }, token);
}

/** CDP 截图（不等字体/资源，骨架窗口内主模块被拦时会 hang，故绕过 Playwright screenshot） */
async function cdpShot(page: Page, file: string) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(nodePath.join(OUT_DIR, file), Buffer.from(data, 'base64'));
  await cdp.detach();
}

for (const w of VIEWPORTS) {
  test.describe(`七视口同构 @${w}px`, () => {
    for (const c of CASES) {
      // home 的 poster 与 browse 的 poster 真实侧同源（都 .video-card-grid），
      // 在小视口下 home 骨架可能不铺 poster 行（<1024 单列 hero）——用 test.skip 精确规避。
      test(`${c.key}: 骨架列数 == 真实列数 == token`, async ({ page }) => {
        test.setTimeout(30000);
        await page.setViewportSize({ width: w, height: 900 });

        // ── ① 启动骨架侧：读 .bs-row--{rowKind} 实际列数 + 截图 ──
        await holdSplash(page, c.splashRoute);
        const shape = await page.locator('#boot-splash').getAttribute('data-shape');
        expect(shape).toBe(c.shape);
        const splashSel = `#boot-splash .bs-row--${c.rowKind}`;
        const splashCols = await readCols(page, splashSel);
        const tokenOnSplash = await readToken(page, c.token);
        await cdpShot(page, `${c.key}-${w}-splash.png`);

        // ── ② 真实页侧：等 React 挂载 + 路由 CSS 就位，注入真实网格探针读列数 + 截图 ──
        await page.goto(c.realRoute, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.evaluate(
          ({ id, html }) => {
            document.getElementById(id)?.remove();
            const host = document.createElement('div');
            host.id = id;
            host.setAttribute('aria-hidden', 'true');
            host.innerHTML = html;
            document.body.appendChild(host);
          },
          { id: PROBE_ID, html: c.realHtml },
        );
        const realCols = await readCols(page, c.realSel);
        const tokenOnReal = await readToken(page, c.token);
        await cdpShot(page, `${c.key}-${w}-real.png`);

        // ── ③ 三方对照：token 两侧一致 + 骨架/真实列数都等于 token ──
        expect(tokenOnSplash, `${c.token} 骨架侧计算值`).toBe(tokenOnReal);
        expect(splashCols, `骨架 .bs-row--${c.rowKind} 列数`).toBe(tokenOnSplash);
        expect(realCols, `真实 ${c.realSel} 列数`).toBe(tokenOnReal);
        expect(splashCols, '骨架列数 == 真实列数（同构）').toBe(realCols);
      });
    }
  });
}
