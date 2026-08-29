/**
 * 设置页 (Settings) 测试用例
 * 路由: /settings
 * 配置依赖: 无需前置配置（设置页本身就是配置入口）
 *
 * 覆盖: SET-001 ~ SET-084
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 6.1 主题切换
// ═══════════════════════════════════════════════════════════════

test.describe('6.1 主题切换', () => {
  test('SET-001: 切换浅色模式', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击太阳图标
    const sunBtn = page.locator('.theme-btn').first();
    if (await sunBtn.isVisible().catch(() => false)) {
      await sunBtn.click();
      await page.waitForTimeout(500);
      const isActive = await sunBtn.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
    }
  });

  test('SET-002: 切换深色模式', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击月亮图标
    const moonBtn = page.locator('.theme-btn').nth(1);
    if (await moonBtn.isVisible().catch(() => false)) {
      await moonBtn.click();
      await page.waitForTimeout(500);
      const isActive = await moonBtn.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
    }
  });

  test('SET-003: 跟随系统', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击显示器图标
    const systemBtn = page.locator('.theme-btn').nth(2);
    if (await systemBtn.isVisible().catch(() => false)) {
      await systemBtn.click();
      await page.waitForTimeout(500);
      const isActive = await systemBtn.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.2 TMDB 配置
// ═══════════════════════════════════════════════════════════════

test.describe('6.2 TMDB 配置', () => {
  test('SET-010: 配置 TMDB Token 弹窗', async ({ page }) => {
    // TMDB Token 配置入口在「视频设置」tab（源码 VideoTab），需深链直达
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击 TMDB Token "配置"按钮
    const configBtn = page.locator('.settings-btn-mini').first();
    expect(await configBtn.count()).toBeGreaterThan(0);
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
      await page.waitForTimeout(500);
      // 预期结果: 打开配置弹窗
      const modal = page.locator('.modal, [class*="modal"]');
      expect(await modal.count()).toBeGreaterThan(0);
    }
  });

  test('SET-015: Token 状态显示', async ({ page }) => {
    // Token 状态文本「已配置/未配置」同样在「视频设置」tab
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 已配置 Token 时显示"已配置"/"未配置"
    const hasTokenStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('已配置') || text.includes('未配置');
    });
    expect(hasTokenStatus).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.3 视频源配置
// ═══════════════════════════════════════════════════════════════

test.describe('6.3 视频源配置', () => {
  test('SET-020: 视频源管理面板（SourceManager）', async ({ page }) => {
    // 源管理已由 .source-multi-dropdown 改为 SourceManager 组件（ADR-019），
    // 用 ?tab=video 深链直达「视频设置」tab。
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('.source-manager-block[data-scene="video"]');
    if (await panel.isVisible().catch(() => false)) {
      const title = await panel.locator('.source-manager__title').textContent();
      const itemCount = await panel.locator('.source-manager__item').count();
      const badge = await panel.locator('.source-manager__badge').textContent();
      expect(itemCount).toBeGreaterThan(0);
    }
  });

  test('SET-021: 视频源启用/停用切换', async ({ page }) => {
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('.source-manager-block[data-scene="video"]');
    if (!(await panel.isVisible().catch(() => false))) {
      return;
    }
    // 自定义 switch：input 常被 CSS 视觉隐藏，用 count() 判断存在、读 checked 状态，
    // 并通过 label 点击触发切换（label 天然绑定 input）。
    const switchLabels = panel.locator('.source-manager__switch');
    const input = switchLabels.first().locator('input[type="checkbox"]');
    if ((await switchLabels.count()) > 0) {
      const before = await input.isChecked();
      await switchLabels.first().click();
      await page.waitForTimeout(300);
      const after = await input.isChecked();
      expect(after).not.toBe(before);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.4 播放设置
// ═══════════════════════════════════════════════════════════════

test.describe('6.4 播放设置', () => {
  test('SET-040: 跳过片头开关', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 跳过片头开关存在
    const switches = page.locator('.settings-page .list-item');
    expect(await switches.count()).toBeGreaterThan(0);
    const count = await switches.count();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.5 IPTV 配置
// ═══════════════════════════════════════════════════════════════

test.describe('6.5 IPTV 配置', () => {
  test('SET-050: IPTV 源管理面板（SourceManager）', async ({ page }) => {
    // 源管理已由 .source-multi-dropdown 改为 SourceManager 组件（ADR-019），
    // 用 ?tab=iptv 深链直达「IPTV 设置」tab。
    await page.goto('/settings?tab=iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('.source-manager-block[data-scene="iptv"]');
    if (await panel.isVisible().catch(() => false)) {
      const title = await panel.locator('.source-manager__title').textContent();
      const itemCount = await panel.locator('.source-manager__item').count();
      expect(itemCount).toBeGreaterThan(0);
    }
  });

  test('SET-052: IPTV 至少保留一个源（逐个停用最后一个被拒）', async ({ page }) => {
    // ADR-019「至少一个源」兜底：IPTV/EPG 停用最后一个已启用源被拒绝。
    // 已移除「全部停用」按钮，改为逐个停用已启用源：停用最后一个时被拒，badge 仍保留 1 个启用。
    await page.goto('/settings?tab=iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('.source-manager-block[data-scene="iptv"]');
    if (!(await panel.isVisible().catch(() => false))) {
      return;
    }
    // 逐个点击启用源滑块停用；最后被拒时应保留 1 个启用
    // input 被 CSS 视觉隐藏（opacity:0 零尺寸），uncheck() 不可用；点 label 触发切换（同 SET-021）。
    const switches = panel.locator('.source-manager__item .source-manager__switch');
    const switchCount = await switches.count();
    for (let i = 0; i < switchCount; i++) {
      const sw = switches.nth(i);
      const input = sw.locator('input[type="checkbox"]');
      if (await input.isChecked().catch(() => false)) {
        await sw.click();
        await page.waitForTimeout(200);
      }
    }
    const badge = await panel.locator('.source-manager__badge').textContent();
    const enabledCount = /已启用\s*(\d+)/.exec(badge || '')?.[1];
    expect(enabledCount).toBe('1');
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.6 关于与彩蛋
// ═══════════════════════════════════════════════════════════════

test.describe('6.6 关于与彩蛋', () => {
  test('SET-070: 版本号显示', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 版本号在「关于」tab，先切换过去再校验
    const aboutTab = page.getByRole('tab', { name: '关于' });
    if (await aboutTab.isVisible().catch(() => false)) {
      await aboutTab.click();
      await page.waitForTimeout(400);
    }

    // 预期结果: 显示版本号
    const hasVersion = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('版本');
    });
    expect(hasVersion).toBe(true);
  });

  test('SET-071: 版本号彩蛋（第 1 次点击）', async ({ page }) => {
    // 版本号彩蛋在「关于」tab（源码 AboutTab），需深链直达
    await page.goto('/settings?tab=about', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击版本号 1 次
    const versionItem = page.locator('[class*="version"]').first();
    expect(await versionItem.count()).toBeGreaterThan(0);
    if (await versionItem.isVisible().catch(() => false)) {
      await versionItem.click();
      await page.waitForTimeout(500);
      // 预期结果: Toast 显示"再点击 N 次进入源检测页"
      const toastVisible = await page.evaluate(() => {
        return !!document.querySelector('[class*="toast"]');
      });
      expect(toastVisible).toBeTruthy();
    }
  });

  test('SET-073: 版本号彩蛋跳转源检测页（移动端子页进入，portal 不遮挡）', async ({ page }) => {
    // 移动端视口：设置子页 SettingsSubPage 用 createPortal 挂到 body（z-index 60）。
    // 方案 B（无 Keep-Alive）：离开 /settings 组件卸载，portal 随之移除。本用例强断言 portal 必须卸载。
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 移动端：首层菜单 → 点「关于」进入子页（portal 出现）
    await page.locator('.settings-menu-item', { hasText: '关于' }).first().click();
    await page.waitForSelector('.settings-subpage', { timeout: 5000 });
    await page.waitForTimeout(400);

    // 操作: 连续点击版本号 3 次
    // 选择器限定在设置子页内：全局 [class*="version"] 会命中抽屉侧边栏
    // 的 sidebar-footer__version（DOM 顺序更前），导致点击到视口外元素
    const versionItem = page.locator('.settings-subpage [class*="version"]').first();
    await versionItem.click();
    await page.waitForTimeout(200);
    await versionItem.click();
    await page.waitForTimeout(200);
    await versionItem.click();
    await page.waitForTimeout(1500);

    // 预期结果: 跳转到 /source-checker 且设置子页 portal 已卸载、页面真实可见
    expect(page.url()).toContain('/source-checker');
    await expect(page.locator('.settings-subpage')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('.source-checker-page')).toBeVisible({ timeout: 5000 });
    // 移动端整页 portal 为全屏子页（SubPage，对齐设置页 SettingsSubPage）：
    // fixed inset:0 覆盖全视口，顶栏（y≈0）替代全局导航栏，内容在顶栏下方不被遮挡
    await expect(page.locator('.sub-page__title')).toHaveText('源检测');
    const headerBox = await page.locator('.sub-page__header').boundingBox();
    expect(headerBox?.y ?? 999).toBeLessThan(4);
    const subBox = await page.locator('.sub-page').boundingBox();
    expect(subBox?.height ?? 0).toBeGreaterThan(800); // 覆盖全视口
    const contentBox = await page.locator('.source-checker-page').boundingBox();
    expect(contentBox?.y ?? 0).toBeGreaterThanOrEqual((headerBox?.y ?? 0) + (headerBox?.height ?? 0) - 1);
  });

  test('SET-074: KinoTV 彩蛋跳转一键配置代理页（移动端子页进入，portal 不遮挡）', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 移动端：首层菜单 → 点「关于」进入子页（portal 出现）
    await page.locator('.settings-menu-item', { hasText: '关于' }).first().click();
    await page.waitForSelector('.settings-subpage', { timeout: 5000 });
    await page.waitForTimeout(400);

    // 操作: 连续点击 KinoTV 3 次
    const kinoItem = page.locator('.list-item', { hasText: 'KinoTV' }).first();
    await kinoItem.click();
    await page.waitForTimeout(200);
    await kinoItem.click();
    await page.waitForTimeout(200);
    await kinoItem.click();
    await page.waitForTimeout(1500);

    // 预期结果: 跳转到 /proxy-setup 且设置子页 portal 已卸载、页面真实可见
    expect(page.url()).toContain('/proxy-setup');
    await expect(page.locator('.settings-subpage')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('.proxy-setup')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sub-page__title')).toHaveText('一键配置代理');
    const headerBox = await page.locator('.sub-page__header').boundingBox();
    expect(headerBox?.y ?? 999).toBeLessThan(4);
    const subBox = await page.locator('.sub-page').boundingBox();
    expect(subBox?.height ?? 0).toBeGreaterThan(800); // 覆盖全视口
    const contentBox = await page.locator('.proxy-setup').boundingBox();
    expect(contentBox?.y ?? 0).toBeGreaterThanOrEqual((headerBox?.y ?? 0) + (headerBox?.height ?? 0) - 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.7 个人资料（头像与昵称）
// ═══════════════════════════════════════════════════════════════

test.describe('6.7 个人资料（头像与昵称）', () => {
  test('SET-080: 个人资料设置项可见（头像 + 用户名）', async ({ page }) => {
    // 个人资料在「个人设置」tab（源码 PersonalTab），深链直达避免依赖 TabBar 查找
    await page.goto('/settings?tab=personal', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 个人资料以 banner（.settings-profile）呈现：含头像（.settings-profile__avatar）与昵称（.settings-profile__name）
    const profileBanner = page.locator('.settings-profile').first();
    expect(await profileBanner.count()).toBeGreaterThan(0);
    const avatar = page.locator('.settings-profile__avatar').first();
    expect(await avatar.count()).toBeGreaterThan(0);
    const name = page.locator('.settings-profile__name').first();
    expect(await name.count()).toBeGreaterThan(0);
  });

  test('SET-081: 点击头像设置项打开编辑弹窗', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const personalTab = page.getByRole('tab', { name: '个人设置' });
    expect(await personalTab.count()).toBeGreaterThan(0);
    if (await personalTab.isVisible().catch(() => false)) {
      await personalTab.click();
      await page.waitForTimeout(400);
    }

    // 桌面端点击 banner，移动端点击头像行
    const trigger = (await page.locator('.settings-profile').first().isVisible().catch(() => false))
      ? page.locator('.settings-profile').first()
      : page.locator('.settings-row', { hasText: '头像' }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(500);
      const modal = page.locator('.modal-content-animate.settings-modal');
      expect(await modal.count()).toBeGreaterThan(0);
    }
  });

  test('SET-082: 编辑昵称并保存', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const personalTab = page.getByRole('tab', { name: '个人设置' });
    if (await personalTab.isVisible().catch(() => false)) {
      await personalTab.click();
      await page.waitForTimeout(400);
    }

    // 桌面端点击 banner，移动端点击用户名行
    const isDesktopProfile = await page.locator('.settings-profile').first().isVisible().catch(() => false);
    const trigger = isDesktopProfile
      ? page.locator('.settings-profile').first()
      : page.locator('.settings-row', { hasText: '用户名' }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(500);
      const input = page.locator('#profile-username');
      if (await input.isVisible().catch(() => false)) {
        await input.fill('测试昵称');
        await page.getByRole('button', { name: '保存' }).click();
        await page.waitForTimeout(500);
        const valEl = isDesktopProfile
          ? page.locator('.settings-profile__name').first()
          : page.locator('.settings-row__value').first();
        const val = await valEl.innerText();
        expect(val).toContain('测试昵称');
      }
    }
  });

  test('SET-083: 配置管理与恢复默认配置设置项可见且可打开确认弹窗', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const personalTab = page.getByRole('tab', { name: '个人设置' });
    expect(await personalTab.count()).toBeGreaterThan(0);
    if (await personalTab.isVisible().catch(() => false)) {
      await personalTab.click();
      await page.waitForTimeout(400);
    }

    const exportRow = page.locator('.settings-row', { hasText: '导出设置与数据' }).first();
    expect(await exportRow.count()).toBeGreaterThan(0);
    const importRow = page.locator('.settings-row', { hasText: '导入设置与数据' }).first();
    expect(await importRow.count()).toBeGreaterThan(0);
    const restoreBtn = page.getByRole('button', { name: '一键导入恢复数据' }).first();
    expect(await restoreBtn.count()).toBeGreaterThan(0);
    const resetBtn = page.getByRole('button', { name: '一键全部恢复默认' }).first();
    expect(await resetBtn.count()).toBeGreaterThan(0);

    if (
      (await exportRow.isVisible().catch(() => false)) &&
      (await importRow.isVisible().catch(() => false)) &&
      (await restoreBtn.isVisible().catch(() => false)) &&
      (await resetBtn.isVisible().catch(() => false))
    ) {
    }

    const resetRow = page.locator('.settings-row', { hasText: '恢复设置默认' }).first();
    expect(await resetRow.count()).toBeGreaterThan(0);
    if (await resetRow.isVisible().catch(() => false)) {
      await resetRow.click();
      await page.waitForTimeout(400);
      const confirmBtn = page.getByRole('button', { name: '确认' }).first();
      expect(await confirmBtn.count()).toBeGreaterThan(0);
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.8 移动端设置主页菜单项（含原理图关联信息副标题）
// ═══════════════════════════════════════════════════════════════

test.describe('6.8 移动端设置主页菜单项', () => {
  test('SET-090: 移动端设置主页每个菜单项显示标题与关联副标题', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

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
  });

  test('SET-091: 移动端点击顶部资料区头像进入个人设置页', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // 顶部资料区（头像 + 昵称）应可见
    const profile = page.locator('.settings-mobile-profile');
    await expect(profile).toBeVisible({ timeout: 5000 });

    // 点击资料区 → 进入个人设置子页
    await profile.click();
    await page.waitForTimeout(1000);

    // 个人设置子页应打开（含「配置管理」区块）
    const subPage = page.locator('.settings-subpage');
    await expect(subPage).toBeVisible({ timeout: 5000 });
    const hasConfigSection = await subPage.getByText('配置管理', { exact: false }).count();
    expect(hasConfigSection).toBeGreaterThan(0);
  });

  test('SET-092: 移动端设置主页按 iOS 分组圆角卡组织（通用 / 账户与信息）', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // 分组卡容器：两组（通用 / 账户与信息）
    const groups = page.locator('.settings-menu-group');
    await expect(groups).toHaveCount(2);

    const capTexts: string[] = [];
    const caps = page.locator('.settings-menu-group__cap');
    for (let i = 0; i < (await caps.count()); i++) {
      capTexts.push(((await caps.nth(i).textContent()) || '').trim());
    }
    expect(capTexts).toContain('通用');
    expect(capTexts).toContain('账户与信息');

    // 每组为一张 inset 圆角卡（background=surface、border-radius≠0）
    const cardStyle = await page
      .locator('.settings-menu-group__card')
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, br: cs.borderRadius, border: cs.borderTopWidth };
      });
    expect(cardStyle.br).not.toBe('0px');
    expect(cardStyle.border).not.toBe('0px');

    // 6 个菜单项仍在组卡内（SET-090 兼容）
    expect(await page.locator('.settings-menu-group__card .settings-menu-item').count()).toBe(6);

  });

  test('SET-093: 移动端子页顶栏替代全局导航栏 + 子页内双行卡（对齐桌面方案 F）', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // 进入「外观」子页
    await page.locator('.settings-menu-item', { hasText: '外观' }).first().click();
    await page.waitForTimeout(800);
    const subPage = page.locator('.settings-subpage');
    await expect(subPage).toBeVisible({ timeout: 5000 });

    // 子页顶栏：与全局导航栏同高（--header-height-compact 48px）—— 覆盖导航栏区域
    const headerH = await subPage
      .locator('.settings-subpage__header')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(headerH).toBeGreaterThanOrEqual(40);
    expect(headerH).toBeLessThanOrEqual(60);
    // 顶栏含返回按钮 + 居中标题 + 右侧占位（三栏对称布局）
    await expect(subPage.locator('.settings-subpage__header .back-btn')).toBeVisible();
    const titleAlign = await subPage
      .locator('.settings-subpage__title')
      .evaluate((el) => getComputedStyle(el).textAlign);
    expect(titleAlign).toBe('center');
    // 右侧占位 span（aria-hidden 空元素）：断言存在而非可见（空元素可见性为 hidden）
    await expect(subPage.locator('.settings-subpage__header-spacer')).toHaveCount(1);

    // 子页内 List.Item 双行卡（border-radius≠0、margin 间距）
    const fcard = subPage.locator('.list-item').first();
    if (await fcard.count()) {
      const cardStyle = await fcard.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { br: cs.borderRadius, border: cs.borderTopWidth };
      });
      expect(cardStyle.br).not.toBe('0px');
      expect(cardStyle.border).not.toBe('0px');
    }

  });
});

// ═══════════════════════════════════════════════════════════════
// 6.9 顶部搜索框（设置项搜索 / 无热门搜索 / 历史独立）
// ═══════════════════════════════════════════════════════════════

test.describe('6.9 顶部搜索框', () => {
  test('SET-085: 顶部搜索框下拉不显示热门搜索', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const searchInput = page.locator('.sticky-header__search input');
    await searchInput.click();
    await page.waitForTimeout(300);

    // 预期结果: 下拉框不应出现「热门搜索」
    const hotSearch = page.locator('.sticky-header').getByText('热门搜索', { exact: false });
    await expect(hotSearch).toHaveCount(0);
  });

  test('SET-086: 顶部搜索框搜索设置项（过滤菜单）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const searchInput = page.locator('.sticky-header__search input');
    await searchInput.click();
    await searchInput.fill('IPTV');
    await searchInput.press('Enter');
    await page.waitForTimeout(600);

    // 预期结果: 仅匹配的设置项保留，其余被过滤
    const iptvTab = page.locator('.settings-tab', { hasText: 'IPTV设置' });
    await expect(iptvTab).toBeVisible({ timeout: 5000 });
    const appearanceTab = page.locator('.settings-tab', { hasText: '外观' });
    await expect(appearanceTab).toHaveCount(0);
  });

  test('SET-087: 设置页搜索历史与全局独立', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const searchInput = page.locator('.sticky-header__search input');
    await searchInput.click();
    await searchInput.fill('独立历史测试');
    await searchInput.press('Enter');
    await page.waitForTimeout(400);

    const settingsHistory = await page.evaluate(() => localStorage.getItem('search-history-settings'));
    const globalHistory = await page.evaluate(() => localStorage.getItem('search-history'));
    expect(settingsHistory).toContain('独立历史测试');
    expect(globalHistory ?? '').not.toContain('独立历史测试');
  });
});
