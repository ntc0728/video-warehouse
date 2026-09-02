/**
 * 设置静态配置跨页签实时同步（SETTINGS-CROSS-001）
 * 路由: / （app shell —— AppLayout 响应式应用 theme/skin，天然是同步消费方）
 *
 * 背景（2026-09-02）：
 *  useSettingsStore 的 theme/skin/视频源选择/代理/EPG/token 等静态配置经 persist
 *  落 localStorage（键 'app-settings'，敏感字段 AES-GCM 随机 IV 加密）。其它页签
 *  改主题/皮肤/源后，本页签内存与 DOM 都停留在旧值 —— 与已同步的收藏/历史/IPTV
 *  收藏形成「配置也割裂」的尾巴。用户确认纳入：**白名单同步**（theme/skin/源选择/
 *  代理/EPG/token 等），但 tvMode / tvOverscan 这类「播放布局类」不同步（实时灌入
 *  会突变另一页签正在播放页的布局）。
 *
 * 机制（注意与 iptv-store 的 rehydrate 方案不同）：
 *  storage 事件 → 解析载荷 → 白名单逐键解密/比对 → 值变了才 setState。
 *  不能复用 persist.rehydrate()：加密是随机 IV，解密后 setState 必然触发 persist
 *  写全新密文 → 其它页签再收事件再写 → 敏感字段非空时**无限事件循环**。逐键比对
 *  保证接收端「没变就不 set、不写回」，环自动断裂。
 *
 * 用同一 context 的两个 page（共享真实 localStorage + 原生 storage 事件 + 真实
 * AES-GCM（secure context））验证（跨文档 storage/加密行为无法用 jsdom/fake 模拟）：
 *  1. 敏感字段全链路：A 写 TMDB token（随机 IV 密文）→ B 解密为明文（非密文）
 *  2. 主题真实 UI 翻转：A setTheme('dark') → B 的 <html data-theme> 实时切 dark
 *  3. 皮肤：A setSkin('cartoon') → B data-skin 实时翻转
 *  4. 排除语义：B 的 tvMode 保持 true，A 改 tvMode=false 不覆盖 B（白名单边界）
 *  5. 无回环：token 非空下多轮互写后双方 token 不损坏、测试正常结束不挂死
 *  6. 反向同步：B 改回 skin → A 跟随（双向）
 *
 * 反向验证（红）做法：临时把 initSettingsCrossTabSync() 调用注释掉，本用例必超时
 * 红；恢复后复绿 —— 证明 storage→受控合并链路是真实回归锁。
 */
import { test, expect, ENABLE_MOCK } from './fixtures/mock-tmdb';
import { matchMockRoute } from './fixtures/tmdb-mock-data';

const ST_TOKEN = 'st-crosstab-token-123456';

async function installMockRoutes(page: import('@playwright/test').Page): Promise<void> {
  if (!ENABLE_MOCK) return;
  await page.route('**/api.tmdb.org/**', async (route) => {
    const url = route.request().url();
    const mockResponse = matchMockRoute(url);
    if (mockResponse !== null) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponse) });
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

/** 挂载 useSettingsStore 到 window.__ss（app shell 引导时模块已 import，此处取同实例） */
async function mountStore(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.evaluate(async () => {
    const mod = await import('/src/stores/useSettingsStore.ts');
    (window as unknown as { __ss: unknown }).__ss = mod.useSettingsStore;
  });
}

/** 读 store 内存值（key 白名单避免误触 getState 类型） */
function storeVal(page: import('@playwright/test').Page, key: string): Promise<unknown> {
  return page.evaluate((k) => {
    const ss = (window as unknown as { __ss?: { getState(): Record<string, unknown> } }).__ss;
    const st = ss?.getState() ?? {};
    return st[k];
  }, key);
}

/** 读 <html> 上的 data-theme / data-skin（AppLayout 响应式应用的最终效果） */
function rootAttr(page: import('@playwright/test').Page, attr: string): Promise<string | null> {
  return page.evaluate((a) => document.documentElement.getAttribute(a), attr);
}

test('SETTINGS-CROSS-001: storage 事件 → 另一页签设置白名单静默同步（theme/skin 真实 DOM 翻转 + token 解密 + tvMode 排除 + 无回环）', async ({ page, context }) => {
  await mountStore(page);
  const page2 = await context.newPage();
  await installMockRoutes(page2);
  await mountStore(page2);

  // 1. 敏感字段全链路：A 写 TMDB token → B 收到密文 → 解密为明文（非密文原样）
  await page.evaluate((tok) => {
    const ss = (window as unknown as { __ss: { getState(): { setTMDBToken(t: string): void } } }).__ss;
    ss.getState().setTMDBToken(tok);
  }, ST_TOKEN);
  await expect.poll(() => storeVal(page2, 'tmdbAccessToken'), { timeout: 10000 }).toBe(ST_TOKEN);
  // 解密失败会原样返回密文（base64 随机串 ≠ ST_TOKEN），上面的全等断言已能区分明文/密文

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
    ss.getState().setTheme('light'); // 同一写让 theme 也过一遍，证明同步仍在跑（tvMode 是唯一被挡的）
  });
  await expect.poll(() => rootAttr(page2, 'data-theme'), { timeout: 10000 }).toBe('light'); // theme 照常同步
  await expect.poll(() => storeVal(page2, 'tvMode'), { timeout: 5000 }).toBe(true); // 但 tvMode 保持 B 自己的值
  await expect.poll(() => storeVal(page, 'tvMode'), { timeout: 5000 }).toBe(false); // A 自己的值不被 B 覆盖

  // 5. 无回环 + token 完整性：token 非空时上面已发生多轮互写（每轮都是全新随机 IV 密文），
  //    若实现是「事件→rehydrate→写回」会无限循环挂死；走到这里 = 无回环。
  //    且双方 token 历经多轮 re-encrypt 后仍为原始明文、未损坏（双重加密会变成乱码）。
  await expect.poll(() => storeVal(page, 'tmdbAccessToken'), { timeout: 5000 }).toBe(ST_TOKEN);
  await expect.poll(() => storeVal(page2, 'tmdbAccessToken'), { timeout: 5000 }).toBe(ST_TOKEN);

  // 6. 反向同步：B 改 skin → A 跟随（双向，非单向）。
  //    AppLayout:250-254 对 'default' 皮肤是「移除 data-skin 属性」而非设为 default
  await page2.evaluate(() => {
    const ss = (window as unknown as { __ss: { getState(): { setSkin(s: string): void } } }).__ss;
    ss.getState().setSkin('default');
  });
  await expect.poll(() => storeVal(page, 'skin'), { timeout: 10000 }).toBe('default');
  await expect.poll(() => rootAttr(page, 'data-skin'), { timeout: 10000 }).toBe(null);

  await page2.close();
});
