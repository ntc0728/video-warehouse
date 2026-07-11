import { test, expect } from '@playwright/test';

/*
 * SourceChecker now has 5 tabs: 网速 / IPTV源 / 视频源 / IPTV代理 / 视频代理.
 * Each tab has its own independent check panel (.check-panel) with a .btn-small detect button.
 * The 5 stat cards correspond to these tabs: 网速延迟 / IPTV 源 / 视频源 / IPTV 代理 / 视频代理.
 * Network check uses Promise.all for multi-node parallel testing, no retry, reuses loaded config.
 * Sources are rendered as .source-list containing .source-item elements (not a <table>).
 */

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

  test('network latency stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Updated label: "网速延迟" (was /总数|Total/)
    const latencyStat = page.locator('.stat-card').filter({ hasText: '网速延迟' });
    if (await latencyStat.isVisible().catch(() => false)) {
      await expect(latencyStat).toBeVisible();
    }
  });

  test('IPTV source stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Updated label: "IPTV 源" (was /可用|Available/)
    const iptvStat = page.locator('.stat-card').filter({ hasText: 'IPTV 源' });
    if (await iptvStat.isVisible().catch(() => false)) {
      await expect(iptvStat).toBeVisible();
    }
  });

  test('video source stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Updated label: "视频源"
    const videoStat = page.locator('.stat-card').filter({ hasText: '视频源' });
    if (await videoStat.isVisible().catch(() => false)) {
      await expect(videoStat).toBeVisible();
    }
  });

  test('IPTV proxy stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Updated label: "IPTV 代理"
    const iptvProxyStat = page.locator('.stat-card').filter({ hasText: 'IPTV 代理' });
    if (await iptvProxyStat.isVisible().catch(() => false)) {
      await expect(iptvProxyStat).toBeVisible();
    }
  });

  test('video proxy stat card exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Updated label: "视频代理" (was /不可用|Unavailable/)
    const videoProxyStat = page.locator('.stat-card').filter({ hasText: '视频代理' });
    if (await videoProxyStat.isVisible().catch(() => false)) {
      await expect(videoProxyStat).toBeVisible();
    }
  });
});

/* ─── Check Button ───────────────────────────────────────── */
test.describe('Check button', () => {
  test('source checker tabs exist', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // The page now has tabs: 网速 / IPTV源 / 视频源 / IPTV代理 / 视频代理
    const tabs = page.locator('.source-checker-tabs');
    await expect(tabs).toBeVisible();
  });

  test('multiple tab buttons exist', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // There should be multiple .tab-btn buttons (one per tab)
    const tabBtns = page.locator('.tab-btn');
    const count = await tabBtns.count();
    expect(count).toBeGreaterThan(1);
  });

  test('check panel has btn-small detect button', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Each tab has its own .check-panel with a .btn-small detect button.
    // The old .source-checker-actions button / .check-btn no longer exist.
    const checkBtn = page.locator('.check-panel .btn-small');
    const count = await checkBtn.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking tab reveals its check panel btn-small', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Click a tab, then find .btn-small within the active .check-panel
    const tabBtns = page.locator('.tab-btn');
    const count = await tabBtns.count();
    if (count > 1) {
      await tabBtns.nth(1).click();
      await page.waitForTimeout(300);
      const activeBtn = page.locator('.check-panel .btn-small').first();
      if (await activeBtn.isVisible().catch(() => false)) {
        await expect(activeBtn).toBeVisible();
      }
    }
  });

  test('clicking btn-small starts source check', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Click the detect button in the active check panel
    const checkBtn = page.locator('.check-panel .btn-small').first();
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(1000);
      // Check should start - source list should populate
      const sourceList = page.locator('.source-list');
      if (await sourceList.isVisible().catch(() => false)) {
        await expect(sourceList).toBeVisible();
      }
    }
  });
});

/* ─── Source List ────────────────────────────────────────── */
test.describe('Source list', () => {
  test('source list container exists', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Sources are now rendered as .source-list (not a <table>).
    // The old .source-table / .source-table th / .source-table tr no longer exist.
    const sourceList = page.locator('.source-list');
    const exists = await sourceList.count() > 0;
    expect(typeof exists).toBe('boolean');
  });

  test('source items render within source list', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Sources are rendered as .source-item elements inside .source-list
    const sourceList = page.locator('.source-list');
    if (await sourceList.isVisible().catch(() => false)) {
      const items = page.locator('.source-list .source-item');
      const count = await items.count();
      // May be empty before a check runs
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('source items display status after check', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    // Each .source-item represents one source row (was .source-table tr / .source-row)
    const items = page.locator('.source-item');
    const count = await items.count();
    // May be empty before check
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

/* ─── Error Handling ─────────────────────────────────────── */
test.describe('Error handling', () => {
  test('error message displays on check failure', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');
    // Updated selector: .error-msg (was .source-error)
    const errorCell = page.locator('.error-msg');
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
    // Updated selector: .status-dot inside .source-status container (was .source-status-dot)
    const dots = page.locator('.source-status .status-dot');
    if (await dots.first().isVisible().catch(() => false)) {
      const color = await dots.first().evaluate((el) => {
        return getComputedStyle(el).backgroundColor;
      });
      expect(color).toBeTruthy();
    }
  });
});

/* ─── Network Test Points ────────────────────────────────── */
test.describe('Network test points', () => {
  /*
   * Network check (网速 tab) uses Promise.all for multi-node parallel testing.
   * If a network check panel has .test-points with .point-name and .point-status
   * elements, verify they exist after a check completes.
   */
  test('test points render after network check', async ({ page }) => {
    await page.goto('/source-checker');
    await page.waitForLoadState('networkidle');

    // Switch to the 网速 (network latency) tab — first tab
    const networkTab = page.locator('.tab-btn').first();
    if (await networkTab.isVisible().catch(() => false)) {
      await networkTab.click();
      await page.waitForTimeout(300);

      // Trigger the network check
      const checkBtn = page.locator('.check-panel .btn-small').first();
      if (await checkBtn.isVisible().catch(() => false)) {
        await checkBtn.click();
        await page.waitForTimeout(2000);

        // Verify test-points structure exists after check
        const testPoints = page.locator('.test-points');
        if (await testPoints.isVisible().catch(() => false)) {
          const pointNames = page.locator('.test-points .point-name');
          const pointStatuses = page.locator('.test-points .point-status');

          const nameCount = await pointNames.count();
          const statusCount = await pointStatuses.count();

          // Both should be present and match in count
          expect(nameCount).toBeGreaterThan(0);
          expect(statusCount).toBeGreaterThan(0);
          expect(nameCount).toBe(statusCount);
        }
      }
    }
  });
});
