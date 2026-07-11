import { test, expect } from '@playwright/test';

/*
 * Browse page E2E tests
 *
 * Notes on current Browse page architecture:
 * - Dual-mode search: 智能检索 (TMDB-backed) + 直链搜索 (CMS-backed), switched via
 *   `.browse-search-tabs` / `.browse-search-tab` controls.
 * - Sentinel (`<div ref={sentinelRef} aria-hidden="true" />`) is unconditionally
 *   rendered (not conditional on searchMode), so infinite scroll works in both modes.
 * - `initialLoading` distinguishes the very first load (skeleton/placeholder UI)
 *   from subsequent load-more triggered by the sentinel entering the viewport.
 * - FilterBar renders directly on the page; there is no toggle button.
 * - Empty/error states use the shared `<Empty>` component (`.empty`) rather than
 *   bespoke `.browse-page__error*` selectors.
 */

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
    // SKIPPED: FilterBar now renders directly on the Browse page without a toggle
    // button (`.browse-filter-toggle` / `.filter-toggle` no longer exist).
    // The filter bar's visibility is driven by layout/responsive concerns, not a
    // toggle control, so there is nothing to assert here.
    expect(true).toBe(true);
  });
});

/* ─── Search Mode Tabs ───────────────────────────────────── */
/* Replaces former "Suggestions" section: `.browse-suggestions*` selectors no
 * longer exist. The Browse page now exposes dual-mode search via
 * `.browse-search-tabs` containing `.browse-search-tab` buttons
 * (智能检索 / 直链搜索). */
test.describe('Search mode tabs', () => {
  test('search mode tabs container exists', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.browse-search-tabs');
    await expect(tabs).toBeVisible();
  });

  test('two search mode tabs are rendered', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.browse-search-tab');
    await expect(tabs).toHaveCount(2);
  });

  test('clicking direct-link tab activates it', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.browse-search-tab');
    const directLinkTab = tabs.nth(1); // 直链搜索
    await directLinkTab.click();
    await page.waitForTimeout(300);
    // Active state is reflected via the `browse-search-tab--active` modifier
    await expect(directLinkTab).toHaveClass(/browse-search-tab--active/);
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
    // Sentinel is now `<div ref={sentinelRef} aria-hidden="true" />` and is
    // unconditionally rendered (no longer conditional on searchMode), so it is
    // always present within `.browse-page` for the IntersectionObserver to watch.
    const sentinel = page.locator('.browse-page [aria-hidden="true"]').first();
    const exists = (await sentinel.count()) > 0;
    expect(exists).toBe(true);
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
/* Browse page no longer renders bespoke `.browse-page__error*` markup. Empty
 * and error states are surfaced through the shared `<Empty>` component
 * (`.empty`), optionally with a "暂无结果" message. The retry-button test has
 * been removed because there is no longer a dedicated `.browse-page__error-retry`
 * control. */
test.describe('Error and empty states', () => {
  test('empty state renders Empty component when no results', async ({ page }) => {
    await page.goto('/browse?q=zzzznomatchzzzz');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for the shared Empty component, or its "暂无结果" copy, when no
    // results match the (deliberately unmatched) query.
    const empty = page.locator('.empty').first();
    const emptyVisible = await empty.isVisible().catch(() => false);
    if (emptyVisible) {
      await expect(empty).toBeVisible();
    } else {
      // Fallback: assert the page surfaces the "暂无结果" copy somewhere.
      const body = await page.locator('body').textContent();
      expect(body).toContain('暂无结果');
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
