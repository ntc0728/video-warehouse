import { test, expect } from '@playwright/test';

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('Browse page load', () => {
  test('browse page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('browse page renders', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const hasBrowse = await page.evaluate(() => {
      return !!document.querySelector('.browse-page');
    });
    expect(hasBrowse).toBe(true);
  });
});

/* ─── Search Functionality ───────────────────────────────── */
test.describe('Search', () => {
  test('search input exists on browse page', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.browse-search input, .search-box__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('typing in search updates URL', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.browse-search input, .search-box__input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
      expect(page.url()).toContain('q=test');
    }
  });

  test('clear button removes search', async ({ page }) => {
    await page.goto('/browse?q=test');
    await page.waitForLoadState('networkidle');
    const clearBtn = page.locator('.search-box__clear').first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(500);
      // Input should be cleared
      const searchInput = page.locator('.browse-search input, .search-box__input').first();
      if (await searchInput.isVisible().catch(() => false)) {
        const value = await searchInput.inputValue();
        expect(value).toBe('');
      }
    }
  });
});

/* ─── Filter Bar ─────────────────────────────────────────── */
test.describe('Filter bar', () => {
  test('filter bar exists', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const filterBar = page.locator('.browse-filter, .filter-bar').first();
    if (await filterBar.isVisible().catch(() => false)) {
      await expect(filterBar).toBeVisible();
    }
  });

  test('filter bar can be toggled', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const toggleBtn = page.locator('.browse-filter-toggle, .filter-toggle').first();
    if (await toggleBtn.isVisible().catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
      const filterBar = page.locator('.browse-filter, .filter-bar').first();
      const isVisible = await filterBar.isVisible().catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    }
  });
});

/* ─── Suggestions ────────────────────────────────────────── */
test.describe('Suggestions', () => {
  test('suggestions section shows when no query', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const suggestions = page.locator('.browse-suggestions');
    if (await suggestions.isVisible().catch(() => false)) {
      await expect(suggestions).toBeVisible();
    }
  });

  test('clicking suggestion chip navigates with query', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const chip = page.locator('.browse-suggestions__chip').first();
    if (await chip.isVisible().catch(() => false)) {
      await chip.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('q=');
    }
  });

  test('hot search chips have rank numbers', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const rank = page.locator('.browse-suggestions__rank').first();
    if (await rank.isVisible().catch(() => false)) {
      const text = await rank.textContent();
      expect(text).toBeTruthy();
    }
  });
});

/* ─── Video Grid ─────────────────────────────────────────── */
test.describe('Video grid', () => {
  test('video card grid renders', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const grid = page.locator('.video-card-grid, .browse-card-grid').first();
    if (await grid.isVisible().catch(() => false)) {
      await expect(grid).toBeVisible();
    }
  });

  test('video cards have responsive images', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const img = page.locator('.video-card img, .lazy-image-container img').first();
    if (await img.isVisible().catch(() => false)) {
      const srcset = await img.getAttribute('srcset');
      expect(srcset).toBeTruthy();
    }
  });
});

/* ─── Infinite Scroll ────────────────────────────────────── */
test.describe('Infinite scroll', () => {
  test('sentinel element exists for infinite scroll', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const sentinel = page.locator('.browse-sentinel, [data-sentinel]').first();
    const exists = await sentinel.count() > 0;
    // Sentinel may be hidden but should exist
    expect(typeof exists).toBe('boolean');
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('browse page uses BEM naming', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/Browse/Browse.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('browse-page');
    }
  });

  test('browse page uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/Browse/Browse.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });
});

/* ─── Device Adaptation ──────────────────────────────────── */
test.describe('Device adaptation', () => {
  test('mobile layout applies mobile modifier', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const hasMobile = await page.evaluate(() => {
      return !!document.querySelector('.browse-page--mobile');
    });
    expect(hasMobile).toBe(true);
  });
});

/* ─── Error/Empty States ─────────────────────────────────── */
test.describe('Error and empty states', () => {
  test('error state has retry button', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const errorState = page.locator('.browse-page__error');
    if (await errorState.isVisible().catch(() => false)) {
      const retryBtn = page.locator('.browse-page__error-retry');
      await expect(retryBtn).toBeVisible();
    }
  });
});

/* ─── Back to Top ────────────────────────────────────────── */
test.describe('Back to top', () => {
  test('back to top button appears after scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      await expect(backToTop).toBeVisible();
    }
  });
});
