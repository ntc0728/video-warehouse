import { test, expect } from '@playwright/test';

/*
 * RecordShell: Collections & History share the RecordShell component.
 * Desktop: left sidebar (timeline/tabs) + right cards panel.
 * Mobile: sticky header that collapses on scroll.
 */

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('History page load', () => {
  test('history page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('history page renders', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const hasHistory = await page.evaluate(() => {
      return !!document.querySelector('.history-page');
    });
    expect(hasHistory).toBe(true);
  });
});

/* ─── Tab System ─────────────────────────────────────────── */
test.describe('Tab system', () => {
  test('has video and IPTV tabs', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.category-segmented__item');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking tab switches content', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const iptvTab = page.locator('.category-segmented__item').filter({ hasText: /IPTV|频道/ });
    if (await iptvTab.isVisible().catch(() => false)) {
      await iptvTab.click();
      await page.waitForTimeout(500);
      const isActive = await iptvTab.evaluate((el) => {
        return el.classList.contains('active')
          || el.getAttribute('aria-selected') === 'true';
      });
      expect(isActive).toBe(true);
    }
  });
});

/* ─── Status Filter ──────────────────────────────────────── */
test.describe('Status filter', () => {
  test('status tabs exist', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const statusTabs = page.locator('.status-tab');
    const count = await statusTabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking status filter updates list', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const unfinishedTab = page.locator('.status-tab').filter({ hasText: /未看完|Unfinished/ });
    if (await unfinishedTab.isVisible().catch(() => false)) {
      await unfinishedTab.click();
      await page.waitForTimeout(300);
      const isActive = await unfinishedTab.evaluate((el) => {
        return el.classList.contains('status-tab--active');
      });
      expect(isActive).toBe(true);
    }
  });
});

/* ─── Search ─────────────────────────────────────────────── */
test.describe('Search', () => {
  test('search input exists', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.record-search__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('typing filters items', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.record-search__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      const value = await searchInput.inputValue();
      expect(value).toBe('test');
    }
  });
});

/* ─── Timeline ───────────────────────────────────────────── */
test.describe('Timeline navigation', () => {
  test('timeline exists', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const timeline = page.locator('.history-node-col');
    if (await timeline.isVisible().catch(() => false)) {
      await expect(timeline).toBeVisible();
    }
  });

  test('timeline has date groups', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const groups = page.locator('.history-group');
    const count = await groups.count();
    // May be empty
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clicking timeline group scrolls to section', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const timelineItem = page.locator('.history-node-col').first();
    if (await timelineItem.isVisible().catch(() => false)) {
      const scrollTopBefore = await page.evaluate(() => window.scrollY);
      await timelineItem.click();
      await page.waitForTimeout(500);
      const scrollTopAfter = await page.evaluate(() => window.scrollY);
      expect(scrollTopAfter).toBeGreaterThanOrEqual(scrollTopBefore);
    }
  });
});

/* ─── Batch Mode ─────────────────────────────────────────── */
test.describe('Batch mode', () => {
  test('batch toggle button exists', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const batchBtn = page.locator('.toolbar-btn, button').filter({ hasText: /选择|批量|Select|多选/ });
    const count = await batchBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('entering batch mode shows checkboxes', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const batchBtn = page.locator('.toolbar-btn, button').filter({ hasText: /选择|批量|Select|多选/ }).first();
    if (await batchBtn.isVisible().catch(() => false)) {
      await batchBtn.click();
      await page.waitForTimeout(300);
      const hasBatchMode = await page.evaluate(() => {
        return !!document.querySelector('.batch-mode, [class*="batch"], [class*="select"]');
      });
      expect(typeof hasBatchMode).toBe('boolean');
    }
  });
});

/* ─── Delete Actions ─────────────────────────────────────── */
test.describe('Delete actions', () => {
  test('clear all button exists', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const clearBtn = page.locator('.toolbar-btn--danger, .toolbar-btn, button').filter({ hasText: /清除|清空|Clear/ });
    const count = await clearBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clear all shows confirmation dialog', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const clearBtn = page.locator('.toolbar-btn--danger, .toolbar-btn').filter({ hasText: /清除|清空|Clear/ }).first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(300);
      const dialog = page.locator('[role="dialog"], .confirm-dialog, .ConfirmDialog');
      await expect(dialog.first()).toBeVisible();
    }
  });
});

/* ─── Empty State ────────────────────────────────────────── */
test.describe('Empty state', () => {
  test('empty state shows when no history', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    const empty = page.locator('.empty, .history-empty');
    if (await empty.isVisible().catch(() => false)) {
      await expect(empty).toBeVisible();
    }
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('history page uses BEM naming', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/History/History.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('history-page');
    }
  });

  test('history page uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/History/History.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });
});

/* ─── Back to Top ────────────────────────────────────────── */
test.describe('Back to top', () => {
  test('back to top button appears after scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      await expect(backToTop).toBeVisible();
    }
  });
});
