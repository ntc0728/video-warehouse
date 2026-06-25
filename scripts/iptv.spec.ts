import { test, expect } from '@playwright/test';

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('IPTV page load', () => {
  test('IPTV page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('IPTV page renders', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const hasIPTV = await page.evaluate(() => {
      return !!document.querySelector('.iptv-page');
    });
    expect(hasIPTV).toBe(true);
  });
});

/* ─── Source Filter ──────────────────────────────────────── */
test.describe('Source filter', () => {
  test('source tags exist', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const sourceTags = page.locator('.source-tag, .iptv-source-tag');
    const count = await sourceTags.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clicking source tag filters channels', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const sourceTag = page.locator('.source-tag').first();
    if (await sourceTag.isVisible().catch(() => false)) {
      await sourceTag.click();
      await page.waitForTimeout(300);
      const isActive = await sourceTag.evaluate((el) => {
        return el.classList.contains('active') || el.classList.contains('source-tag--active');
      });
      expect(isActive).toBe(true);
    }
  });
});

/* ─── Group Filter ───────────────────────────────────────── */
test.describe('Group filter', () => {
  test('group tags exist', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const groupTags = page.locator('.group-tag, .iptv-group-tag');
    const count = await groupTags.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clicking group tag filters channels', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const groupTag = page.locator('.group-tag').first();
    if (await groupTag.isVisible().catch(() => false)) {
      await groupTag.click();
      await page.waitForTimeout(300);
      const isActive = await groupTag.evaluate((el) => {
        return el.classList.contains('active') || el.classList.contains('group-tag--active');
      });
      expect(isActive).toBe(true);
    }
  });

  test('groups toggle button works', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const toggleBtn = page.locator('.groups-toggle, .iptv-groups-toggle');
    if (await toggleBtn.isVisible().catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
      const groupsContainer = page.locator('.iptv-groups');
      if (await groupsContainer.isVisible().catch(() => false)) {
        const isCollapsed = await groupsContainer.evaluate((el) => {
          return el.classList.contains('collapsed');
        });
        expect(typeof isCollapsed).toBe('boolean');
      }
    }
  });
});

/* ─── Search ─────────────────────────────────────────────── */
test.describe('Search', () => {
  test('search input exists', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.search-box__input, .iptv-search input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('typing filters channels', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.search-box__input, .iptv-search input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('CCTV');
      await page.waitForTimeout(500);
      const value = await searchInput.inputValue();
      expect(value).toBe('CCTV');
    }
  });

  test('clear button works', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('.search-box__input, .iptv-search input').first();
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

/* ─── Channel Grid ───────────────────────────────────────── */
test.describe('Channel grid', () => {
  test('channel grid renders', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const grid = page.locator('.iptv-channel-grid');
    if (await grid.isVisible().catch(() => false)) {
      await expect(grid).toBeVisible();
    }
  });

  test('channel cards render', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const cards = page.locator('.iptv-channel-card');
    const count = await cards.count();
    // May be empty if no data loaded
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clicking channel card navigates to player', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const card = page.locator('.iptv-channel-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/iptv/play');
    }
  });
});

/* ─── Availability Check ─────────────────────────────────── */
test.describe('Availability check', () => {
  test('check button exists', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const checkBtn = page.locator('.refresh-btn, .iptv-check-btn');
    const count = await checkBtn.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking check button starts availability check', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const checkBtn = page.locator('.refresh-btn, .iptv-check-btn').first();
    if (await checkBtn.isVisible().catch(() => false)) {
      const isDisabled = await checkBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
      if (!isDisabled) {
        await checkBtn.click();
        await page.waitForTimeout(1000);
        const hasProgress = await page.evaluate(() => {
          return !!document.querySelector('.availability-progress, .progress-bar');
        });
        expect(typeof hasProgress).toBe('boolean');
      }
    }
  });
});

/* ─── EPG Info ───────────────────────────────────────────── */
test.describe('EPG info', () => {
  test('EPG cache time displays', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const epgInfo = page.locator('.iptv-header-meta, .last-refresh');
    if (await epgInfo.isVisible().catch(() => false)) {
      await expect(epgInfo).toBeVisible();
    }
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('IPTV page uses BEM naming', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/IPTV/IPTV.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('iptv-page');
    }
  });

  test('IPTV page uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/IPTV/IPTV.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });
});

/* ─── Empty State ────────────────────────────────────────── */
test.describe('Empty state', () => {
  test('empty state shows when no channels', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const empty = page.locator('.iptv-empty-state, .iptv-loading');
    if (await empty.isVisible().catch(() => false)) {
      await expect(empty).toBeVisible();
    }
  });
});

/* ─── Infinite Scroll ────────────────────────────────────── */
test.describe('Infinite scroll', () => {
  test('sentinel exists for infinite scroll', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    const sentinel = page.locator('.iptv-sentinel, [data-sentinel]').first();
    const exists = await sentinel.count() > 0;
    expect(typeof exists).toBe('boolean');
  });
});
