/**
 * UI 整改验证（2026-08-12）—— 对应 6 项 UI 需求
 *
 * 需求映射：
 *  UI-001/002/003/004/005/006/007/008/009
 *   - 需求1：移动 web 顶栏头像+用户名、抽屉设置项移底 → UI-003 / UI-004
 *   - 需求2：桌面侧边栏底部设置+版本号 → UI-002
 *   - 需求3：桌面隐藏 category-quick-access + 无选中样式 → UI-001
 *   - 需求4a：移动 hover 图标越界 → UI-005
 *   - 需求4b/4c：browse 残留词/旧数据/闪烁/缺 loading → UI-006
 *   - 需求5：设置子页过渡动画 → UI-007
 *   - 需求6：modal 全宽无间隙 → UI-008 / UI-009
 */
import { test, expect } from './fixtures/mock-tmdb';
import { devices } from '@playwright/test';

/** iPhone 13 设备仿真（hasTouch → pointer 媒体查询为 coarse）；
    去掉 defaultBrowserType（webkit），本项目仅跑 chromium */
const { defaultBrowserType: _dbt, ...IPHONE_13 } = devices['iPhone 13'];

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ═══════════════ 桌面端（1280x720） ═══════════════
test.describe('桌面端', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('UI-001: 桌面不显示 category-quick-access，且无选中样式', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);
    const display = await page.evaluate(() => {
      const el = document.querySelector('.category-quick-access') as HTMLElement | null;
      return el ? getComputedStyle(el).display : 'not-found';
    });
    expect(display).toBe('none');

    // 侧边栏点「电影」类目 → 组件仍不显示、无 --active 类
    await page.locator('.home-sidebar__item', { hasText: '电影' }).first().click();
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => {
      const el = document.querySelector('.category-quick-access') as HTMLElement | null;
      return {
        display: el ? getComputedStyle(el).display : 'not-found',
        activeCards: document.querySelectorAll('.category-quick-access__card--active').length,
      };
    });
    expect(state.display).toBe('none');
    expect(state.activeCards).toBe(0);
  });

  test('UI-002: 桌面侧边栏底部有设置入口+版本号，顶栏无设置项', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    const sidebar = await page.evaluate(() => {
      const footer = document.querySelector('.home-sidebar__footer');
      return {
        hasFooter: !!footer,
        hasSettingsBtn: !!footer?.querySelector('.home-sidebar__footer-btn'),
        btnText: footer?.querySelector('.home-sidebar__footer-label')?.textContent?.trim() ?? '',
        version: footer?.querySelector('.home-sidebar__version')?.textContent?.trim() ?? '',
      };
    });
    expect(sidebar.hasFooter).toBe(true);
    expect(sidebar.hasSettingsBtn).toBe(true);
    expect(sidebar.btnText).toBe('设置');
    expect(sidebar.version).toMatch(/^v\d+\.\d+\.\d+$/);

    const topNavTitles = await page.evaluate(() =>
      [...document.querySelectorAll('.sticky-header__nav-item')].map((el) => (el as HTMLElement).title),
    );
    expect(topNavTitles).not.toContain('设置');
  });
});

// ═══════════════ 移动端（iPhone 13 设备仿真：hasTouch → pointer:coarse） ═══════════════
test.describe('移动端', () => {
  test.use({ ...IPHONE_13 });

  test('UI-003: 顶栏头像+用户名入口，点击进入个人设置页', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const raw = localStorage.getItem('app-settings');
        const settings = raw ? JSON.parse(raw) : { state: {} };
        settings.state = { ...(settings.state || {}), username: 'KinoUser', avatar: '' };
        localStorage.setItem('app-settings', JSON.stringify(settings));
      } catch { /* ignore */ }
    });
    await page.goto('/');
    await page.waitForTimeout(1500);

    const profile = page.locator('.sticky-header__profile');
    await expect(profile).toBeVisible();
    await expect(profile.locator('.sticky-header__profile-name')).toHaveText('KinoUser');

    await profile.click();
    await page.waitForTimeout(800);
    expect(page.url()).toContain('/settings');
    expect(page.url()).toContain('tab=personal');
    await expect(page.locator('.settings-subpage')).toBeVisible();
  });

  test('UI-004: 抽屉侧边栏设置项移到底部，列表内无设置', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.locator('.sticky-header__menu-btn').click();
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const nav = document.querySelector('.sidebar-container--mobile .sidebar-nav');
      const footer = document.querySelector('.sidebar-container--mobile .sidebar-footer');
      return {
        navHasSettings: !!nav && nav.textContent!.includes('设置'),
        footerHasSettings: !!footer && footer.textContent!.includes('设置'),
        navItemCount: nav?.querySelectorAll('.sidebar-nav-item').length ?? 0,
      };
    });
    expect(state.navHasSettings).toBe(false);
    expect(state.footerHasSettings).toBe(true);
    expect(state.navItemCount).toBe(5); // 首页/搜索中心/IPTV/收藏/历史记录
  });

  test('UI-005: 触摸端 hover 分类卡片图标不越界', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    const card = page.locator('.category-quick-access__card').nth(1);
    await card.hover();
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const cardEl = document.querySelectorAll('.category-quick-access__card')[1] as HTMLElement | null;
      const iconEl = document.querySelectorAll('.category-quick-access__icon-wrap')[1] as HTMLElement | null;
      if (!cardEl || !iconEl) return null;
      const cardRect = cardEl.getBoundingClientRect();
      const iconRect = iconEl.getBoundingClientRect();
      return {
        // 图标必须完全位于卡片范围内（不越界）
        iconTopVsCard: iconRect.top - cardRect.top,
        iconBottomVsCard: iconRect.bottom - cardRect.bottom,
        cardTransform: getComputedStyle(cardEl).transform,
      };
    });
    expect(m).not.toBeNull();
    expect(m!.iconTopVsCard).toBeGreaterThanOrEqual(0);
    expect(m!.iconBottomVsCard).toBeLessThanOrEqual(0);
  });

  test('UI-006: 搜索后回首页点分类 → 搜索框清空 + loading + 新数据（无旧数据残留）', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    // 1) 顶栏搜索「spider」进入 browse
    const input = page.locator('.sticky-header__search .search-box__input');
    await input.fill('spider');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // 2) 回首页
    await page.locator('.sticky-header__logo-group').click();
    await page.waitForTimeout(800);

    // 3) 点「电影」分类 → browse
    await page.locator('.category-quick-access__card', { hasText: '电影' }).click();

    // 进入 browse 后：搜索框为空 + loading 遮罩出现（无旧数据闪现）。
    // 用 waitForFunction 轮询：等待 browse 结果区渲染且处于 loading 态
    // （refreshNow 置 isRefreshing 至少 150ms + fetch 期间，窗口足够捕获）。
    const loadingSeen = await page
      .waitForFunction(() => {
        const body = document.querySelector('.browse-results-body');
        if (!body) return false;
        return !!body.querySelector('.app-loading');
      }, { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    expect(loadingSeen).toBe(true);

    const enteringValue = await page.evaluate(
      () => (document.querySelector('.sticky-header__search .search-box__input') as HTMLInputElement)?.value ?? null,
    );
    expect(enteringValue).toBe('');

    // 等待数据就绪：搜索框保持空、结果网格有数据
    await page.waitForTimeout(2500);
    const settled = await page.evaluate(() => ({
      value: (document.querySelector('.sticky-header__search .search-box__input') as HTMLInputElement)?.value ?? null,
      loading: !!document.querySelector('.browse-results-body .app-loading'),
      gridChildren: document.querySelectorAll('.browse-card--results [class*="grid"] > *').length,
    }));
    expect(settled.value).toBe('');
    expect(settled.loading).toBe(false);
    expect(settled.gridChildren).toBeGreaterThan(0);
  });

  test('UI-007: 设置子页进入有过渡动画', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1500);
    await page.locator('.settings-menu-item').first().click();
    await page.waitForTimeout(150);
    const anim = await page.evaluate(() => {
      const el = document.querySelector('.settings-subpage') as HTMLElement | null;
      return el ? getComputedStyle(el).animationName : null;
    });
    expect(anim).toBe('settings-subpage-in');
  });

  test('UI-008: source-modal 移动端全宽无间隙', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1500);
    await page.locator('.settings-menu-item', { hasText: '视频设置' }).first().click();
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const addBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '添加');
      addBtn?.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const manual = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('手动添加'));
      manual?.click();
    });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const el = document.querySelector('.source-modal-wrap') as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, vw: innerWidth, gapLeft: r.left, gapRight: innerWidth - r.right };
    });
    expect(m).not.toBeNull();
    expect(m!.gapLeft).toBeLessThanOrEqual(1);
    expect(m!.gapRight).toBeLessThanOrEqual(1);
  });

  test('UI-009: settings-modal 移动端全宽（回归）', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1500);
    await page.locator('.settings-menu-item', { hasText: '视频设置' }).first().click();
    await page.waitForTimeout(600);
    await page.locator('.settings-btn-mini').first().click();
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const el = document.querySelector('.settings-modal') as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, vw: innerWidth, gapLeft: r.left, gapRight: innerWidth - r.right };
    });
    expect(m).not.toBeNull();
    expect(m!.gapLeft).toBeLessThanOrEqual(1);
    expect(m!.gapRight).toBeLessThanOrEqual(1);
  });
});
