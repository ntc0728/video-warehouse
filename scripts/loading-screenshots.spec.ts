import { test, chromium } from '@playwright/test';

const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlYWNjZjRiMjc2NmQ0MTI2NDZmYzU5OTg1MmVlNjE2YSIsIm5iZiI6MTc4MDMwMTYwOS44NTUsInN1YiI6IjZhMWQzZjI5NjNlMzVkYTdjYjgxMjAzYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.z8uzVf9xAIjMposAgQCYjIcRyME_36376U3pBB_yxyE';

const ALL_PAGES = [
  { name: 'home', url: '/', desc: '首页' },
  { name: 'browse', url: '/browse', desc: '筛选页' },
  { name: 'collections', url: '/collections', desc: '收藏页' },
  { name: 'history', url: '/history', desc: '历史页' },
  { name: 'detail', url: '/detail/550', desc: '详情页' },
  { name: 'iptv', url: '/iptv', desc: 'IPTV页' },
  { name: 'settings', url: '/settings', desc: '设置页' },
];

test.describe('Loading screenshots', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  for (const { name, url, desc } of ALL_PAGES) {
    test(`Loading — ${desc} 桌面端`, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      await page.evaluate((token) => {
        const stored = localStorage.getItem('app-settings');
        const data = stored ? JSON.parse(stored) : { state: {} };
        data.state.tmdbAccessToken = token;
        localStorage.setItem('app-settings', JSON.stringify(data));
      }, TMDB_TOKEN);

      await page.goto(`http://127.0.0.1:3001${url}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-loading', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(200);
      await page.screenshot({ path: `scripts/screenshots/loading-${name}-desktop.png` });
      await context.close();
    });
  }

  for (const { name, url, desc } of ALL_PAGES) {
    test(`Loading — ${desc} 移动端`, async () => {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage();

      await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      await page.evaluate((token) => {
        const stored = localStorage.getItem('app-settings');
        const data = stored ? JSON.parse(stored) : { state: {} };
        data.state.tmdbAccessToken = token;
        localStorage.setItem('app-settings', JSON.stringify(data));
      }, TMDB_TOKEN);

      await page.goto(`http://127.0.0.1:3001${url}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-loading', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(200);
      await page.screenshot({ path: `scripts/screenshots/loading-${name}-mobile.png` });
      await context.close();
    });
  }
});
