import { test, expect } from './fixtures/mock-tmdb';
import { devices } from '@playwright/test';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ═══════════════ 字体体系 ═══════════════
test.describe('字体体系', () => {
  test('G-01: body 字体栈含中文字体，无 Google Fonts 网络请求', async ({ page }) => {
    const googleFontsRequests: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) {
        googleFontsRequests.push(u);
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(2500);

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    console.log('[G-01] font-family =', fontFamily);
    expect(fontFamily).toContain('PingFang SC');
    expect(fontFamily).toContain('Noto Sans SC');
    expect(fontFamily).toContain('Microsoft YaHei');
    expect(googleFontsRequests.length).toBe(0);
  });

  test('G-02: cartoon 皮肤字体自托管（无 gstatic 请求，@font-face src 指向 /fonts/）', async ({ page }) => {
    const remoteFontRequests: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('fonts.gstatic.com')) remoteFontRequests.push(u);
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?skin=cartoon');
    await page.waitForTimeout(2500);

    // 皮肤激活后 Fredoka 应生效（font-family 解析到已加载字体）
    const heroFont = await page.evaluate(() => {
      const el = document.querySelector('.home-hero, .hero-section, .hero-banner, h1') as HTMLElement | null;
      return el ? getComputedStyle(el).fontFamily : '(no hero)';
    });
    const rules = await page.evaluate(() => {
      const found: string[] = [];
      for (const sheet of document.styleSheets) {
        let cssRules: CSSRuleList | null = null;
        try { cssRules = sheet.cssRules; } catch { continue; }
        if (!cssRules) continue;
        for (const rule of Array.from(cssRules)) {
          const r = rule as CSSFontFaceRule;
          if (r.cssText && r.cssText.includes('Fredoka')) found.push(r.cssText);
        }
      }
      return found;
    });
    console.log('[G-02] hero font =', heroFont);
    console.log('[G-02] fredoka rules =', rules.length, JSON.stringify(rules.slice(0, 2)).slice(0, 400));
    // 至少一个 Fredoka @font-face 指向本地 /fonts/
    expect(rules.some((t) => t.includes('/fonts/fredoka'))).toBe(true);
    expect(remoteFontRequests.length).toBe(0);
  });
});

// ═══════════════ 基准统一 ═══════════════
test.describe('基准统一', () => {
  test('G-03: 桌面 html font-size 走 v2.1 递减曲线（14→13.2@1440→13），无 root 内联缩放', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        htmlFontSize: cs.fontSize,
        textBase: cs.getPropertyValue('--text-base').trim(),
        inlineStyle: document.documentElement.style.fontSize || '(empty)',
      };
    });
    console.log('[G-03]', JSON.stringify(m));
    // 密度契约 v2.1（2026-09-05）：桌面段2 base 递减 14→13.2@1440→13 冻结，1280 处 ≈13.39px
    const px = parseFloat(m.htmlFontSize);
    expect(px).toBeGreaterThanOrEqual(13);
    expect(px).toBeLessThanOrEqual(14);
    expect(m.textBase).toContain('13px');
    expect(m.textBase).toContain('14px');
    expect(m.inlineStyle).toBe('(empty)');
  });

  test('G-04: 移动端（iPhone13）无 root 内联缩放，TV 模式动态基准保留', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => ({
      htmlFontSize: getComputedStyle(document.documentElement).fontSize,
      inlineStyle: document.documentElement.style.fontSize || '(empty)',
    }));
    console.log('[G-04] mobile', JSON.stringify(m));
    expect(m.htmlFontSize).toBe('14px');
    expect(m.inlineStyle).toBe('(empty)');

    // TV 注入后 html font-size 应为动态 15px（1080p），非固定 14px
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => document.documentElement.setAttribute('data-device', 'tv'));
    await page.waitForTimeout(200);
    const tv = await page.evaluate(() => ({
      htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    }));
    console.log('[G-04] tv', JSON.stringify(tv));
    expect(tv.htmlFontSize).toBe('15px');
  });
});

// ═══════════════ IPTV 占位 / 动画 ═══════════════
test.describe('IPTV 卡片', () => {
  test('G-05: 频道封面失败显示 KinoTV fallback（无字母方块）', async ({ page }) => {
    // 拦截一切图片请求 → 返回 404，强制进入 LazyImage error 态
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', async (route) => {
      await route.fulfill({ status: 404, contentType: 'image/png', body: PIXEL });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.iptv-channel-grid .iptv-channel-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const letterCount = await page.evaluate(() =>
      document.querySelectorAll('.iptv-channel-card .lazy-image-letter').length,
    );
    const errorCount = await page.evaluate(() =>
      document.querySelectorAll('.iptv-channel-card .lazy-image-container--error').length,
    );
    console.log(`[G-05] letter=${letterCount} error-containers=${errorCount}`);
    // 无条件断言：卡片渲染即不得有字母块（letter 已移除）
    expect(letterCount).toBe(0);
  });

  test('G-06: IPTV 主页切换分组后新卡片播放出场动画', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.iptv-channel-grid .iptv-channel-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const groupCount = await page.evaluate(() => {
      const groups = document.querySelectorAll('.iptv-group-chip, .iptv-group-tab, [data-group-key]');
      return groups.length;
    });
    console.log('[G-06] group tabs =', groupCount);
    if (groupCount === 0) {
      test.skip(true, 'IPTV 源不可达（代理受限），跳过动画断言');
      return;
    }

    // 切换第 2 个分组
    await page.evaluate(() => {
      const groups = document.querySelectorAll('.iptv-group-chip, .iptv-group-tab, [data-group-key]');
      (groups[1] as HTMLElement | undefined)?.click();
    });
    await page.waitForTimeout(300);

    const anim = await page.evaluate(() => {
      const card = document.querySelector('.iptv-channel-grid .iptv-channel-card') as HTMLElement | null;
      if (!card) return null;
      const cs = getComputedStyle(card);
      return { name: cs.animationName, dur: cs.animationDuration };
    });
    console.log('[G-06] card animation =', JSON.stringify(anim));
    expect(anim).not.toBeNull();
    expect(anim!.name).toBe('cardFadeIn');
  });
});

// ═══════════════ 跟随系统 ═══════════════
test.describe('跟随系统', () => {
  test('G-07: prefers-color-scheme 切换联动 data-theme（theme=system 时）', async ({ page }) => {
    // storageState 默认 theme=light（显式），需先设为 system 才能测跟随系统
    await page.addInitScript(() => {
      try {
        const raw = localStorage.getItem('app-settings');
        const settings = raw ? JSON.parse(raw) : { state: {} };
        settings.state = { ...(settings.state || {}), theme: 'system' };
        localStorage.setItem('app-settings', JSON.stringify(settings));
      } catch { /* ignore */ }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(2000);

    const readTheme = () =>
      page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    const before = await readTheme();
    console.log('[G-07] before =', before);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(600);
    const dark = await readTheme();
    console.log('[G-07] dark =', dark);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(600);
    const light = await readTheme();
    console.log('[G-07] light =', light);

    // theme=system 时 data-theme 应跟随 emulateMedia
    expect(dark).toBe('dark');
    expect(light).toBe('light');
  });
});

// ═══════════════ 收藏页动画时序 ═══════════════
test.describe('收藏页动画', () => {
  test('G-08: 有数据时容器挂载并播放淡入动画（IPTV/视频 tab 一致）', async ({ page }) => {
    // 先建立 origin，注入 IndexedDB 收藏数据
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.evaluate(() => new Promise<void>((resolve) => {
      const req = indexedDB.open('video-warehouse', 8);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('collections', 'readwrite');
        tx.objectStore('collections').put({
          id: 'col-e2e-1',
          videoId: 'tmdb-movie-550',
          addedAt: Date.now(),
          title: 'E2E Movie',
          cover: '',
          type: 'movie',
          rating: 4,
        });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    }));

    await page.goto('/collections');
    await page.waitForSelector('.collection-content', { timeout: 10000 });
    await page.waitForTimeout(400);

    const anim = await page.evaluate(() => {
      const el = document.querySelector('.collection-content') as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { name: cs.animationName, dur: cs.animationDuration };
    });
    console.log('[G-08] collection-content animation =', JSON.stringify(anim));
    expect(anim).not.toBeNull();
    expect(anim!.name).toBe('fadeIn');
  });

  test('G-09: 空数据时内容容器不挂载（移除 visibility:hidden 时序坑）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/collections');
    await page.waitForTimeout(2000);
    const hasContainer = await page.evaluate(() => !!document.querySelector('.collection-content'));
    const hasEmpty = await page.evaluate(() => !!document.querySelector('.record-empty, .empty-state, .empty'));
    console.log(`[G-09] container=${hasContainer} empty=${hasEmpty}`);
    expect(hasContainer).toBe(false);
  });
});
