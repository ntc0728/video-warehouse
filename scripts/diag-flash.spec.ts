import { test } from './fixtures/mock-tmdb';

test.describe('DIAG 内容过渡测量', () => {
  test('DIAG-003 数据就绪内容挂载时的 opacity 过渡', async ({ page }) => {
    await page.route('**/api.tmdb.org/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home-skeleton', { timeout: 8000 });
    console.log('DIAG003 skeleton shown');
    // 轮询 content 出现，采样其 opacity 变化
    let sawContent = false;
    const opacitySamples = [];
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(80);
      const s = await page.evaluate(() => {
        const c = document.querySelector('.home-page__content');
        const hero = document.querySelector('.hero-banner');
        const b = document.querySelector('.home-skeleton');
        return {
          content: !!c,
          hero: !!hero,
          sk: !!b,
          cOpacity: c ? parseFloat(getComputedStyle(c).opacity) : null,
          anim: c ? getComputedStyle(c).animationName : null,
        };
      });
      if (s.content && !sawContent) { sawContent = true; console.log('DIAG003 content first appeared'); }
      opacitySamples.push(s);
    }
    console.log('DIAG003 samples:', JSON.stringify(opacitySamples.filter((s) => s.content)));
  });
});