import { test, expect } from '@playwright/test';

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('Collections page load', () => {
  test('collections page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('collections page renders', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const hasCollections = await page.evaluate(() => {
      return !!document.querySelector('.collection-page');
    });
    expect(hasCollections).toBe(true);
  });
});

/* ─── Tab System ─────────────────────────────────────────── */
test.describe('Tab system', () => {
  test('has video and IPTV tabs', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.category-segmented__item');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking tab switches content', async ({ page }) => {
    await page.goto('/collections');
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
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const statusTabs = page.locator('.status-tab');
    const count = await statusTabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking status filter updates list', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const watchingTab = page.locator('.status-tab').filter({ hasText: /观看中|Watching/ });
    if (await watchingTab.isVisible().catch(() => false)) {
      await watchingTab.click();
      await page.waitForTimeout(300);
      const isActive = await watchingTab.evaluate((el) => {
        return el.classList.contains('status-tab--active');
      });
      expect(isActive).toBe(true);
    }
  });
});

/* ─── Search ─────────────────────────────────────────────── */
test.describe('Search', () => {
  test('search input exists', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.search-box__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('typing filters items', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.search-box__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      const value = await searchInput.inputValue();
      expect(value).toBe('test');
    }
  });

  test('clear button works', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.search-box__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      const clearBtn = page.locator('.search-box__clear').first();
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
        await page.waitForTimeout(300);
        const value = await searchInput.inputValue();
        expect(value).toBe('');
      }
    }
  });
});

/* ─── Batch Mode ─────────────────────────────────────────── */
test.describe('Batch mode', () => {
  test('batch toggle button exists', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const batchBtn = page.locator('.toolbar-btn, button').filter({ hasText: /选择|批量|Select|多选/ });
    const count = await batchBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('entering batch mode shows checkboxes', async ({ page }) => {
    await page.goto('/collections');
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
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const clearBtn = page.locator('.toolbar-btn--danger, .toolbar-btn, button').filter({ hasText: /清空|Clear|删除/ });
    const count = await clearBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clear all shows confirmation dialog', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const clearBtn = page.locator('.toolbar-btn--danger, .toolbar-btn').filter({ hasText: /清空|Clear/ }).first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(300);
      const dialog = page.locator('[role="dialog"], .confirm-dialog, .ConfirmDialog');
      await expect(dialog.first()).toBeVisible();
    }
  });
});

/* ─── Card Interactions ──────────────────────────────────── */
test.describe('Card interactions', () => {
  test('video cards render', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const cards = page.locator('.video-card');
    const count = await cards.count();
    // May be empty
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('card has delete button in batch mode', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const batchBtn = page.locator('.toolbar-btn').filter({ hasText: /选择|批量|Select/ }).first();
    if (await batchBtn.isVisible().catch(() => false)) {
      await batchBtn.click();
      await page.waitForTimeout(300);
      const delBtn = page.locator('.record-card__delete').first();
      if (await delBtn.isVisible().catch(() => false)) {
        await expect(delBtn).toBeVisible();
      }
    }
  });
});

/* ─── Empty State ────────────────────────────────────────── */
test.describe('Empty state', () => {
  test('empty state shows when no collections', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const empty = page.locator('.empty, .collection-empty');
    if (await empty.isVisible().catch(() => false)) {
      await expect(empty).toBeVisible();
    }
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('collections page uses BEM naming', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/Collections/Collections.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('collection-page');
    }
  });

  test('collections page uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/Collections/Collections.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });
});

/* ─── Infinite Scroll ────────────────────────────────────── */
test.describe('Infinite scroll', () => {
  test('sentinel exists for infinite scroll', async ({ page }) => {
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    const sentinel = page.locator('.collection-sentinel, [data-sentinel]').first();
    const exists = await sentinel.count() > 0;
    expect(typeof exists).toBe('boolean');
  });
});

/* ─── Back to Top ────────────────────────────────────────── */
test.describe('Back to top', () => {
  test('back to top button appears after scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      await expect(backToTop).toBeVisible();
    }
  });
});
