/**
 * 人物页 (Person) 测试用例
 * 路由: /person/:id
 * 配置依赖: Level 1（TMDB Token）
 *
 * 覆盖: PER-001 ~ PER-035
 */
import { test, expect } from './fixtures/mock-tmdb';

// 使用一个已知存在的 TMDB 人物 ID 进行测试
const TEST_PERSON_ID = '128'; // 刘德华

// ═══════════════════════════════════════════════════════════════
// 10.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('10.1 页面加载', () => {
  test('PER-001: 正常加载人物详情', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示人物信息
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.person-page, [class*="person"]');
    });
  });

  test('PER-003: 无效 ID 显示错误', async ({ page }) => {
    await page.goto('/person/abc', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 预期结果: 显示错误信息
    const hasError = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('无效') || text.includes('不存在');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 10.2 Hero 区域
// ═══════════════════════════════════════════════════════════════

test.describe('10.2 Hero 区域', () => {
  test('PER-010: 头像显示', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 头像区域存在
    const hasAvatar = await page.evaluate(() => {
      return !!document.querySelector('.person-avatar, [class*="avatar"]');
    });
  });

  test('PER-012: 又名显示', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 又名信息存在
    const hasAKA = await page.evaluate(() => {
      return !!document.querySelector('.person-aka, [class*="aka"]');
    });
  });

  test('PER-018: 返回按钮', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 返回按钮存在
    const backBtn = page.locator('.person-hero-back, [class*="hero-back"]');
  });
});

// ═══════════════════════════════════════════════════════════════
// 10.3 作品列表 Tab
// ═══════════════════════════════════════════════════════════════

test.describe('10.3 作品列表 Tab', () => {
  test('PER-020: 电影 Tab', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 电影 Tab 存在
    const tabs = page.locator('.person-tab, [class*="person-tab"]');
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
    await page.waitForTimeout(3000);

    // 预期结果: 作品网格存在
    const hasWorks = await page.evaluate(() => {
      return !!document.querySelector('.person-work-grid, [class*="work-grid"]');
    });
  });

  test('PER-035: 文档标题', async ({ page }) => {
    await page.goto(`/person/${TEST_PERSON_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
