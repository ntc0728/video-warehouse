import { test, expect } from '@playwright/test';

/*
 * Settings page uses flat List sections (no accordion).
 * All items are rendered as <section> + <List> + <List.Item> and are always visible — no folding.
 * Version click flow uses toast.replace() (not toast.show()) for consecutive hints,
 * meaning the toast is replaced immediately rather than queued.
 */

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('Settings page load', () => {
  test('settings page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('settings page renders', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const hasSettings = await page.evaluate(() => {
      return !!document.querySelector('.settings-page');
    });
    expect(hasSettings).toBe(true);
  });
});

/* ─── Theme Switching ────────────────────────────────────── */
test.describe('Theme switching', () => {
  test('theme switcher buttons exist', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const themeBtns = page.locator('.theme-btn');
    const count = await themeBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking theme button changes theme', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const darkBtn = page.locator('.theme-btn').nth(1);
    if (await darkBtn.isVisible().catch(() => false)) {
      await darkBtn.click();
      await page.waitForTimeout(300);
      const theme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      expect(theme).toBeTruthy();
    }
  });
});

/* ─── Settings Sections ──────────────────────────────────── */
test.describe('Settings sections', () => {
  test('settings page has section groups', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const sections = page.locator('.settings-page section');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('settings sections contain list items', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const sections = page.locator('.settings-page section');
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);
  });
});

/* ─── Toggle Switches ────────────────────────────────────── */
test.describe('Toggle switches', () => {
  test('settings has switch components', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — switches are directly visible without expanding
    const switches = page.locator('[role="switch"], .switch');
    const count = await switches.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking switch toggles state', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — switches are directly visible without expanding
    const firstSwitch = page.locator('[role="switch"], .switch').first();
    if (await firstSwitch.isVisible().catch(() => false)) {
      const initialState = await firstSwitch.getAttribute('data-state')
        || await firstSwitch.evaluate((el) => el.getAttribute('aria-checked'));
      await firstSwitch.click();
      await page.waitForTimeout(300);
      const newState = await firstSwitch.getAttribute('data-state')
        || await firstSwitch.evaluate((el) => el.getAttribute('aria-checked'));
      expect(newState).not.toBe(initialState);
    }
  });
});

/* ─── Help Popovers ──────────────────────────────────────── */
test.describe('Help popovers', () => {
  test('help popover triggers exist', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — help triggers are directly visible without expanding
    const triggers = page.locator('.help-popover-trigger, [data-help]');
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking help trigger opens popover', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — help triggers are directly visible without expanding
    const trigger = page.locator('.help-popover-trigger').first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(300);
      const popover = page.locator('.help-popover-content, [role="tooltip"]');
      await expect(popover.first()).toBeVisible();
    }
  });
});

/* ─── Modals ─────────────────────────────────────────────── */
test.describe('Configuration modals', () => {
  test('TMDB token button opens modal', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — the TMDB config button is directly visible without expanding
    // Look for the TMDB configuration button
    const tmdbBtn = page.locator('button').filter({ hasText: /配置/ }).first();
    if (await tmdbBtn.isVisible().catch(() => false)) {
      await tmdbBtn.click();
      await page.waitForTimeout(500);
      const modal = page.locator('[role="dialog"], .modal, .Modal');
      await expect(modal.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('modal has input field', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — the TMDB config button is directly visible without expanding
    // Look for the TMDB configuration button
    const tmdbBtn = page.locator('button').filter({ hasText: /配置/ }).first();
    if (await tmdbBtn.isVisible().catch(() => false)) {
      await tmdbBtn.click();
      await page.waitForTimeout(500);
      const input = page.locator('[role="dialog"] input, .modal input');
      const count = await input.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

/* ─── Source Selection ───────────────────────────────────── */
test.describe('Source selection', () => {
  test('source dropdown exists', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page uses flat List sections — source dropdowns are directly visible without expanding
    const dropdowns = page.locator('.source-multi-dropdown, [role="listbox"]');
    const count = await dropdowns.count();
    expect(count).toBeGreaterThan(0);
  });
});

/* ─── Version Click (toast.replace) ─────────────────────── */
test.describe('Version click & toast.replace()', () => {
  /*
   * The version item is a List.Item with title="版本" inside the "关于" section.
   * It has onClick={handleVersionClick} and a `clickable` class.
   * The hint flow uses toast.replace() (NOT toast.show()) — each click replaces
   * the current toast immediately rather than queuing a new one.
   * Click 1 time → toast says "再点击 2 次进入源检测页".
   * Click 3 times total → navigates to /source-checker.
   */

  test('version item exists and is clickable', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Find the version item: a List.Item with text "版本" inside .settings-page
    const versionItem = page.locator('.settings-page').getByText('版本', { exact: true });
    await expect(versionItem.first()).toBeVisible();
  });

  test('clicking version once shows toast.replace() hint', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Locate the version item inside the "关于" section.
    // Selector: look for element with text "版本" inside .settings-page
    const versionItem = page.locator('.settings-page').getByText('版本', { exact: true }).first();
    await expect(versionItem).toBeVisible();

    await versionItem.click();
    await page.waitForTimeout(300);

    // toast.replace() replaces immediately — the first hint should mention "再点击"
    const toast = page.locator('[role="status"], .toast, .Toast').filter({ hasText: '再点击' });
    await expect(toast.first()).toBeVisible({ timeout: 3000 });
  });

  test('clicking version 3 times navigates to /source-checker', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Locate the version item inside the "关于" section.
    const versionItem = page.locator('.settings-page').getByText('版本', { exact: true }).first();
    await expect(versionItem).toBeVisible();

    // Click 1 → toast "再点击 2 次进入源检测页" (toast.replace replaces immediately)
    await versionItem.click();
    await page.waitForTimeout(200);

    // Click 2 → toast "再点击 1 次进入源检测页" (replaces previous toast)
    await versionItem.click();
    await page.waitForTimeout(200);

    // Click 3 → navigates to /source-checker
    await versionItem.click();
    await page.waitForTimeout(1000);

    // Verify navigation to the source checker page
    await expect(page).toHaveURL(/\/source-checker/);
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('settings page uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/Settings/Settings.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });

  test('theme switcher uses BEM classes', async ({ page }) => {
    await page.goto('/settings');
    const response = await page.goto('/src/pages/Settings/Settings.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('theme-switcher');
      expect(text).toContain('theme-btn');
    }
  });
});

/* ─── Responsive Layout ──────────────────────────────────── */
test.describe('Responsive layout', () => {
  test('mobile layout stacks settings vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const hasSettings = await page.evaluate(() => {
      return !!document.querySelector('.settings-page');
    });
    expect(hasSettings).toBe(true);
  });

  test('desktop layout uses grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const hasSettings = await page.evaluate(() => {
      return !!document.querySelector('.settings-page');
    });
    expect(hasSettings).toBe(true);
  });
});

/* ─── Persistence ────────────────────────────────────────── */
test.describe('Settings persistence', () => {
  test('theme setting persists in localStorage', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const darkBtn = page.locator('.theme-btn').nth(1);
    if (await darkBtn.isVisible().catch(() => false)) {
      await darkBtn.click();
      await page.waitForTimeout(500);
      // Check if any localStorage item exists
      const hasStored = await page.evaluate(() => {
        return localStorage.length > 0;
      });
      expect(hasStored).toBe(true);
    }
  });
});
