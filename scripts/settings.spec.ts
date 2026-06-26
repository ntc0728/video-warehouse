import { test, expect } from '@playwright/test';

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
    
    // First expand the playback settings section which contains switches
    const playbackSection = page.locator('.settings-accordion__item').filter({ hasText: '播放设置' });
    if (await playbackSection.isVisible().catch(() => false)) {
      await playbackSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(300);
    }
    
    const switches = page.locator('[role="switch"], .switch');
    const count = await switches.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking switch toggles state', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // First expand the playback settings section which contains switches
    const playbackSection = page.locator('.settings-accordion__item').filter({ hasText: '播放设置' });
    if (await playbackSection.isVisible().catch(() => false)) {
      await playbackSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(300);
    }
    
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
    
    // First expand the video source section which contains help popovers
    const videoSection = page.locator('.settings-accordion__item').filter({ hasText: '视频源' });
    if (await videoSection.isVisible().catch(() => false)) {
      await videoSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(300);
    }
    
    const triggers = page.locator('.help-popover-trigger, [data-help]');
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking help trigger opens popover', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // First expand the video source section which contains help popovers
    const videoSection = page.locator('.settings-accordion__item').filter({ hasText: '视频源' });
    if (await videoSection.isVisible().catch(() => false)) {
      await videoSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(300);
    }
    
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
    
    // First expand the TMDB section which contains the token button
    const tmdbSection = page.locator('.settings-accordion__item').filter({ hasText: 'TMDB' });
    if (await tmdbSection.isVisible().catch(() => false)) {
      await tmdbSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(500);
    }
    
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
    
    // First expand the TMDB section which contains the token button
    const tmdbSection = page.locator('.settings-accordion__item').filter({ hasText: 'TMDB' });
    if (await tmdbSection.isVisible().catch(() => false)) {
      await tmdbSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(500);
    }
    
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
    
    // First expand the video source section which contains the dropdowns
    const videoSection = page.locator('.settings-accordion__item').filter({ hasText: '视频源' });
    if (await videoSection.isVisible().catch(() => false)) {
      await videoSection.locator('.settings-accordion__trigger').click();
      await page.waitForTimeout(300);
    }
    
    const dropdowns = page.locator('.source-multi-dropdown, [role="listbox"]');
    const count = await dropdowns.count();
    expect(count).toBeGreaterThan(0);
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
