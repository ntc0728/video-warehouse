import { test } from '@playwright/test';

/**
 * 手工调试脚本（**不是自动化用例**）——
 * 无任何断言，只打印播放器三面板折叠时的 header 位移 / body 高度采样，
 * 供人工核查动画观感；且硬编码了 3002 端口（需先在该端口起 dev server）。
 *
 * 2026-09-10：标记 skip。它此前一直是失败态（3002 无服务），会把全量 E2E 拉红、
 * 掩盖真实回归。需要时去掉 skip 并先 `pnpm dev --port 3002` 手动运行。
 */
const PROBE_PORT = process.env.GRID_PROBE_PORT ?? '3002';

test.skip(`网格重构后：展开面板 header 不动、body 平滑（手工调试，需 :${PROBE_PORT} 起服务）`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${PROBE_PORT}/`);
  await page.locator('a[href^="/detail/"]').first().waitFor({ timeout: 30000 });
  const href = await page.locator('a[href^="/detail/"]').first().getAttribute('href') || '';
  await page.goto(`http://127.0.0.1:${PROBE_PORT}/play/${href.replace('/detail/', '')}`);
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