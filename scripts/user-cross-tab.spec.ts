/**
 * 跨页签内存快照实时刷新（USER-CROSS-001）
 * 路由: / （app shell）
 *
 * 背景（2026-09-02）：
 *  疑点①/②修复让「DB 层」做到跨页签幂等（确定性主键 + flush 保留较新者），
 *  但另一页签增删收藏/历史后，本页签内存快照仍停留在旧值——除非手动刷新。
 *  本次（用户确认「做」）补上内存层实时同步：
 *    - 本页写收藏/历史时，落库成功后经 BroadcastChannel('kinotv-userdata') 广播；
 *    - 其它页签收到后 150ms 去抖静默 reload() 拉最新 DB 快照；
 *    - 自消息按随机 session 过滤；reload() 只读不写，不二次广播（防回环）。
 *
 * 用同一 context 的两个 page（共享真实 IndexedDB + 真实 Chromium BroadcastChannel）
 * 验证完整链路（Chromium 原生广播行为无法用单测/fake 可靠模拟，此为回归锁）：
 *  1. A 收藏 → B 无需手动刷新，store 内存态自动出现该收藏
 *  2. A 自身不因自己的广播触发 reload（session 过滤，collections 数组引用不变）
 *  3. B 取消收藏 → A 内存态自动消失（反向同步）
 *  4. A 写历史并立即 flush 落库 → B 内存态自动出现（落库成功才广播，非 addHistory 同步发）
 *  5. B 删该视频全部历史 → A 内存态自动消失
 *
 * 反向验证（红）做法：临时把 postUserDataChange 内 postMessage 注释掉，本用例必超时红；
 * 恢复后复绿 —— 证明广播→reload 链路是真实回归锁而非假绿。
 */
import { test, expect, ENABLE_MOCK } from './fixtures/mock-tmdb';
import { matchMockRoute } from './fixtures/tmdb-mock-data';

const VID_COLLECT = 'xcc-u1-collect';
const VID_HISTORY = 'xcc-u1-history';

async function installMockRoutes(page: import('@playwright/test').Page): Promise<void> {
  if (!ENABLE_MOCK) return;
  await page.route('**/api.tmdb.org/**', async (route) => {
    const url = route.request().url();
    const mockResponse = matchMockRoute(url);
    if (mockResponse !== null) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    } else {
      await route.continue();
    }
  });
  await page.route('**/image.tmdb.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
    });
  });
}

/**
 * 页面内挂载 useUserStore 到 window.__us 并确保 DB 已加载。
 * 通过 dev server 动态 import 源码模块（vite 按需转换），驱动真实 store。
 */
async function mountStore(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.evaluate(async () => {
    const mod = await import('/src/stores/useUserStore.ts');
    (window as unknown as { __us: unknown }).__us = mod.useUserStore;
    await mod.useUserStore.getState()._loadFromDB();
  });
  await page.waitForFunction(() => {
    const us = (window as unknown as { __us?: { getState(): { _initialized: boolean } } }).__us;
    return us?.getState()._initialized === true;
  }, undefined, { timeout: 10000 });
}

/** 轮询式求值辅助（page 上下文每次重新求值） */
function hasCollection(page: import('@playwright/test').Page, videoId: string): Promise<boolean> {
  return page.evaluate((vid) => {
    const us = (window as unknown as { __us?: { getState(): { collections: Array<{ videoId: string }> } } }).__us;
    return us?.getState().collections.some((c) => c.videoId === vid) ?? false;
  }, videoId);
}

function hasHistory(page: import('@playwright/test').Page, videoId: string): Promise<boolean> {
  return page.evaluate((vid) => {
    const us = (window as unknown as { __us?: { getState(): { history: Array<{ videoId: string }> } } }).__us;
    return us?.getState().history.some((h) => h.videoId === vid) ?? false;
  }, videoId);
}

/**
 * 自消息过滤断言：本页签广播不应触发自身 reload。
 * 数组引用比较必须在页内同一 JS 上下文完成（evaluate 返回值跨进程反序列化，引用必不等）。
 * 把 ref 存 window 上，600ms（覆盖 150ms 去抖 + reload 完成）后再页内比较是否同引用。
 */
async function expectSelfBroadcastNoReload(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __us: { getState(): { collections: unknown[] } };
      __colRef: unknown;
    };
    w.__colRef = w.__us.getState().collections;
  });
  await page.waitForTimeout(600);
  const stable = await page.evaluate(() => {
    const w = window as unknown as {
      __us: { getState(): { collections: unknown[] } };
      __colRef: unknown;
    };
    return w.__us.getState().collections === w.__colRef;
  });
  expect(stable).toBe(true);
}

test('USER-CROSS-001: 跨页签广播 → 另一页签内存快照静默刷新（收藏/历史双向 + 自过滤）', async ({ page, context }) => {
  // 1. 双页签同 context（共享 IndexedDB 与真实 BroadcastChannel），各自挂 store
  await mountStore(page);
  const page2 = await context.newPage();
  await installMockRoutes(page2);
  await mountStore(page2);

  // 2. A 页签收藏 → B 页签内存态应自动出现（无需手动刷新）
  await page.evaluate((vid) => {
    const us = (window as unknown as { __us: { getState(): { addCollection(v: string, m: object): void } } }).__us;
    us.getState().addCollection(vid, { title: 'CrossTab Collect', type: 'movie' });
  }, VID_COLLECT);
  await expect.poll(() => hasCollection(page2, VID_COLLECT), { timeout: 10000 }).toBe(true);

  // 3. 自消息过滤：A 的广播不应触发 A 自身 reload（collections 数组引用保持稳定）
  await expectSelfBroadcastNoReload(page);

  // 4. B 页签取消收藏 → A 页签内存态自动消失（反向同步）
  await page2.evaluate((vid) => {
    const us = (window as unknown as { __us: { getState(): { removeCollection(v: string): void } } }).__us;
    us.getState().removeCollection(vid);
  }, VID_COLLECT);
  await expect.poll(() => hasCollection(page, VID_COLLECT), { timeout: 10000 }).toBe(false);

  // 5. A 页签新增历史 + 立即 flush 落库（落库成功后广播）→ B 页签内存态自动出现
  await page.evaluate((vid) => {
    const us = (window as unknown as {
      __us: {
        getState(): {
          addHistory(r: object): void;
          flushHistoryNow(): void;
        }
      }
    }).__us;
    const usState = us.getState();
    usState.addHistory({
      videoId: vid,
      title: 'CrossTab History',
      progress: 12,
      duration: 100,
      episodeUrl: 'https://example.invalid/xcc-u1.m3u8',
    });
    usState.flushHistoryNow(); // 立即落库 → DB 写成功 → 广播（不等 3s 节流定时器）
  }, VID_HISTORY);
  await expect.poll(() => hasHistory(page2, VID_HISTORY), { timeout: 10000 }).toBe(true);

  // 6. B 页签删除该视频全部历史 → A 页签内存态自动消失
  await page2.evaluate((vid) => {
    const us = (window as unknown as { __us: { getState(): { removeHistoryByVideo(v: string): void } } }).__us;
    us.getState().removeHistoryByVideo(vid);
  }, VID_HISTORY);
  await expect.poll(() => hasHistory(page, VID_HISTORY), { timeout: 10000 }).toBe(false);

  await page2.close();
});
