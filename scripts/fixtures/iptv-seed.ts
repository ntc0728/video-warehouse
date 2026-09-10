/**
 * IPTV 频道数据种子（e2e 用）
 *
 * 播放页的「频道列表」相关断言需要 `channels` 非空才会渲染 `.up-channel-list-body`
 * （`/iptv/play` 只从 IndexedDB 缓存或网络源拿频道）。e2e 里不应依赖真实 IPTV 源，
 * 所以这里用**注入缓存**的方式喂数据 —— 零网络请求，频道列表必现。
 *
 * 用法（顺序不能反）：
 * ```ts
 * await page.goto('/', { waitUntil: 'domcontentloaded' });
 * await page.waitForSelector('.app-shell', { timeout: 20000 });
 * await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清']);
 * await page.goto('/iptv/play?url=...&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88');
 * ```
 *
 * 三个不能错的细节（踩过）：
 * ① **必须先访问一次同源页面**：`indexedDB.open('video-warehouse')` 不带版本号时，
 *    若库还不存在会开出一个**没有任何 object store** 的空库，应用随后按 version 8
 *    打开时 upgrade 已被跳过 → `db.get('iptvChannels')` 直接抛错。先访问一次首页
 *    （`useUserStore` 启动即读 IndexedDB）让应用把 v8 的 5 个 store 建好即可。
 * ② localStorage `iptv-store` 必须 `version: 0`（zustand persist 的版本号，不是 1）；
 *    且 `settings.aggregatorUrls` **必须非空** —— `useIPTVStore.loadFromCache`
 *    在 `sourceUrls.length === 0` 时直接 return false，根本不会去读缓存。
 * ③ IndexedDB 记录的 `sourceUrls` 必须与 `aggregatorUrls` **逐元素、保持顺序**相等。
 *    `getCachedIPTVChannels` 刻意不做 sort 比较（源顺序决定频道的 `sourceId`），
 *    两边用同一个常量即天然满足；顺序不一致会被判为缓存失效返回 null。
 *    另有第四点：频道**不要**带 `sourceId: 'source-N'` 前缀 —— `loadFromCache`
 *    会把这些「本地源频道」过滤掉（它们由「更多台」单独管理）。
 */
import type { Page } from '@playwright/test';

/** 种子用的假源地址：localStorage 与 IndexedDB 两处必须一致（见上文 ③） */
export const IPTV_SEED_SOURCE_URLS = ['http://iptv-seed.local/test.m3u'];

export interface SeedChannel {
  id: string;
  name: string;
  url: string;
  quality?: string;
}

/**
 * 把频道写入 IndexedDB 缓存 + localStorage 设置。
 * @param names 频道名（会按数组顺序生成 `ch-1…ch-N`，并按「CCTV → 新闻 → 港澳台 →
 *   体育 → 影视 → 少儿 → 卫视」规则被 `buildCategoryGroups` 归到一级分类）
 * @param qualities 与 `names` 等长时可指定画质徽章；缺省按 `i % 3 === 0` 间隔给 `1080P`
 */
export async function seedIptvChannels(
  page: Page,
  names: string[],
  qualities?: (string | undefined)[],
): Promise<void> {
  const channels: SeedChannel[] = names.map((name, i) => ({
    id: `ch-${i + 1}`,
    name,
    url: `http://iptv-seed.local/stream-${i + 1}.m3u8`,
    quality: qualities ? qualities[i] : i % 3 === 0 ? '1080P' : undefined,
  }));

  await page.evaluate(
    ({ chans, sourceUrls }) => {
      localStorage.setItem(
        'iptv-store',
        JSON.stringify({
          state: {
            settings: {
              aggregatorUrl: sourceUrls[0],
              aggregatorUrls: sourceUrls,
              proxyUrl: '',
              proxyPattern: '',
              priorityKeywords: [],
              autoRefresh: false,
            },
            filter: { search: '', sourceId: '', group: '' },
            playHistory: [],
            favoriteChannelIds: [],
            extraSourceIds: [],
          },
          version: 0,
        }),
      );

      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('video-warehouse');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('iptvChannels')) {
            reject(new Error('iptvChannels store 不存在：请先访问一次同源页面再调用 seedIptvChannels'));
            return;
          }
          const tx = db.transaction('iptvChannels', 'readwrite');
          tx.objectStore('iptvChannels').put({
            key: 'iptv-channels',
            channels: chans,
            groups: [],
            sourceType: 'm3u',
            // 时间戳要新鲜：getCachedIPTVChannels 有 24h TTL
            timestamp: Date.now(),
            sourceUrls,
            bySource: {},
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { chans: channels, sourceUrls: IPTV_SEED_SOURCE_URLS },
  );
}
