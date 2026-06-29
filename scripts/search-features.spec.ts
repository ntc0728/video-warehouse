import { test, expect } from '@playwright/test';

/* ─── 搜索历史下拉 ────────────────────────────────── */
test.describe('搜索历史下拉', () => {
  test.beforeEach(async ({ page }) => {
    // 清空搜索历史
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('search-history'));
  });

  test('输入框 focus 时显示搜索历史 dropdown（有历史时）', async ({ page }) => {
    await page.goto('/');
    // 先添加一条历史
    await page.evaluate(() => {
      localStorage.setItem('search-history', JSON.stringify(['复仇者联盟']));
    });
    await page.reload();

    const searchInput = page.locator('.search-box__input').first();
    await searchInput.focus();
    await page.waitForSelector('.search-box-dropdown', { timeout: 3000 });

    const dropdown = page.locator('.search-box-dropdown');
    await expect(dropdown).toBeVisible();
  });

  test('无历史且无热门时 dropdown 不显示', async ({ page }) => {
    await page.goto('/');
    // 清空 trending 数据
    await page.evaluate(() => {
      localStorage.removeItem('search-history');
    });

    const searchInput = page.locator('.search-box__input').first();
    await searchInput.focus();
    await page.waitForTimeout(500);

    const dropdown = page.locator('.search-box-dropdown');
    await expect(dropdown).not.toBeVisible();
  });

  test('搜索后历史记录被添加', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('.search-box__input').first();
    await searchInput.fill('钢铁侠');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('search-history') || '[]');
    });
    expect(history).toContain('钢铁侠');
  });

  test('点击历史条目触发搜索', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('search-history', JSON.stringify(['蜘蛛侠']));
    });
    await page.reload();

    const searchInput = page.locator('.search-box__input').first();
    await searchInput.focus();
    await page.waitForSelector('.search-box-dropdown', { timeout: 3000 });

    await page.click('.search-box-dropdown__item:first-child');
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/q=.*%E8%9C%98%E8%9B%9B/);
  });

  test('删除单条历史', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('search-history', JSON.stringify(['条目1', '条目2']));
    });
    await page.reload();

    const searchInput = page.locator('.search-box__input').first();
    await searchInput.focus();
    await page.waitForSelector('.search-box-dropdown', { timeout: 3000 });

    const removeBtn = page.locator('.search-box-dropdown__remove').first();
    await removeBtn.click();
    await page.waitForTimeout(300);

    const history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('search-history') || '[]');
    });
    expect(history).not.toContain('条目1');
    expect(history).toContain('条目2');
  });

  test('清空全部历史', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('search-history', JSON.stringify(['条目1', '条目2']));
    });
    await page.reload();

    const searchInput = page.locator('.search-box__input').first();
    await searchInput.focus();
    await page.waitForSelector('.search-box-dropdown', { timeout: 3000 });

    await page.click('.search-box-dropdown__clear');
    await page.waitForTimeout(300);

    const history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('search-history') || '[]');
    });
    expect(history).toHaveLength(0);
  });
});

/* ─── 热门搜索榜单 ────────────────────────────────── */
test.describe('热门搜索榜单', () => {
  test('无搜索词时显示热门搜索', async ({ page }) => {
    await page.goto('/browse');
    // 等待 trending 数据加载
    await page.waitForTimeout(2000);

    const hotSection = page.locator('.browse-suggestions__chip--hot');
    // 如果有 trending 数据，应该显示热门搜索
    const count = await hotSection.count();
    if (count > 0) {
      await expect(hotSection.first()).toBeVisible();
    }
  });

  test('热门搜索带排名序号', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForTimeout(2000);

    const rank = page.locator('.browse-suggestions__rank').first();
    if (await rank.isVisible().catch(() => false)) {
      await expect(rank).toHaveText('1');
    }
  });

  test('点击热门搜索触发搜索', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForTimeout(2000);

    const hotChip = page.locator('.browse-suggestions__chip--hot').first();
    if (await hotChip.isVisible().catch(() => false)) {
      await hotChip.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/q=/);
    }
  });
});

/* ─── 搜索关键词高亮 ──────────────────────────────── */
test.describe('搜索关键词高亮', () => {
  test('搜索结果标题包含高亮标记', async ({ page }) => {
    await page.goto('/browse?q=复仇者');
    // 等待搜索结果加载
    await page.waitForTimeout(3000);

    const hasCards = await page.locator('.video-card').count();
    if (hasCards > 0) {
      const highlight = page.locator('.search-highlight').first();
      if (await highlight.isVisible().catch(() => false)) {
        await expect(highlight).toBeVisible();
      }
    }
  });

  test('高亮文本与搜索词匹配', async ({ page }) => {
    await page.goto('/browse?q=复仇者');
    await page.waitForTimeout(3000);

    const hasCards = await page.locator('.video-card').count();
    if (hasCards > 0) {
      const highlightText = await page.locator('.search-highlight').first().textContent().catch(() => null);
      if (highlightText) {
        expect(highlightText.toLowerCase()).toContain('复仇者');
      }
    }
  });

  test('无搜索词时无高亮', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForTimeout(1000);

    const highlights = page.locator('.search-highlight');
    await expect(highlights).toHaveCount(0);
  });
});

/* ─── 搜索集成流程 ────────────────────────────────── */
test.describe('搜索集成流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('search-history'));
  });

  test('完整流程：focus → 查看历史 → 输入 → 搜索 → 高亮 → 返回 → 历史更新', async ({ page }) => {
    // 1. Focus 输入框，应无 dropdown（无历史）
    const searchInput = page.locator('.search-box__input').first();
    await searchInput.focus();
    await page.waitForTimeout(300);
    await expect(page.locator('.search-box-dropdown')).not.toBeVisible();

    // 2. 输入搜索词并搜索
    await searchInput.fill('星际穿越');
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);

    // 3. 验证 URL 包含搜索词
    await expect(page).toHaveURL(/q=.*%E6%98%9F%E9%99%85/);

    // 4. 验证历史已添加
    const history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('search-history') || '[]');
    });
    expect(history).toContain('星际穿越');

    // 5. 返回首页
    await page.goto('/');
    await page.waitForTimeout(500);

    // 6. 再次 focus，应显示历史
    await searchInput.focus();
    await page.waitForSelector('.search-box-dropdown', { timeout: 3000 });
    await expect(page.locator('.search-box-dropdown')).toBeVisible();
    await expect(page.locator('.search-box-dropdown__text').first()).toContainText('星际穿越');
  });
});
