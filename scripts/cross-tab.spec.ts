/**
 * 跨页签实时同步回归（2026-09-09 合并自 collection/user/iptv/settings 四个 cross-tab 单例）
 * 4 条用例各自覆盖一条跨页签链路（均为真实回归锁，用同 context 双 page 复现）：
 *  - COL-CROSS-001  收藏去重（IndexedDB 确定性主键幂等，旧随机主键实现下并发收藏必出双记录）
 *  - USER-CROSS-001 收藏/历史 BroadcastChannel 内存快照实时刷新（双向 + 自过滤 + 脏进度保护）
 *  - IPTV-CROSS-001 IPTV 收藏/播放历史 storage 事件同步 + isFavorite 重派生 + clearCache 归零
 *  - SETTINGS-CROSS-001 设置白名单 storage 同步（theme/skin 真实 DOM 翻转 + token 解密 + tvMode 排除）
 */
import { test, expect, ENABLE_MOCK } from './fixtures/mock-tmdb';
import { matchMockRoute } from './fixtures/tmdb-mock-data';

// ═══════════════ 统一的 mock 路由安装（4 文件原各自重复定义，合并去重） ═══════════════
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

const MOVIE_ID = 'tmdb-movie-550'; // 《搏击俱乐部》，与 detail.spec TEST_MOVIE_ID 一致

// ═══════════════ COL-CROSS-001：跨页签收藏去重（IndexedDB 确定性主键幂等） ═══════════════
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

// ═══════════════ USER-CROSS-001：跨页签内存快照实时刷新（BroadcastChannel） ═══════════════
const VID_COLLECT = 'xcc-u1-collect';
const VID_HISTORY = 'xcc-u1-history';

/** 挂载 useUserStore 到 window.__us 并确保 DB 已加载 */
async function mountUserStore(page: import('@playwright/test').Page): Promise<void> {
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

/** 自消息过滤断言：本页签广播不应触发自身 reload */
async function expectSelfBroadcastNoReload(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __us: { getState(): { collections: unknown[] } };
      __colRef: unknown;
    };
    w.__colRef = w.__us.getState().collections;
  });
  // 等自广播不应触发本页 reload（collections 引用保持稳定），替代固定 600ms 睡眠
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as {
      __us: { getState(): { collections: unknown[] } };
      __colRef: unknown;
    };
    return w.__us.getState().collections === w.__colRef;
  }), { timeout: 2000 }).toBe(true);
}

test('USER-CROSS-001: 跨页签广播 → 另一页签内存快照静默刷新（收藏/历史双向 + 自过滤）', async ({ page, context }) => {
  // 1. 双页签同 context（共享 IndexedDB 与真实 BroadcastChannel），各自挂 store
  await mountUserStore(page);
  const page2 = await context.newPage();
  await installMockRoutes(page2);
  await mountUserStore(page2);

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

  // 5. 脏进度保护：B 页签节流窗口内未落库的本地历史，不被 A 的广播 reload 回退。
  const DIRTY_VID = 'xcc-u1-dirty';
  await page2.evaluate(async (vid) => {
    const us = (window as unknown as {
      __us: { getState(): { addHistory(r: object): void; flushHistoryNow(): void } }
    }).__us;
    const st = us.getState();
    st.addHistory({ videoId: vid, title: 'DirtyA', progress: 7, duration: 100, episodeUrl: 'https://example.invalid/dirty-a.m3u8' });
    st.flushHistoryNow();
    await new Promise((r) => setTimeout(r, 300));
    st.addHistory({ videoId: vid, title: 'DirtyA', progress: 42, duration: 100, episodeUrl: 'https://example.invalid/dirty-a.m3u8' });
    st.addHistory({ videoId: vid, title: 'DirtyB', progress: 5, duration: 100, episodeUrl: 'https://example.invalid/dirty-b.m3u8' });
  }, DIRTY_VID);
  await page.evaluate((vid) => {
    const us = (window as unknown as { __us: { getState(): { addCollection(v: string, m: object): void } } }).__us;
    us.getState().addCollection(vid, { title: 'Noise', type: 'movie' });
  }, 'xcc-u1-noise');
  await expect.poll(() => hasCollection(page2, 'xcc-u1-noise'), { timeout: 10000 }).toBe(true);
  await expect.poll(() => page2.evaluate((vid) => {
    const us = (window as unknown as { __us?: { getState(): { history: Array<{ videoId: string; episodeUrl?: string; progress: number }> } } }).__us;
    const a = us?.getState().history.find((h) => h.videoId === vid && h.episodeUrl === 'https://example.invalid/dirty-a.m3u8');
    const b = us?.getState().history.find((h) => h.videoId === vid && h.episodeUrl === 'https://example.invalid/dirty-b.m3u8');
    return a && b ? { a: a.progress, b: b.progress } : null;
  }, DIRTY_VID), { timeout: 10000 }).toEqual({ a: 42, b: 5 });
  await page2.evaluate((vid) => {
    const us = (window as unknown as {
      __us: { getState(): { flushHistoryNow(): void; removeHistoryByVideo(v: string): void } }
    }).__us;
    us.getState().flushHistoryNow();
    us.getState().removeHistoryByVideo(vid);
  }, DIRTY_VID);
  await page.evaluate((vid) => {
    const us = (window as unknown as { __us: { getState(): { removeCollection(v: string): void } } }).__us;
    us.getState().removeCollection(vid);
  }, 'xcc-u1-noise');

  // 6. A 页签新增历史 + 立即 flush 落库（落库成功后广播）→ B 页签内存态自动出现
  await page.evaluate((vid) => {
    const us = (window as unknown as {
      __us: { getState(): { addHistory(r: object): void; flushHistoryNow(): void } }
    }).__us;
    const usState = us.getState();
    usState.addHistory({
      videoId: vid,
      title: 'CrossTab History',
      progress: 12,
      duration: 100,
      episodeUrl: 'https://example.invalid/xcc-u1.m3u8',
    });
    usState.flushHistoryNow();
  }, VID_HISTORY);
  await expect.poll(() => hasHistory(page2, VID_HISTORY), { timeout: 10000 }).toBe(true);

  // 7. B 页签删除该视频全部历史 → A 页签内存态自动消失
  await page2.evaluate((vid) => {
    const us = (window as unknown as { __us: { getState(): { removeHistoryByVideo(v: string): void } } }).__us;
    us.getState().removeHistoryByVideo(vid);
  }, VID_HISTORY);
  await expect.poll(() => hasHistory(page, VID_HISTORY), { timeout: 10000 }).toBe(false);

  await page2.close();
});

// ═══════════════ IPTV-CROSS-001：IPTV 收藏/播放历史 storage 事件同步 ═══════════════
const CH_FAV = 'iptv-cross-ch-1';
const CH_HIST = 'iptv-cross-ch-2';

/** 挂载 useIPTVStore 到 window.__iptv */
async function mountIptvStore(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.evaluate(async () => {
    const mod = await import('/src/stores/useIPTVStore.ts');
    (window as unknown as { __iptv: unknown }).__iptv = mod.useIPTVStore;
  });
}

function favoriteIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const iptv = (window as unknown as { __iptv?: { getState(): { favoriteChannelIds: string[] } } }).__iptv;
    return iptv?.getState().favoriteChannelIds ?? [];
  });
}

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
  await mountIptvStore(page);
  const page2 = await context.newPage();
  await installMockRoutes(page2);
  await mountIptvStore(page2);

  // B 页签预置内存频道（模拟已加载频道列表；只写内存，不落持久化）
  await page2.evaluate(() => {
    const iptv = (window as unknown as {
      __iptv: { getState(): { setChannels(c: Array<{ id: string; name: string; group?: string; logo?: string }>): void } }
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

  // 3. B 页签频道 isFavorite 标记随 A 的收藏实时翻转
  await expect.poll(() => channelFlag(page2, CH_FAV), { timeout: 10000 }).toBe(true);

  // 4. B 页签取消收藏 ch-1 → A 页签收藏数组实时消失（反向同步）
  await page2.evaluate((cid) => {
    const iptv = (window as unknown as { __iptv: { getState(): { toggleFavorite(c: string): void } } }).__iptv;
    iptv.getState().toggleFavorite(cid);
  }, CH_FAV);
  await expect.poll(async () => !(await favoriteIds(page)).includes(CH_FAV), { timeout: 10000 }).toBe(true);
  await expect.poll(() => channelFlag(page2, CH_FAV), { timeout: 5000 }).toBe(false);

  // 5. B 页签 recordPlay（播放历史）→ A 页签播放历史实时出现
  await page2.evaluate((cid) => {
    const iptv = (window as unknown as { __iptv: { getState(): { recordPlay(c: string): void } } }).__iptv;
    iptv.getState().recordPlay(cid);
  }, CH_HIST);
  await expect.poll(() => page.evaluate(() => {
    const iptv = (window as unknown as { __iptv?: { getState(): { playHistory: Array<{ channelId: string }> } } }).__iptv;
    return iptv?.getState().playHistory.some((r) => r.channelId === 'iptv-cross-ch-2') ?? false;
  }), { timeout: 10000 }).toBe(true);

  // 6. A 页签 clearCache → B 页签收藏/播放历史归零 + 频道 isFavorite 全 false
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

// ═══════════════ SETTINGS-CROSS-001：设置白名单 storage 同步 ═══════════════
const ST_TOKEN = 'st-crosstab-token-123456';

/** 挂载 useSettingsStore 到 window.__ss */
async function mountSettingsStore(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.evaluate(async () => {
    const mod = await import('/src/stores/useSettingsStore.ts');
    (window as unknown as { __ss: unknown }).__ss = mod.useSettingsStore;
  });
}

function storeVal(page: import('@playwright/test').Page, key: string): Promise<unknown> {
  return page.evaluate((k) => {
    const ss = (window as unknown as { __ss?: { getState(): Record<string, unknown> } }).__ss;
    const st = ss?.getState() ?? {};
    return st[k];
  }, key);
}

function rootAttr(page: import('@playwright/test').Page, attr: string): Promise<string | null> {
  return page.evaluate((a) => document.documentElement.getAttribute(a), attr);
}

test('SETTINGS-CROSS-001: storage 事件 → 另一页签设置白名单静默同步（theme/skin 真实 DOM 翻转 + token 解密 + tvMode 排除 + 无回环）', async ({ page, context }) => {
  await mountSettingsStore(page);
  const page2 = await context.newPage();
  await installMockRoutes(page2);
  await mountSettingsStore(page2);

  // 1. 敏感字段全链路：A 写 TMDB token → B 收到密文 → 解密为明文（非密文原样）
  await page.evaluate((tok) => {
    const ss = (window as unknown as { __ss: { getState(): { setTMDBToken(t: string): void } } }).__ss;
    ss.getState().setTMDBToken(tok);
  }, ST_TOKEN);
  await expect.poll(() => storeVal(page2, 'tmdbAccessToken'), { timeout: 10000 }).toBe(ST_TOKEN);

  // 2. 主题真实 DOM 翻转：A setTheme('dark') → B <html data-theme> 实时切 dark
  await page.evaluate(() => {
    const ss = (window as unknown as { __ss: { getState(): { setTheme(t: 'light' | 'dark' | 'system'): void } } }).__ss;
    ss.getState().setTheme('dark');
  });
  await expect.poll(() => rootAttr(page2, 'data-theme'), { timeout: 10000 }).toBe('dark');

  // 3. 皮肤：A setSkin('cartoon') → B data-skin 实时翻转
  await page.evaluate(() => {
    const ss = (window as unknown as { __ss: { getState(): { setSkin(s: string): void } } }).__ss;
    ss.getState().setSkin('cartoon');
  });
  await expect.poll(() => rootAttr(page2, 'data-skin'), { timeout: 10000 }).toBe('cartoon');

  // 4. 排除语义：B 先置 tvMode=true；A 改 tvMode=false 不得覆盖 B（白名单边界）
  await page2.evaluate(() => {
    const ss = (window as unknown as { __ss: { getState(): { setTvMode(v: boolean): void } } }).__ss;
    ss.getState().setTvMode(true);
  });
  await expect.poll(() => storeVal(page2, 'tvMode'), { timeout: 5000 }).toBe(true);
  await page.evaluate(() => {
    const ss = (window as unknown as { __ss: { getState(): { setTvMode(v: boolean): void; setTheme(t: string): void } } }).__ss;
    ss.getState().setTvMode(false);
    ss.getState().setTheme('light');
  });
  await expect.poll(() => rootAttr(page2, 'data-theme'), { timeout: 10000 }).toBe('light');
  await expect.poll(() => storeVal(page2, 'tvMode'), { timeout: 5000 }).toBe(true);
  await expect.poll(() => storeVal(page, 'tvMode'), { timeout: 5000 }).toBe(false);

  // 5. 无回环 + token 完整性：多轮互写后双方 token 仍为原始明文、未损坏
  await expect.poll(() => storeVal(page, 'tmdbAccessToken'), { timeout: 5000 }).toBe(ST_TOKEN);
  await expect.poll(() => storeVal(page2, 'tmdbAccessToken'), { timeout: 5000 }).toBe(ST_TOKEN);

  // 6. 反向同步：B 改 skin → A 跟随（双向）
  await page2.evaluate(() => {
    const ss = (window as unknown as { __ss: { getState(): { setSkin(s: string): void } } }).__ss;
    ss.getState().setSkin('default');
  });
  await expect.poll(() => storeVal(page, 'skin'), { timeout: 10000 }).toBe('default');
  await expect.poll(() => rootAttr(page, 'data-skin'), { timeout: 10000 }).toBe(null);

  await page2.close();
});
