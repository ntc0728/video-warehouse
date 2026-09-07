// 测量首屏加载时间的 Playwright 测试
import { test, expect } from '@playwright/test';

test.describe('性能测量', () => {
  test('测量首页加载时间', async ({ page }) => {
    const startTime = Date.now();
    
    // 监听页面加载事件
    await page.goto('http://127.0.0.1:3001', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`首页加载时间: ${loadTime} ms`);
    
    // 等待一些关键元素出现
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 10000 });
    
    const finalTime = Date.now() - startTime;
    console.log(`首页完全加载时间: ${finalTime} ms`);
    
    // 如果加载时间超过5秒，记录警告
    if (finalTime > 5000) {
      console.warn(`首页加载时间过长: ${finalTime} ms`);
    }
  });

  test('测量浏览页加载时间', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://127.0.0.1:3001/browse', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`浏览页加载时间: ${loadTime} ms`);
    
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 10000 });
    
    const finalTime = Date.now() - startTime;
    console.log(`浏览页完全加载时间: ${finalTime} ms`);
    
    if (finalTime > 5000) {
      console.warn(`浏览页加载时间过长: ${finalTime} ms`);
    }
  });

  test('测量 IPTV 页加载时间', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://127.0.0.1:3001/iptv', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`IPTV 页加载时间: ${loadTime} ms`);
    
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 10000 });
    
    const finalTime = Date.now() - startTime;
    console.log(`IPTV 页完全加载时间: ${finalTime} ms`);
    
    if (finalTime > 5000) {
      console.warn(`IPTV 页加载时间过长: ${finalTime} ms`);
    }
  });
});