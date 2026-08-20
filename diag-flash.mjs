import { chromium } from '@playwright/test';
import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8');
const tmdbToken = (env.match(/^TMDB_TOKEN=(.+)$/m) || [])[1]?.trim() || '';
const base = 'http://127.0.0.1:4173';
const outDir = 'C:/Users/13438/AppData/Local/Temp/opencode/flash-shots';

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => {
  localStorage.setItem('app-settings', JSON.stringify({ state: { tmdbAccessToken: t, theme: 'dark', skin: 'default' }, version: 0 }));
}, tmdbToken);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.home-skeleton', { timeout: 10000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/1-skeleton.png` });

// 轮询切换，在骨架消失瞬间截图
for (let i = 0; i < 200; i++) {
  await page.waitForTimeout(20);
  const hasSk = await page.evaluate(() => !!document.querySelector('.home-skeleton'));
  if (!hasSk) break;
}
await page.screenshot({ path: `${outDir}/2-switch.png` });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/3-content.png` });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/4-loaded.png` });
await browser.close();
console.log('shots saved to', outDir);