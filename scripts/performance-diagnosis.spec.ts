// 详细性能诊断测试
import { test, expect } from '@playwright/test';

test.describe('性能诊断', () => {
  test('IPTV 页面详细性能分析', async ({ page }) => {
    const startTime = Date.now();
    
    // 监听控制台日志
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'warn' || msg.type() === 'error') {
        logs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    
    // 监听网络请求
    const requests: { url: string; startTime: number; endTime?: number; duration?: number }[] = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        startTime: Date.now()
      });
    });
    
    page.on('response', response => {
      const request = requests.find(r => r.url === response.url() && !r.endTime);
      if (request) {
        request.endTime = Date.now();
        request.duration = request.endTime - request.startTime;
      }
    });
    
    console.log('开始加载 IPTV 页面...');
    await page.goto('http://127.0.0.1:3001/iptv', { waitUntil: 'domcontentloaded' });
    
    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    
    const totalTime = Date.now() - startTime;
    console.log(`总加载时间: ${totalTime} ms`);
    
    // 分析网络请求
    const slowRequests = requests.filter(r => r.duration && r.duration > 1000);
    console.log(`慢请求数量 (>1s): ${slowRequests.length}`);
    
    slowRequests.forEach(req => {
      console.log(`慢请求: ${req.url} - ${req.duration}ms`);
    });
    
    // 按域名分组统计
    const domainStats = new Map<string, { count: number; totalDuration: number }>();
    requests.forEach(req => {
      try {
        const domain = new URL(req.url).hostname;
        const stats = domainStats.get(domain) || { count: 0, totalDuration: 0 };
        stats.count++;
        stats.totalDuration += req.duration || 0;
        domainStats.set(domain, stats);
      } catch {
        // 忽略无效 URL
      }
    });
    
    console.log('\n域名统计:');
    domainStats.forEach((stats, domain) => {
      console.log(`${domain}: ${stats.count} 请求, 总耗时 ${stats.totalDuration}ms`);
    });
    
    // 检查页面状态
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 30000 });
    
    // 检查是否有加载指示器
    const loadingElements = await page.locator('[class*="loading"]').count();
    console.log(`加载指示器数量: ${loadingElements}`);
    
    // 检查控制台错误
    const errors = logs.filter(log => log.startsWith('[error]'));
    if (errors.length > 0) {
      console.log('\n控制台错误:');
      errors.forEach(error => console.log(error));
    }
    
    // 保存详细报告
    const report = {
      totalTime,
      slowRequests: slowRequests.map(r => ({
        url: r.url,
        duration: r.duration
      })),
      domainStats: Object.fromEntries(domainStats),
      errors: errors.length
    };
    
    console.log('\n性能报告:', JSON.stringify(report, null, 2));
  });

  test('首页性能分析', async ({ page }) => {
    const startTime = Date.now();
    
    // 监听网络请求
    const requests: { url: string; startTime: number; endTime?: number; duration?: number }[] = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        startTime: Date.now()
      });
    });
    
    page.on('response', response => {
      const request = requests.find(r => r.url === response.url() && !r.endTime);
      if (request) {
        request.endTime = Date.now();
        request.duration = request.endTime - request.startTime;
      }
    });
    
    console.log('开始加载首页...');
    await page.goto('http://127.0.0.1:3001', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const totalTime = Date.now() - startTime;
    console.log(`首页总加载时间: ${totalTime} ms`);
    
    // 分析慢请求
    const slowRequests = requests.filter(r => r.duration && r.duration > 1000);
    console.log(`慢请求数量 (>1s): ${slowRequests.length}`);
    
    slowRequests.forEach(req => {
      console.log(`慢请求: ${req.url} - ${req.duration}ms`);
    });
    
    // 检查关键元素
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 10000 });
    
    // 检查是否有 HeroBanner
    const heroBanner = page.locator('.hero-banner, [class*="hero"]');
    const heroCount = await heroBanner.count();
    console.log(`HeroBanner 元素数量: ${heroCount}`);
  });
});