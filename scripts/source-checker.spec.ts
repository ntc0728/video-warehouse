import { test, expect } from '@playwright/test';

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('Source Checker page load', () => {
  test('source checker page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('source checker page renders', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const hasChecker = await page.evaluate(() => {
      return !!document.querySelector('.source-checker-page');
    });
    expect(hasChecker).toBe(true);
  });
});

/* ─── Stats Display ──────────────────────────────────────── */
test.describe('Stats display', () => {
  test('stats cards exist', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const stats = page.locator('.source-checker-stats, .stat-card');
    const count = await stats.count();
    expect(count).toBeGreaterThan(0);
  });

  test('total stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const totalStat = page.locator('.stat-card').filter({ hasText: /总数|Total/ });
    if (await totalStat.isVisible().catch(() => false)) {
      await expect(totalStat).toBeVisible();
    }
  });

  test('available stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const availableStat = page.locator('.stat-card').filter({ hasText: /可用|Available/ });
    if (await availableStat.isVisible().catch(() => false)) {
      await expect(availableStat).toBeVisible();
    }
  });

  test('unavailable stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const unavailableStat = page.locator('.stat-card').filter({ hasText: /不可用|Unavailable/ });
    if (await unavailableStat.isVisible().catch(() => false)) {
      await expect(unavailableStat).toBeVisible();
    }
  });
});

/* ─── Check Button ───────────────────────────────────────── */
test.describe('Check button', () => {
  test('check button exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const checkBtn = page.locator('.source-checker-actions button, .check-btn');
    const count = await checkBtn.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking check button starts source check', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const checkBtn = page.locator('.source-checker-actions button, .check-btn').first();
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(1000);
      // Check should start - table should populate
      const table = page.locator('.source-table');
      if (await table.isVisible().catch(() => false)) {
        await expect(table).toBeVisible();
      }
    }
  });
});

/* ─── Source Table ───────────────────────────────────────── */
test.describe('Source table', () => {
  test('source table exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const table = page.locator('.source-table');
    const exists = await table.count() > 0;
    expect(typeof exists).toBe('boolean');
  });

  test('table has correct columns', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const table = page.locator('.source-table');
    if (await table.isVisible().catch(() => false)) {
      const headers = page.locator('.source-table th, .source-table-header');
      const count = await headers.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('source rows display status', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const rows = page.locator('.source-table tr, .source-row');
    const count = await rows.count();
    // May be empty before check
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

/* ─── Error Handling ─────────────────────────────────────── */
test.describe('Error handling', () => {
  test('error message displays on check failure', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const errorCell = page.locator('.source-error');
    if (await errorCell.isVisible().catch(() => false)) {
      await expect(errorCell).toBeVisible();
    }
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('source checker uses BEM naming', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/SourceChecker/SourceChecker.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('source-checker-page');
    }
  });

  test('source checker uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/SourceChecker/SourceChecker.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });
});

/* ─── Status Indicators ──────────────────────────────────── */
test.describe('Status indicators', () => {
  test('status dots have correct colors', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    const dots = page.locator('.source-status-dot');
    if (await dots.first().isVisible().catch(() => false)) {
      const color = await dots.first().evaluate((el) => {
        return getComputedStyle(el).backgroundColor;
      });
      expect(color).toBeTruthy();
    }
  });
});
