/**
 * IPTV 收藏/播放历史跨页签实时同步（IPTV-CROSS-001）
 * 路由: / （app shell，store 级驱动）
 *
 * 背景（2026-09-02）：
 *  useUserStore（IndexedDB）已补 BroadcastChannel 跨页签同步（USER-CROSS-001）。
 *  但 IPTV 频道收藏（useIPTVStore.favoriteChannelIds / playHistory）走 zustand
 *  persist 落 localStorage（键 'iptv-store'），同样存在「tab A 收藏/播放后，tab B
 *  内存态陈旧，需手动刷新」的体验割裂——同叫「收藏」却两套行为。
 *
 *  本次（用户确认「纳入」）补 receiver 侧同步。传输机制与 useUserStore 不同：
 *  localStorage 的同源跨页签通知 = 浏览器原生 window 'storage' 事件（其它页签
 *  setItem/removeItem 自动触发），无需 BroadcastChannel。处理逻辑：
 *    - newValue === null（另一页签 clearCache 先 removeItem）→ 收藏/播放历史/
 *      筛选归零 + 频道 isFavorite 全 false；
 *    - 常规写入 → persist.rehydrate() 重读合并 + 按新 favoriteChannelIds 重派生
 *      channels.isFavorite（防心形态与收藏数组脱节）。
 *  写侧无需任何改动：zustand persist 在 set() 时同步写 localStorage，浏览器代为广播。
 *
 * 用同一 context 的两个 page（共享真实 localStorage，Chromium 原生 storage 事件）
 * 验证完整链路（跨文档 storage 行为无法用 jsdom/fake 可靠模拟，此为回归锁）：
 *  1. A toggleFavorite → B 收藏数组实时出现（无需刷新）
 *  2. B 频道 isFavorite 标记随 A 收藏实时翻转（rehydrate 后重派生，非仅数组）
 *  3. B 取消收藏 → A 实时消失（反向同步）
 *  4. B recordPlay → A 播放历史实时出现（同 key 全切片同步）
 *  5. A clearCache（removeItem → null 事件路径）→ B 收藏/播放历史归零 +
 *     频道 isFavorite 全 false
 *
 * 反向验证（红）做法：临时把 initIPTVStoreCrossTabSync() 的 window.addEventListener
 * 注释掉，本用例必超时红；恢复后复绿 —— 证明 storage→rehydrate 链路是真实回归锁。
 */
import { test, expect, ENABLE_MOCK } from './fixtures/mock-tmdb';
import { matchMockRoute } from './fixtures/tmdb-mock-data';

const CH_FAV = 'iptv-cross-ch-1';
const CH_HIST = 'iptv-cross-ch-2';

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
 * 页面内挂载 useIPTVStore 到 window.__iptv。
 * zustand persist 用同步 localStorage，模块 import 即完成 rehydrate（无需等异步标记）。
 * 挂载即生效：模块级 initIPTVStoreCrossTabSync() 在 import 时挂上 storage 监听。
 */
async function mountStore(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.evaluate(async () => {
    const mod = await import('/src/stores/useIPTVStore.ts');
    (window as unknown as { __iptv: unknown }).__iptv = mod.useIPTVStore;
  });
}

/** 收藏数组取值辅助 */
function favoriteIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const iptv = (window as unknown as { __iptv?: { getState(): { favoriteChannelIds: string[] } } }).__iptv;
    return iptv?.getState().favoriteChannelIds ?? [];
  });
}

/** 频道 isFavorite 标记取值辅助 */
function channelFlag(page: import('@playwright/test').Page, channelId: string): Promise<boolean | undefined> {
  return page.evaluate((cid) => {
    const iptv = (window as unknown as {
      __iptv?: { getState(): { channels: Array<{ id: string; isFavorite: boolean }> } }
    }).__iptv;
    return iptv?.getState().channels.find((c) => c.id === cid)?.isFavorite;
  }, channelId);
}

test('IPTV-CROSS-001: localStorage storage 事件 → 另一页签 IPTV 收藏/播放历史静默同步（含 isFavorite 重派生 + clearCache 归零）', async ({ page, context }) => {
  // 1. 双页签同 context（共享 localStorage，Chromium 原生 storage 事件），各自挂 store
  await mountStore(page);
  const page2 = await context.newPage();
  await installMockRoutes(page2);
  await mountStore(page2);

  // B 页签预置内存频道（模拟已加载频道列表；只写内存，不落持久化）
  await page2.evaluate(() => {
    const iptv = (window as unknown as {
      __iptv: { getState(): {
        setChannels(c: Array<{ id: string; name: string; group?: string; logo?: string }>): void
      } }
    }).__iptv;
    iptv.getState().setChannels([
      { id: 'iptv-cross-ch-1', name: 'CrossTab-1', group: '测试' },
      { id: 'iptv-cross-ch-2', name: 'CrossTab-2', group: '测试' },
    ]);
  });

  // 2. A 页签收藏 ch-1 → B 页签收藏数组实时出现（无需手动刷新）
  await page.evaluate((cid) => {
    const iptv = (window as unknown as { __iptv: { getState(): { toggleFavorite(c: string): void } } }).__iptv;
    iptv.getState().toggleFavorite(cid);
  }, CH_FAV);
  await expect.poll(async () => (await favoriteIds(page2)).includes(CH_FAV), { timeout: 10000 }).toBe(true);

  // 3. B 页签频道 isFavorite 标记随 A 的收藏实时翻转（rehydrate 后重派生，非仅数组同步）
  await expect.poll(() => channelFlag(page2, CH_FAV), { timeout: 10000 }).toBe(true);

  // 4. B 页签取消收藏 ch-1 → A 页签收藏数组实时消失（反向同步）
  await page2.evaluate((cid) => {
    const iptv = (window as unknown as { __iptv: { getState(): { toggleFavorite(c: string): void } } }).__iptv;
    iptv.getState().toggleFavorite(cid);
  }, CH_FAV);
  await expect.poll(async () => !(await favoriteIds(page)).includes(CH_FAV), { timeout: 10000 }).toBe(true);
  // B 自身频道标记同步翻转（现有 toggleFavorite 同步逻辑；确认无残留）
  await expect.poll(() => channelFlag(page2, CH_FAV), { timeout: 5000 }).toBe(false);

  // 5. B 页签 recordPlay（播放历史）→ A 页签播放历史实时出现（同 key 全切片同步）
  await page2.evaluate((cid) => {
    const iptv = (window as unknown as { __iptv: { getState(): { recordPlay(c: string): void } } }).__iptv;
    iptv.getState().recordPlay(cid);
  }, CH_HIST);
  await expect.poll(() => page.evaluate(() => {
    const iptv = (window as unknown as { __iptv?: { getState(): { playHistory: Array<{ channelId: string }> } } }).__iptv;
    return iptv?.getState().playHistory.some((r) => r.channelId === 'iptv-cross-ch-2') ?? false;
  }), { timeout: 10000 }).toBe(true);

  // 6. A 页签 clearCache（removeItem → 另一页签收到 newValue === null 事件路径）→
  //    B 页签收藏/播放历史归零 + 频道 isFavorite 全 false（镜像 clearCache 语义）
  await page.evaluate(() => {
    const iptv = (window as unknown as { __iptv: { getState(): { clearCache(): void } } }).__iptv;
    iptv.getState().clearCache();
  });
  await expect.poll(async () => (await favoriteIds(page2)).length === 0, { timeout: 10000 }).toBe(true);
  await expect.poll(() => page2.evaluate(() => {
    const iptv = (window as unknown as { __iptv?: { getState(): { playHistory: unknown[] } } }).__iptv;
    return iptv?.getState().playHistory.length ?? -1;
  }), { timeout: 10000 }).toBe(0);
  await expect.poll(() => channelFlag(page2, CH_FAV), { timeout: 5000 }).toBe(false);
  await expect.poll(() => channelFlag(page2, CH_HIST), { timeout: 5000 }).toBe(false);

  await page2.close();
});
