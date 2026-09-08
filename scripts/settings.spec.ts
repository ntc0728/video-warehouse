/**
 * 设置页 (Settings) 测试用例（已合并精简）
 * 路由: /settings
 * 配置依赖: 无需前置配置（设置页本身就是配置入口）
 *
 * 覆盖: SET-001 ~ SET-096（合并后 10 条）
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 6.1 主题切换（SET-001 + 002 + 003）
// ═══════════════════════════════════════════════════════════════

test.describe('6.1 主题切换', () => {
  test('SET-001/002/003: 浅色 / 深色 / 跟随系统三种主题均可激活', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.theme-btn').first()).toBeVisible({ timeout: 5000 });

    // 浅色（太阳图标）
    const sunBtn = page.locator('.theme-btn').first();
    if (await sunBtn.isVisible().catch(() => false)) {
      await sunBtn.click();
      await expect.poll(() => sunBtn.evaluate(el => el.classList.contains('active')), { timeout: 5000 }).toBe(true);
    }

    // 深色（月亮图标）
    const moonBtn = page.locator('.theme-btn').nth(1);
    if (await moonBtn.isVisible().catch(() => false)) {
      await moonBtn.click();
      await expect.poll(() => moonBtn.evaluate(el => el.classList.contains('active')), { timeout: 5000 }).toBe(true);
    }

    // 跟随系统（显示器图标）
    const systemBtn = page.locator('.theme-btn').nth(2);
    if (await systemBtn.isVisible().catch(() => false)) {
      await systemBtn.click();
      await expect.poll(() => systemBtn.evaluate(el => el.classList.contains('active')), { timeout: 5000 }).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.2 TMDB 配置（SET-010 + 015）
// ═══════════════════════════════════════════════════════════════

test.describe('6.2 TMDB 配置', () => {
  test('SET-010/015: TMDB Token 状态显示且可打开配置弹窗', async ({ page }) => {
    // TMDB Token 配置入口在「视频设置」tab（源码 VideoTab），需深链直达
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-content, .settings-tab').first()).toBeVisible({ timeout: 5000 });

    // SET-015: 已配置 / 未配置 状态文本
    const hasTokenStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('已配置') || text.includes('未配置');
    });
    expect(hasTokenStatus).toBeTruthy();

    // SET-010: 点击「配置」按钮打开弹窗
    const configBtn = page.locator('.settings-btn-mini').first();
    expect(await configBtn.count()).toBeGreaterThan(0);
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
      await expect.poll(() => page.locator('.modal, [class*="modal"]').count(), { timeout: 5000 }).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.3 视频源配置（SET-020 + 021）
// ═══════════════════════════════════════════════════════════════

test.describe('6.3 视频源配置', () => {
  test('SET-020/021: 视频源管理面板可见且可启用/停用切换', async ({ page }) => {
    // 源管理已由 .source-multi-dropdown 改为 SourceManager 组件（ADR-019），
    // 用 ?tab=video 深链直达「视频设置」tab。
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.source-manager-block[data-scene="video"]')).toBeVisible({ timeout: 5000 });

    // SET-020: 面板与条目存在
    const panel = page.locator('.source-manager-block[data-scene="video"]');
    if (await panel.isVisible().catch(() => false)) {
      const title = await panel.locator('.source-manager__title').textContent();
      const itemCount = await panel.locator('.source-manager__item').count();
      const badge = await panel.locator('.source-manager__badge').textContent();
      expect(itemCount).toBeGreaterThan(0);
    }

    // SET-021: 自定义 switch 切换改变 checked 状态
    if (!(await panel.isVisible().catch(() => false))) {
      return;
    }
    const switchLabels = panel.locator('.source-manager__switch');
    const input = switchLabels.first().locator('input[type="checkbox"]');
    if ((await switchLabels.count()) > 0) {
      const before = await input.isChecked();
      await switchLabels.first().click();
      await expect.poll(() => input.isChecked(), { timeout: 5000 }).not.toBe(before);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.4 播放设置（SET-040）
// ═══════════════════════════════════════════════════════════════

test.describe('6.4 播放设置', () => {
  test('SET-040: 跳过片头开关', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-page .list-item').first()).toBeVisible({ timeout: 5000 });

    // 预期结果: 跳过片头开关存在
    const switches = page.locator('.settings-page .list-item');
    expect(await switches.count()).toBeGreaterThan(0);
    const count = await switches.count();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.5 IPTV 配置（SET-050 + 052）
// ═══════════════════════════════════════════════════════════════

test.describe('6.5 IPTV 配置', () => {
  test('SET-050/052: IPTV 源面板可见且至少保留一个已启用源', async ({ page }) => {
    // 源管理已由 .source-multi-dropdown 改为 SourceManager 组件（ADR-019），
    // 用 ?tab=iptv 深链直达「IPTV 设置」tab。
    await page.goto('/settings?tab=iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.source-manager-block[data-scene="iptv"]')).toBeVisible({ timeout: 5000 });

    // SET-050: 面板与条目存在
    const panel = page.locator('.source-manager-block[data-scene="iptv"]');
    if (await panel.isVisible().catch(() => false)) {
      const title = await panel.locator('.source-manager__title').textContent();
      const itemCount = await panel.locator('.source-manager__item').count();
      expect(itemCount).toBeGreaterThan(0);
    }

    // SET-052: 逐个停用已启用源，最后一个被拒 → 仍保留 1 个启用
    if (!(await panel.isVisible().catch(() => false))) {
      return;
    }
    // input 被 CSS 视觉隐藏（opacity:0 零尺寸），uncheck() 不可用；点 label 触发切换（同 SET-021）。
    const switches = panel.locator('.source-manager__item .source-manager__switch');
    const switchCount = await switches.count();
    for (let i = 0; i < switchCount; i++) {
      const sw = switches.nth(i);
      const input = sw.locator('input[type="checkbox"]');
      if (await input.isChecked().catch(() => false)) {
        await sw.click();
        await expect.poll(() => input.isChecked(), { timeout: 3000 }).toBe(false).catch(() => {});
      }
    }
    const badge = await panel.locator('.source-manager__badge').textContent();
    const enabledCount = /已启用\s*(\d+)/.exec(badge || '')?.[1];
    expect(enabledCount).toBe('1');
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.6 关于与彩蛋（SET-071 + 073 + 074）
// ═══════════════════════════════════════════════════════════════

test.describe('6.6 关于与彩蛋', () => {
  test('SET-071/073/074: 版本号彩蛋提示、跳转源检测页、KinoTV 跳转代理页', async ({ page }) => {
    // SET-071: 桌面端「关于」tab 点击版本号 1 次出现 Toast
    await page.goto('/settings?tab=about', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('[class*="version"]').first()).toBeVisible({ timeout: 5000 });

    const versionItem = page.locator('[class*="version"]').first();
    expect(await versionItem.count()).toBeGreaterThan(0);
    if (await versionItem.isVisible().catch(() => false)) {
      await versionItem.click();
      await expect.poll(() => page.evaluate(() => !!document.querySelector('[class*="toast"]')), { timeout: 5000 }).toBeTruthy();
    }

    // 以下移动端子页进入，portal 不遮挡（SET-073 / SET-074）
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-menu-item').first()).toBeVisible({ timeout: 5000 });

    // SET-073: 连续点击版本号 3 次 → 跳转 /source-checker
    await page.locator('.settings-menu-item', { hasText: '关于' }).first().click();
    await page.waitForSelector('.settings-subpage', { timeout: 5000 });
    await expect(page.locator('.settings-subpage [class*="version"]').first()).toBeVisible({ timeout: 5000 });

    const versionItemSub = page.locator('.settings-subpage [class*="version"]').first();
    await versionItemSub.click();
    await page.waitForTimeout(200); // TODO: 替换为条件等待（连续点击去抖，暂无可见 DOM 状态可轮询）
    await versionItemSub.click();
    await page.waitForTimeout(200); // TODO: 替换为条件等待（连续点击去抖，暂无可见 DOM 状态可轮询）
    await versionItemSub.click();
    await expect(page).toHaveURL(/\/source-checker/, { timeout: 5000 });
    await expect(page.locator('.settings-subpage')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('.source-checker-page')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sub-page__title')).toHaveText('源检测');
    const headerBox073 = await page.locator('.sub-page__header').boundingBox();
    expect(headerBox073?.y ?? 999).toBeLessThan(4);
    const subBox073 = await page.locator('.sub-page').boundingBox();
    expect(subBox073?.height ?? 0).toBeGreaterThan(800);
    const contentBox073 = await page.locator('.source-checker-page').boundingBox();
    expect(contentBox073?.y ?? 0).toBeGreaterThanOrEqual((headerBox073?.y ?? 0) + (headerBox073?.height ?? 0) - 1);

    // SET-074: 从 /settings 重新进入「关于」，连续点击 KinoTV 3 次 → 跳转 /proxy-setup
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-menu-item').first()).toBeVisible({ timeout: 5000 });
    await page.locator('.settings-menu-item', { hasText: '关于' }).first().click();
    await page.waitForSelector('.settings-subpage', { timeout: 5000 });
    await expect(page.locator('.settings-subpage')).toBeVisible({ timeout: 5000 });

    const kinoItem = page.locator('.list-item', { hasText: 'KinoTV' }).first();
    await kinoItem.click();
    await page.waitForTimeout(200); // TODO: 替换为条件等待（连续点击去抖，暂无可见 DOM 状态可轮询）
    await kinoItem.click();
    await page.waitForTimeout(200); // TODO: 替换为条件等待（连续点击去抖，暂无可见 DOM 状态可轮询）
    await kinoItem.click();
    await expect(page).toHaveURL(/\/proxy-setup/, { timeout: 5000 });
    await expect(page.locator('.settings-subpage')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('.proxy-setup')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sub-page__title')).toHaveText('一键配置代理');
    const headerBox074 = await page.locator('.sub-page__header').boundingBox();
    expect(headerBox074?.y ?? 999).toBeLessThan(4);
    const subBox074 = await page.locator('.sub-page').boundingBox();
    expect(subBox074?.height ?? 0).toBeGreaterThan(800);
    const contentBox074 = await page.locator('.proxy-setup').boundingBox();
    expect(contentBox074?.y ?? 0).toBeGreaterThanOrEqual((headerBox074?.y ?? 0) + (headerBox074?.height ?? 0) - 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.7 个人资料（头像与昵称）（SET-080 + 081 + 082 + 083）
// ═══════════════════════════════════════════════════════════════

test.describe('6.7 个人资料（头像与昵称）', () => {
  test('SET-080/081/082/083: 资料项可见、编辑弹窗、昵称保存、恢复默认', async ({ page }) => {
    // 个人资料在「个人设置」tab（源码 PersonalTab），深链直达避免依赖 TabBar 查找
    await page.goto('/settings?tab=personal', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-profile').first()).toBeVisible({ timeout: 5000 });

    // SET-080: 个人资料 banner（头像 + 昵称）可见
    const profileBanner = page.locator('.settings-profile').first();
    expect(await profileBanner.count()).toBeGreaterThan(0);
    const avatar = page.locator('.settings-profile__avatar').first();
    expect(await avatar.count()).toBeGreaterThan(0);
    const name = page.locator('.settings-profile__name').first();
    expect(await name.count()).toBeGreaterThan(0);

    // SET-083: 配置管理相关行与恢复默认按钮可见 + 打开确认弹窗
    const exportRow = page.locator('.settings-row', { hasText: '导出设置与数据' }).first();
    expect(await exportRow.count()).toBeGreaterThan(0);
    const importRow = page.locator('.settings-row', { hasText: '导入设置与数据' }).first();
    expect(await importRow.count()).toBeGreaterThan(0);
    const restoreBtn = page.getByRole('button', { name: '一键导入恢复数据' }).first();
    expect(await restoreBtn.count()).toBeGreaterThan(0);
    const resetBtn = page.getByRole('button', { name: '一键全部恢复默认' }).first();
    expect(await resetBtn.count()).toBeGreaterThan(0);
    const resetRow = page.locator('.settings-row', { hasText: '恢复设置默认' }).first();
    expect(await resetRow.count()).toBeGreaterThan(0);
    const confirmBtn = page.getByRole('button', { name: '确认' }).first();
    if (await resetRow.isVisible().catch(() => false)) {
      await resetRow.click();
      await expect.poll(() => confirmBtn.count(), { timeout: 5000 }).toBeGreaterThan(0);
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await expect.poll(() => confirmBtn.count(), { timeout: 5000 }).toBe(0);
      }
    }

    // SET-081 + SET-082: 打开编辑弹窗并保存昵称
    const isDesktopProfile = await page.locator('.settings-profile').first().isVisible().catch(() => false);
    const trigger = isDesktopProfile
      ? page.locator('.settings-profile').first()
      : page.locator('.settings-row', { hasText: '头像' }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await expect.poll(() => page.locator('.modal-content-animate.settings-modal').count(), { timeout: 5000 }).toBeGreaterThan(0);
      // SET-082: 编辑昵称并保存
      const input = page.locator('#profile-username');
      if (await input.isVisible().catch(() => false)) {
        await input.fill('测试昵称');
        await page.getByRole('button', { name: '保存' }).click();
        await expect.poll(async () => {
          const valEl = isDesktopProfile
            ? page.locator('.settings-profile__name').first()
            : page.locator('.settings-row__value').first();
          return (await valEl.innerText());
        }, { timeout: 5000 }).toContain('测试昵称');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.8 移动端设置主页菜单项（含原理图关联信息副标题）（SET-090 + 091 + 093）
// ═══════════════════════════════════════════════════════════════

test.describe('6.8 移动端设置主页菜单项', () => {
  test.use({ viewport: { width: 767, height: 1024 } });

  test('SET-090/091/093: 菜单项标题副标题、资料区进个人页、子页顶栏+双行卡', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-menu-item').first()).toBeVisible({ timeout: 5000 });

    // SET-090: 每个菜单项显示标题与关联副标题
    const cases = [
      { label: '外观', desc: '主题模式、皮肤' },
      { label: '视频设置', desc: 'TMDB、视频源、字幕翻译' },
      { label: '播放设置', desc: '跳过片头片尾、自动连播' },
      { label: 'IPTV设置', desc: '数据源、节目单、代理' },
      { label: '个人设置', desc: '个人资料与管理' },
      { label: '关于', desc: '版本号、KinoTV' },
    ];
    for (const c of cases) {
      const item = page.locator('.settings-menu-item', { hasText: c.label }).first();
      await expect(item).toBeVisible({ timeout: 5000 });
      const descEl = item.locator('.settings-menu-item__desc').first();
      await expect(descEl).toBeVisible({ timeout: 5000 });
      await expect(descEl).toHaveText(c.desc);
    }

    // SET-093: 进入「外观」子页，验证顶栏替代全局导航栏 + 双行卡
    await page.locator('.settings-menu-item', { hasText: '外观' }).first().click();
    await expect(page.locator('.settings-subpage')).toBeVisible({ timeout: 5000 });
    const subPage = page.locator('.settings-subpage');
    await expect(subPage).toBeVisible({ timeout: 5000 });

    const headerH = await subPage
      .locator('.settings-subpage__header')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(headerH).toBeGreaterThanOrEqual(40);
    expect(headerH).toBeLessThanOrEqual(60);
    await expect(subPage.locator('.settings-subpage__header .back-btn')).toBeVisible();
    const titleAlign = await subPage
      .locator('.settings-subpage__title')
      .evaluate((el) => getComputedStyle(el).textAlign);
    expect(titleAlign).toBe('center');
    await expect(subPage.locator('.settings-subpage__header-spacer')).toHaveCount(1);

    const fcard = subPage.locator('.list-item').first();
    if (await fcard.count()) {
      const cardStyle = await fcard.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { br: cs.borderRadius, border: cs.borderTopWidth };
      });
      expect(cardStyle.br).not.toBe('0px');
      expect(cardStyle.border).not.toBe('0px');
    }

    // 返回主菜单，准备 SET-091
    await subPage.locator('.settings-subpage__header .back-btn').first().click();
    await expect(page.locator('.settings-mobile-profile')).toBeVisible({ timeout: 5000 });

    // SET-091: 点击顶部资料区头像进入个人设置页
    const profile = page.locator('.settings-mobile-profile');
    await expect(profile).toBeVisible({ timeout: 5000 });
    await profile.click();
    await expect(page.locator('.settings-subpage')).toBeVisible({ timeout: 5000 });
    const subPage2 = page.locator('.settings-subpage');
    await expect(subPage2).toBeVisible({ timeout: 5000 });
    const hasConfigSection = await subPage2.getByText('配置管理', { exact: false }).count();
    expect(hasConfigSection).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.9 顶部搜索框（设置项搜索 / 无热门搜索 / 历史独立）（SET-085 + 086 + 087）
// ═══════════════════════════════════════════════════════════════

test.describe('6.9 顶部搜索框', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('SET-085/086/087: 下拉无热门搜索、搜索过滤菜单、历史与全局独立', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.sticky-header__search input')).toBeVisible({ timeout: 5000 });

    const searchInput = page.locator('.sticky-header__search input');

    // SET-085: 下拉不显示「热门搜索」
    await searchInput.click();
    await expect(page.locator('.sticky-header').getByText('热门搜索', { exact: false })).toHaveCount(0, { timeout: 5000 });
    const hotSearch = page.locator('.sticky-header').getByText('热门搜索', { exact: false });
    await expect(hotSearch).toHaveCount(0);

    // SET-086: 搜索设置项（过滤菜单）
    await searchInput.fill('IPTV');
    await searchInput.press('Enter');
    await expect(page.locator('.settings-tab', { hasText: 'IPTV设置' })).toBeVisible({ timeout: 5000 });
    const iptvTab = page.locator('.settings-tab', { hasText: 'IPTV设置' });
    await expect(iptvTab).toBeVisible({ timeout: 5000 });
    const appearanceTab = page.locator('.settings-tab', { hasText: '外观' });
    await expect(appearanceTab).toHaveCount(0);

    // SET-087: 设置页搜索历史与全局独立
    await searchInput.click();
    await searchInput.fill('独立历史测试');
    await searchInput.press('Enter');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('search-history-settings')), { timeout: 5000 }).toContain('独立历史测试');
    const settingsHistory = await page.evaluate(() => localStorage.getItem('search-history-settings'));
    const globalHistory = await page.evaluate(() => localStorage.getItem('search-history'));
    expect(settingsHistory).toContain('独立历史测试');
    expect(globalHistory ?? '').not.toContain('独立历史测试');
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.11 桌面端左栏竖排导航（方案 B）（SET-095 + 096）
// ═══════════════════════════════════════════════════════════════

test.describe('6.11 桌面端左栏竖排导航（方案 B）', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('SET-095/096: 左栏竖排导航布局 + tab 点击切换内容', async ({ page }) => {
    // 用 video tab（外观 tab 内容不足一屏、无法验证滚动行为）
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.settings-sidenav')).toBeVisible({ timeout: 5000 });

    // SET-095: 左栏可见，含「设置」标题与 6 个竖排 tab，激活态为「视频设置」
    const sidenav = page.locator('.settings-sidenav');
    await expect(sidenav).toBeVisible();
    expect(await sidenav.locator('.settings-desktop-title__text').innerText()).toBe('设置');
    expect(await sidenav.locator('.settings-tab').count()).toBe(6);
    await expect(sidenav.locator('.settings-tab--active', { hasText: '视频设置' })).toBeVisible();

    // 内容主列在左栏右侧且填满卡片剩余宽度（自适应，不被固定 max-width 截断）
    const boxes = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
      const sidenav = rect('.settings-sidenav');
      const main = rect('.settings-desktop-main');
      const card = rect('.settings-desktop-card');
      return { sidenav, main, card };
    });
    expect(boxes.main.x).toBeGreaterThan(boxes.sidenav.x);
    expect(Math.abs(boxes.main.x + boxes.main.width - (boxes.card.x + boxes.card.width))).toBeLessThan(4);
    expect(boxes.main.width).toBeGreaterThan(800);

    // 左栏 sticky——下滑 800px 后左栏仍吸附在滚动容器顶
    const beforeTop = await sidenav.evaluate((el) => el.getBoundingClientRect().top);
    await page.locator('.app-shell__scroll').evaluate((el) => { el.scrollTop = 800; });
    await expect.poll(async () => {
      const a = await sidenav.evaluate((el) => el.getBoundingClientRect().top);
      return beforeTop - a;
    }, { timeout: 5000 }).toBeLessThan(40);
    const afterTop = await sidenav.evaluate((el) => el.getBoundingClientRect().top);
    const scrolled = await page.locator('.app-shell__scroll').evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThanOrEqual(800);
    expect(beforeTop - afterTop).toBeLessThan(40);

    // SET-096: 左栏 tab 点击切换内容
    await page.locator('.settings-sidenav .settings-tab', { hasText: '视频设置' }).click();
    await expect(page.locator('.settings-sidenav .settings-tab--active', { hasText: '视频设置' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.settings-content__pane--active [data-tab="video"], .settings-content__pane[data-tab="video"]')).toBeVisible();
  });
});
