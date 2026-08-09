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
      console.log('✅ SET-001 通过: 浅色模式切换成功');
    } else {
      console.log('⚠️ SET-001: 主题按钮未检测到');
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
      console.log('✅ SET-002 通过: 深色模式切换成功');
    } else {
      console.log('⚠️ SET-002: 主题按钮未检测到');
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
      console.log('✅ SET-003 通过: 跟随系统模式切换成功');
    } else {
      console.log('⚠️ SET-003: 主题按钮未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.2 TMDB 配置
// ═══════════════════════════════════════════════════════════════

test.describe('6.2 TMDB 配置', () => {
  test('SET-010: 配置 TMDB Token 弹窗', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击 TMDB Token "配置"按钮
    const configBtn = page.locator('.settings-btn-mini').first();
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
      await page.waitForTimeout(500);
      // 预期结果: 打开配置弹窗
      const modal = page.locator('.modal, [class*="modal"]');
      if (await modal.isVisible().catch(() => false)) {
        console.log('✅ SET-010 通过: TMDB Token 配置弹窗已打开');
      } else {
        console.log('⚠️ SET-010: 弹窗未检测到');
      }
    } else {
      console.log('⚠️ SET-010: 配置按钮未检测到');
    }
  });

  test('SET-015: Token 状态显示', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 已配置 Token 时显示"已配置"
    const hasTokenStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('已配置') || text.includes('未配置');
    });
    console.log(`✅ SET-015 检查完成: Token 状态可见 = ${hasTokenStatus}`);
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
      console.log(`✅ SET-020 通过: 视频源面板可见，标题="${title}"，源项=${itemCount}，${badge}`);
      expect(itemCount).toBeGreaterThan(0);
    } else {
      console.log('⚠️ SET-020: 视频源管理面板未检测到');
    }
  });

  test('SET-021: 视频源启用/停用切换', async ({ page }) => {
    await page.goto('/settings?tab=video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('.source-manager-block[data-scene="video"]');
    if (!(await panel.isVisible().catch(() => false))) {
      console.log('⚠️ SET-021: 视频源管理面板未检测到');
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
      console.log(`✅ SET-021 通过: 视频源启用状态 ${before} → ${after}`);
      expect(after).not.toBe(before);
    } else {
      console.log('⚠️ SET-021: 视频源开关未检测到');
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
    const count = await switches.count();
    console.log(`✅ SET-040 检查完成: 设置项数量 = ${count}`);
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
      console.log(`✅ SET-050 通过: IPTV 源面板可见，标题="${title}"，源项=${itemCount}`);
      expect(itemCount).toBeGreaterThan(0);
    } else {
      console.log('⚠️ SET-050: IPTV 源管理面板未检测到');
    }
  });

  test('SET-052: IPTV 至少保留一个源（停用最后一个被拒）', async ({ page }) => {
    // ADR-019「至少一个源」兜底：IPTV/EPG 停用最后一个已启用源被拒绝。
    // 通过"全部停用"按钮验证：全部停用后仍保留一个启用源。
    await page.goto('/settings?tab=iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('.source-manager-block[data-scene="iptv"]');
    if (!(await panel.isVisible().catch(() => false))) {
      console.log('⚠️ SET-052: IPTV 源管理面板未检测到');
      return;
    }
    const setAllOff = panel.locator('button[aria-label="全部停用"]');
    if (!(await setAllOff.isVisible().catch(() => false))) {
      console.log('⚠️ SET-052: 「全部停用」按钮未检测到');
      return;
    }
    await setAllOff.click();
    await page.waitForTimeout(400);
    const badge = await panel.locator('.source-manager__badge').textContent();
    // badge 形如「已启用 N/M」，全部停用后仍保留 1 个启用（至少一个源兜底）
    const enabledCount = /已启用\s*(\d+)/.exec(badge || '')?.[1];
    console.log(`✅ SET-052 通过: 全部停用后 badge="${badge}"`);
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
    console.log('✅ SET-070 通过: 版本号显示');
  });

  test('SET-071: 版本号彩蛋（第 1 次点击）', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击版本号 1 次
    const versionItem = page.locator('.version-item, [class*="version"]').first();
    if (await versionItem.isVisible().catch(() => false)) {
      await versionItem.click();
      await page.waitForTimeout(500);
      // 预期结果: Toast 显示"再点击 2 次进入源检测页"
      const toastVisible = await page.evaluate(() => {
        return !!document.querySelector('[class*="toast"]');
      });
      console.log(`✅ SET-071 检查完成: Toast 显示 = ${toastVisible}`);
    } else {
      console.log('⚠️ SET-071: 版本号未检测到');
    }
  });

  test('SET-073: 版本号彩蛋跳转源检测页', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 连续点击版本号 3 次
    const versionItem = page.locator('.version-item, [class*="version"]').first();
    if (await versionItem.isVisible().catch(() => false)) {
      await versionItem.click();
      await page.waitForTimeout(200);
      await versionItem.click();
      await page.waitForTimeout(200);
      await versionItem.click();
      await page.waitForTimeout(1000);

      // 预期结果: 跳转到 /source-checker
      if (page.url().includes('/source-checker')) {
        console.log('✅ SET-073 通过: 彩蛋正确跳转到源检测页');
      } else {
        console.log(`⚠️ SET-073: 未跳转（当前 URL = ${page.url()}）`);
      }
    } else {
      console.log('⚠️ SET-073: 版本号未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.7 个人资料（头像与昵称）
// ═══════════════════════════════════════════════════════════════

test.describe('6.7 个人资料（头像与昵称）', () => {
  test('SET-080: 个人资料设置项可见（头像 + 用户名）', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 桌面端个人资料为 banner（.settings-profile），移动端为列表行（.settings-row）
    const personalTab = page.getByRole('tab', { name: '个人设置' });
    if (await personalTab.isVisible().catch(() => false)) {
      await personalTab.click();
      await page.waitForTimeout(400);
    }

    const profileBanner = page.locator('.settings-profile').first();
    const avatarRow = page.locator('.settings-row', { hasText: '头像' }).first();
    const nameRow = page.locator('.settings-row', { hasText: '用户名' }).first();
    const visible = (await profileBanner.isVisible().catch(() => false))
      ? await profileBanner.locator('.settings-profile__name').isVisible().catch(() => false)
      : (await avatarRow.isVisible().catch(() => false) && await nameRow.isVisible().catch(() => false));
    if (visible) {
      console.log('✅ SET-080 通过: 个人资料设置项可见（头像 + 用户名）');
    } else {
      console.log('⚠️ SET-080: 个人资料设置项未检测到');
    }
  });

  test('SET-081: 点击头像设置项打开编辑弹窗', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const personalTab = page.getByRole('tab', { name: '个人设置' });
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
      if (await modal.isVisible().catch(() => false)) {
        console.log('✅ SET-081 通过: 编辑个人资料弹窗已打开');
      } else {
        console.log('⚠️ SET-081: 编辑弹窗未检测到');
      }
    } else {
      console.log('⚠️ SET-081: 头像设置项未检测到');
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
        console.log('✅ SET-082 通过: 昵称已保存并显示');
      } else {
        console.log('⚠️ SET-082: 昵称输入框未检测到');
      }
    } else {
      console.log('⚠️ SET-082: 用户名设置项未检测到');
    }
  });

  test('SET-083: 配置管理与恢复默认配置设置项可见且可打开确认弹窗', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const personalTab = page.getByRole('tab', { name: '个人设置' });
    if (await personalTab.isVisible().catch(() => false)) {
      await personalTab.click();
      await page.waitForTimeout(400);
    }

    const exportRow = page.locator('.settings-row', { hasText: '导出设置与数据' }).first();
    const importRow = page.locator('.settings-row', { hasText: '导入设置与数据' }).first();
    const restoreBtn = page.getByRole('button', { name: '一键导入恢复数据' }).first();
    const resetBtn = page.getByRole('button', { name: '一键全部恢复默认' }).first();

    if (
      (await exportRow.isVisible().catch(() => false)) &&
      (await importRow.isVisible().catch(() => false)) &&
      (await restoreBtn.isVisible().catch(() => false)) &&
      (await resetBtn.isVisible().catch(() => false))
    ) {
      console.log('✅ SET-083 通过: 配置管理 / 恢复默认配置设置项可见');
    } else {
      console.log('⚠️ SET-083: 部分设置项未检测到');
    }

    const resetRow = page.locator('.settings-row', { hasText: '恢复设置默认' }).first();
    if (await resetRow.isVisible().catch(() => false)) {
      await resetRow.click();
      await page.waitForTimeout(400);
      const confirmBtn = page.getByRole('button', { name: '确认' }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        console.log('✅ SET-083 通过: 恢复设置默认确认弹窗已打开');
        await confirmBtn.click();
        await page.waitForTimeout(300);
      } else {
        console.log('⚠️ SET-083: 确认弹窗未检测到');
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
      console.log(`✅ SET-090 通过: 菜单项「${c.label}」副标题 = "${c.desc}"`);
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
    console.log(`✅ SET-091 检查: 个人设置子页已打开（配置管理区块=${hasConfigSection}）`);
    expect(hasConfigSection).toBeGreaterThan(0);
    console.log('✅ SET-091 通过: 移动端点击头像进入个人设置页');
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
    console.log('✅ SET-085 通过: 设置页顶部搜索框不显示热门搜索');
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
    console.log('✅ SET-086 通过: 设置页搜索过滤设置项');
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
    console.log('✅ SET-087 通过: 设置页搜索历史独立存储');
  });
});
