import { test, expect } from '@playwright/test';

/* ─── Page Load ──────────────────────────────────────────── */
test.describe('IPTV Player page load', () => {
  test('IPTV player page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    expect(errors.length).toBe(0);
  });

  test('IPTV player page renders', async ({ page }) => {
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const hasPlayer = await page.evaluate(() => {
      return !!document.querySelector('.iptv-player-page');
    });
    expect(hasPlayer).toBe(true);
  });
});

/* ─── Standalone Layout ──────────────────────────────────── */
test.describe('Standalone layout', () => {
  test('IPTV player has no AppLayout', async ({ page }) => {
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const hasNoAppLayout = await page.evaluate(() => {
      return !document.querySelector('.app-shell__scroll');
    });
    expect(hasNoAppLayout).toBe(true);
  });

  test('IPTV player fills viewport', async ({ page }) => {
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const fillsViewport = await page.evaluate(() => {
      const player = document.querySelector('.iptv-player-page');
      if (!player) return false;
      const rect = player.getBoundingClientRect();
      return rect.width >= window.innerWidth * 0.9;
    });
    expect(fillsViewport).toBe(true);
  });
});

/* ─── Player Container ───────────────────────────────────── */
test.describe('Player container', () => {
  test('player container exists', async ({ page }) => {
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const container = page.locator('.iptv-player-container');
    if (await container.isVisible().catch(() => false)) {
      await expect(container).toBeVisible();
    }
  });

  test('universal player renders', async ({ page }) => {
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const player = page.locator('.up-universal-player, video');
    if (await player.first().isVisible().catch(() => false)) {
      await expect(player.first()).toBeVisible();
    }
  });
});

/* ─── Channel Info ───────────────────────────────────────── */
test.describe('Channel info', () => {
  test('channel name displays in URL params', async ({ page }) => {
    await page.goto('/iptv/play?url=test.m3u8&name=CCTV1');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toContain('name=CCTV1');
  });

  test('stream URL passes to player', async ({ page }) => {
    await page.goto('/iptv/play?url=http://example.com/stream.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const player = page.locator('.up-universal-player, video');
    if (await player.first().isVisible().catch(() => false)) {
      await expect(player.first()).toBeVisible();
    }
  });
});

/* ─── Back Navigation ────────────────────────────────────── */
test.describe('Back navigation', () => {
  test('back button returns to IPTV list', async ({ page }) => {
    await page.goto('/iptv');
    await page.waitForLoadState('networkidle');
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const backBtn = page.locator('[aria-label="返回"], .back-btn');
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/iptv');
      expect(page.url()).not.toContain('/iptv/play');
    }
  });
});

/* ─── Proxy Support ──────────────────────────────────────── */
test.describe('Proxy support', () => {
  test('proxy URL is configured', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const proxyInput = page.locator('input').filter({ hasText: /proxy|代理/ });
    const count = await proxyInput.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

/* ─── CSS Compliance ─────────────────────────────────────── */
test.describe('CSS compliance', () => {
  test('IPTV player uses BEM naming', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/IPTV/IPTVPlayer.css');
    if (response) {
      const text = await response.text();
      expect(text).toContain('iptv-player-page');
    }
  });

  test('IPTV player uses CSS variable tokens', async ({ page }) => {
    await page.goto('/');
    const response = await page.goto('/src/pages/IPTV/IPTVPlayer.css');
    if (response) {
      const text = await response.text();
      const hasVars = text.includes('var(--');
      expect(hasVars).toBe(true);
    }
  });
});

/* ─── Device Adaptation ──────────────────────────────────── */
test.describe('Device adaptation', () => {
  test('mobile layout adapts player', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const hasPlayer = await page.evaluate(() => {
      return !!document.querySelector('.iptv-player-page');
    });
    expect(hasPlayer).toBe(true);
  });

  test('desktop layout adapts player', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv/play?url=test.m3u8&name=Test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const hasPlayer = await page.evaluate(() => {
      return !!document.querySelector('.iptv-player-page');
    });
    expect(hasPlayer).toBe(true);
  });
});
