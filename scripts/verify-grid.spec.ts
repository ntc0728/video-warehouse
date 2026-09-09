import { test } from '@playwright/test';

test('网格重构后：展开面板 header 不动、body 平滑', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3002/');
  await page.locator('a[href^="/detail/"]').first().waitFor({ timeout: 30000 });
  const href = await page.locator('a[href^="/detail/"]').first().getAttribute('href') || '';
  await page.goto(`http://127.0.0.1:3002/play/${href.replace('/detail/', '')}`);
  await page.locator('.player-panel--cms').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);

  const body = page.locator('.player-panel--cms .player-panel-body').first();
  await body.scrollIntoViewIfNeeded().catch(() => {});

  // 采样 header top + body 高度 + tab 尺寸
  await page.evaluate(() => {
    window.__tr = [];
    const h = document.querySelector('.player-panel--cms .player-panel-header');
    const b = document.querySelector('.player-panel--cms .player-panel-body');
    if (!h) return;
    const t0 = performance.now();
    const s = (t) => {
      const ht = h.getBoundingClientRect().top;
      const bh = b ? b.getBoundingClientRect().height : -1;
      const btn = document.querySelector('.player-panel--cms .player-cms-item');
      const bw = btn ? btn.getBoundingClientRect().width : -1;
      window.__tr.push({ t: +(t - t0).toFixed(1), ht: +ht.toFixed(2), bh: +bh.toFixed(1), bw: +bw.toFixed(1) });
      if (t - t0 < 500) requestAnimationFrame(s);
    };
    requestAnimationFrame(s);
  });

  await page.locator('.player-panel--cms .player-panel-header').first().click();
  await page.waitForTimeout(600);
  const tr = await page.evaluate(() => window.__tr || []);
  // eslint-disable-next-line no-console
  console.log('TRACK:', JSON.stringify(tr.filter((_, i) => i % 3 === 0)));
  const hts = tr.map(r => r.ht);
  const drift = Math.max(...hts) - Math.min(...hts);
  // eslint-disable-next-line no-console
  console.log('headerDrift(px)=', drift.toFixed(2));
  // 展开后 body 最终应显著增高
  const last = tr[tr.length - 1];
  // eslint-disable-next-line no-console
  console.log('bodyH first/last=', tr[0].bh, last.bh, 'tabW first/last=', tr.find(r=>r.bw>0)?.bw, last.bw);
});