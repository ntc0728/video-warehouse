/**
 * 跨页签收藏去重（COL-CROSS-001）
 * 路由: /detail/:id
 *
 * 背景（2026-09-02 实测）：
 *  旧实现 CollectionRecord.id = col-{timestamp}-{random}（随机主键），内存去重只挡单页签。
 *  两个页签（或两次独立加载）在内存都判定「未收藏」时先后收藏同一视频 →
 *  IndexedDB 出现两条同 videoId 记录，收藏页 map 不去重 → 显示两条。
 *  修复：确定性主键 col-{videoId}，写路径幂等覆盖 → DB 不可能出现同 videoId 双记录。
 *
 * 本用例用同一 context 的两个 page（共享真实 IndexedDB）复现原始场景：
 *  1. 清掉该 videoId 的历史残留（含 legacy 随机 id 行）
 *  2. 两页签各自全新加载详情页（内存都为空、按钮都处于「未收藏」）
 *  3. 同一帧同步触发两页签的收藏（DOM .click() 同步派发，避免 Playwright
 *     actionability 等待把第二次点击推迟到广播之后——否则实时同步功能会让
 *     第二页按钮先翻转为「已收藏」，点击语义变「取消收藏」，测的就不是并发收藏了）
 *  4. 断言 DB 中该 videoId 恰有 1 条记录（回归锁：旧随机主键实现下此断言必红）
 */
import { test, expect, ENABLE_MOCK } from './fixtures/mock-tmdb';
import { matchMockRoute } from './fixtures/tmdb-mock-data';

const MOVIE_ID = 'tmdb-movie-550'; // 《搏击俱乐部》，与 detail.spec TEST_MOVIE_ID 一致
const DB_NAME = 'video-warehouse';

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

/** 页内原生 IndexedDB：删除某 videoId 的全部收藏行（含 legacy 随机 id） */
function deleteRowsByVideoIndex(videoId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('video-warehouse');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('collections', 'readwrite');
      const index = tx.objectStore('collections').index('by-video');
      const cursorReq = index.openCursor(videoId);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

/** 页内原生 IndexedDB：统计某 videoId 的收藏行数 */
function countRowsByVideoIndex(videoId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('video-warehouse');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('collections', 'readonly');
      const index = tx.objectStore('collections').index('by-video');
      const cursorReq = index.openCursor(videoId);
      let count = 0;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { count++; cursor.continue(); }
        else { db.close(); resolve(count); }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
  });
}

test('COL-CROSS-001: 两页签并发收藏同一视频 → DB 仅一条记录', async ({ page, context }) => {
  // 1. 主 page 建会话 + 清残留
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.evaluate(deleteRowsByVideoIndex, MOVIE_ID);

  // 2. 第二页签（同 context 共享 IndexedDB），补挂与 fixture 相同的 mock 路由
  const page2 = await context.newPage();
  await installMockRoutes(page2);

  // 3. 两页签各自全新加载详情页，等待收藏按钮处于「未收藏」态
  await page.goto(`/detail/${MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
  await page2.goto(`/detail/${MOVIE_ID}`, { waitUntil: 'domcontentloaded' });

  const collectBtn1 = page.locator('.detail-btn-collect, [class*="btn-collect"]').first();
  const collectBtn2 = page2.locator('.detail-btn-collect, [class*="btn-collect"]').first();
  await collectBtn1.waitFor({ state: 'visible', timeout: 20000 });
  await collectBtn2.waitFor({ state: 'visible', timeout: 20000 });

  // 内存都为空 → 按钮均显示可收藏（未「已收藏」）；若显示已收藏说明残留未清干净，测试前提不成立
  await expect.poll(async () => (await collectBtn1.textContent()) ?? '').not.toContain('已收藏');
  await expect.poll(async () => (await collectBtn2.textContent()) ?? '').not.toContain('已收藏');

  // 4. 同帧同步点击收藏（DOM .click() 同步派发 → React 同步触发 addCollection；
  //    两个页签此刻内存都为空、都判定「未收藏」→ 各自 add，真并发写）
  await Promise.all([
    page.evaluate(() => {
      const btn = document.querySelector('.detail-btn-collect, [class*="btn-collect"]') as HTMLElement | null;
      btn?.click();
    }),
    page2.evaluate(() => {
      const btn = document.querySelector('.detail-btn-collect, [class*="btn-collect"]') as HTMLElement | null;
      btn?.click();
    }),
  ]);

  // 5. 幂等收敛：写路径确定性主键 → 并发收藏后该 videoId 恰 1 条
  //    （旧随机主键实现下此断言红：会得到 2 条）
  await expect.poll(() => page.evaluate(countRowsByVideoIndex, MOVIE_ID), { timeout: 10000 }).toBe(1);

  await page2.close();
});
