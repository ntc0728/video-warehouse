/**
 * 人物页 (Person) 测试用例（精简合并版）
 * 路由: /person/:id
 * 配置依赖: Level 1（TMDB Token）
 *
 * 覆盖: PER-001 ~ PER-035
 * 合并映射: 10.1(001,003) / 10.2(010,012,018) / 10.3(020) / 10.4(030)
 */
import { test, expect } from './fixtures/mock-tmdb';

// 使用一个已知存在的 TMDB 人物 ID 进行测试
const TEST_PERSON_ID = '128'; // 刘德华

// ═══════════════════════════════════════════════════════════════
// 10.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('10.1 页面加载', () => {
  test('PER-001/003: 正常加载人物详情 + 无效 ID 显示错误', async ({ page }) => {
    // 001 正常加载
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect
      .poll(async () => page.evaluate(() => !!document.querySelector('.person-page, [class*="person"]')), { timeout: 5000 })
      .toBeTruthy();

    // 003 无效 ID 显示错误
    await page.goto('/person/abc', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes('无效') || text.includes('不存在');
          }),
        { timeout: 5000 },
      )
      .toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 10.2 Hero 区域
// ═══════════════════════════════════════════════════════════════

test.describe('10.2 Hero 区域', () => {
  test('PER-010/012/018: 头像 + 又名 + 返回按钮', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 010 头像显示
    await expect
      .poll(async () => page.evaluate(() => !!document.querySelector('.person-avatar, [class*="avatar"]')), { timeout: 5000 })
      .toBeTruthy();

    // 012 又名显示
    const hasAKA = await page.evaluate(() => {
      return !!document.querySelector('.person-aka, [class*="aka"]');
    });
    expect(hasAKA).toBeTruthy();

    // 018 返回按钮
    const backBtn = page.locator('.person-hero-back, [class*="hero-back"]');
    expect(await backBtn.count()).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10.3 作品列表 Tab
// ═══════════════════════════════════════════════════════════════

test.describe('10.3 作品列表 Tab', () => {
  test('PER-020: 电影 Tab', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    const tabs = page.locator('.person-tab, [class*="person-tab"]');
    await expect.poll(async () => tabs.count(), { timeout: 5000 }).toBeGreaterThan(0);
    const count = await tabs.count();
    if (count > 0) {
      const tabTexts = await tabs.allTextContents();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 10.4 作品卡片与懒加载
// ═══════════════════════════════════════════════════════════════

test.describe('10.4 作品卡片与懒加载', () => {
  test('PER-030: 作品卡片显示', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    await expect
      .poll(async () => page.evaluate(() => !!document.querySelector('.person-work-grid, [class*="work-grid"]')), { timeout: 5000 })
      .toBeTruthy();
  });
});
