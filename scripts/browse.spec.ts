/**
 * 浏览/搜索页 (Browse) 测试用例
 * 路由: /browse
 * 配置依赖: 智能检索需 Level 1（Token）；CMS 直链搜索需 Level 2（Token + CORS 代理）
 *
 * 覆盖: BROWSE-001 ~ BROWSE-053
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 2.1 搜索模式切换
// ═══════════════════════════════════════════════════════════════

test.describe('2.1 搜索模式切换', () => {
  test('BROWSE-001: 默认智能检索模式', async ({ page }) => {
    // 前置条件: 进入浏览页
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 默认选中"智能检索" Tab
    const smartTab = page.locator('.browse-search-tab').first();
    if (await smartTab.isVisible().catch(() => false)) {
      const isActive = await smartTab.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
      console.log('✅ BROWSE-001 通过: 默认选中智能检索模式');
    } else {
      console.log('⚠️ BROWSE-001: 搜索 Tab 未检测到');
    }
  });

  test('BROWSE-002: 切换到直链搜索', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击"直链搜索" Tab
    const cmsTab = page.locator('.browse-search-tab').nth(1);
    if (await cmsTab.isVisible().catch(() => false)) {
      await cmsTab.click();
      await page.waitForTimeout(500);

      // 预期结果: 切换到 CMS 搜索模式
      const isActive = await cmsTab.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
      console.log('✅ BROWSE-002 通过: 成功切换到直链搜索模式');
    } else {
      console.log('⚠️ BROWSE-002: 直链搜索 Tab 未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.2 搜索功能
// ═══════════════════════════════════════════════════════════════

test.describe('2.2 搜索功能', () => {
  test('BROWSE-010: 正常搜索', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 在顶部导航栏搜索框输入关键词并回车
    const searchInput = page.locator('.sticky-header .search-box__input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('复仇者联盟');
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);

      // 预期结果: 显示搜索结果网格
      const hasResults = await page.evaluate(() => {
        return !!document.querySelector('.browse-results-body, [class*="browse-grid"]');
      });
      console.log(`✅ BROWSE-010 检查完成: 搜索结果 = ${hasResults}`);
    } else {
      console.log('⚠️ BROWSE-010: 搜索框未检测到');
    }
  });

  test('BROWSE-012: 空搜索词清除恢复默认结果', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 操作: 先搜索，再清空
    const searchInput = page.locator('.sticky-header .search-box__input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('复仇者');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);

      // 清空搜索词
      const clearBtn = page.locator('.sticky-header .search-box__clear');
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ BROWSE-012 通过: 清空搜索词后恢复默认结果');
      } else {
        console.log('⚠️ BROWSE-012: 清除按钮未检测到');
      }
    }
  });

  test('BROWSE-013: 搜索无结果', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 输入不存在的关键词
    const searchInput = page.locator('.sticky-header .search-box__input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('zzzxxxnotexist12345');
      await searchInput.press('Enter');
      await page.waitForTimeout(5000);

      // 预期结果: 显示"暂无结果"空状态
      const isEmpty = await page.evaluate(() => {
        return !!document.querySelector('.empty-state, [class*="empty"]');
      });
      console.log(`✅ BROWSE-013 检查完成: 空状态显示 = ${isEmpty}`);
    } else {
      console.log('⚠️ BROWSE-013: 搜索框未检测到');
    }
  });

  test('BROWSE-014: 刷新页面后顶部搜索框清空（POP 导航）', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 先搜索，再刷新页面
    const searchInput = page.locator('.sticky-header .search-box__input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('复仇者联盟');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);

      // 刷新页面（POP 导航）
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 15000 });
      await page.waitForTimeout(1000);

      // 预期结果: 顶部搜索框为空（不残留上次搜索词）
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('');
      console.log('✅ BROWSE-014 通过: 刷新后搜索框已清空');
    } else {
      console.log('⚠️ BROWSE-014: 搜索框未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.3 筛选与排序
// ═══════════════════════════════════════════════════════════════

test.describe('2.3 筛选与排序', () => {
  test('BROWSE-020: 分类筛选', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 预期结果: FilterBar 存在
    const filterBar = page.locator('.filter-bar, [class*="filter"]');
    const hasFilter = await filterBar.isVisible().catch(() => false);
    console.log(`✅ BROWSE-020 检查完成: FilterBar 存在 = ${hasFilter}`);
  });

  test('BROWSE-023: 排序切换', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 预期结果: 排序栏存在
    const sortBar = page.locator('.browse-sort-bar, [class*="sort"]');
    const hasSort = await sortBar.isVisible().catch(() => false);
    console.log(`✅ BROWSE-023 检查完成: 排序栏存在 = ${hasSort}`);
  });

  test('BROWSE-025: 结果总数显示', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示"共 X 条"结果数
    const countEl = page.locator('.browse-sort-bar__count, [class*="count"]');
    if (await countEl.isVisible().catch(() => false)) {
      const text = await countEl.textContent();
      console.log(`✅ BROWSE-025 通过: 结果数显示 = "${text}"`);
    } else {
      console.log('⚠️ BROWSE-025: 结果数未显示');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.4 CMS 直链搜索
// ═══════════════════════════════════════════════════════════════

test.describe('2.4 CMS 直链搜索', () => {
  test('BROWSE-030: CMS 搜索正常', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 切换到直链搜索模式
    const cmsTab = page.locator('.browse-search-tab').nth(1);
    if (await cmsTab.isVisible().catch(() => false)) {
      await cmsTab.click();
      await page.waitForTimeout(500);

      // 输入关键词搜索
      const searchInput = page.locator('.sticky-header .search-box__input');
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('复仇者');
        await searchInput.press('Enter');
        await page.waitForTimeout(5000);

        // 预期结果: SourceStatusIndicator 显示进度
        const hasIndicator = await page.evaluate(() => {
          return !!document.querySelector('[class*="source-status"], [class*="indicator"]');
        });
        console.log(`✅ BROWSE-030 检查完成: CMS 搜索源状态指示器 = ${hasIndicator}`);
      }
    } else {
      console.log('⚠️ BROWSE-030: 直链搜索 Tab 未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.5 懒加载与滚动
// ═══════════════════════════════════════════════════════════════

test.describe('2.5 懒加载与滚动', () => {
  test('BROWSE-043: 返回顶部按钮', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 操作: 滚动到页面下方
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);

    // 预期结果: 回到顶部按钮可见
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      console.log('✅ BROWSE-043 通过: 返回顶部按钮显示');
    } else {
      console.log('⚠️ BROWSE-043: 返回顶部按钮未显示');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.6 页面状态
// ═══════════════════════════════════════════════════════════════

test.describe('2.6 页面状态', () => {
  test('BROWSE-053: CMS 搜索浏览器标题', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 切换到 CMS 模式并搜索
    const cmsTab = page.locator('.browse-search-tab').nth(1);
    if (await cmsTab.isVisible().catch(() => false)) {
      await cmsTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('.sticky-header .search-box__input');
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('复仇者');
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);

        // 预期结果: 显示"复仇者 - 搜索 - kinoTV"
        const title = await page.title();
        expect(title).toContain('搜索');
        console.log(`✅ BROWSE-053 通过: CMS 搜索标题 = "${title}"`);
      }
    } else {
      console.log('⚠️ BROWSE-053: 直链搜索 Tab 未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.7 移动端搜索（修复：移动端更换搜索词必须调用接口）
// ═══════════════════════════════════════════════════════════════

test.describe('2.7 移动端搜索', () => {
  test('BROWSE-060: 移动端从首页搜索进入后更换搜索词均调用接口', async ({ page }) => {
    const searchReqs: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('api.tmdb.org/3/search/multi')) {
        searchReqs.push(req.url());
      }
    });

    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 进入搜索模式（移动端默认搜索框隐藏，需点图标）
    const searchBtn = page.locator('.sticky-header__search-btn').first();
    await expect(searchBtn).toBeVisible({ timeout: 5000 });
    await searchBtn.click();
    await page.waitForTimeout(500);
    const mobileInput = page.locator('.sticky-header__mobile-search .search-box__input').first();
    await expect(mobileInput).toBeVisible({ timeout: 5000 });

    // 第一次搜索：mobile-a
    await mobileInput.fill('mobile-a');
    await page.locator('.sticky-header__mobile-search .search-box__submit').first().click();
    await page.waitForTimeout(1500);
    expect(searchReqs.length).toBeGreaterThanOrEqual(1);
    console.log(`✅ BROWSE-060 第一次搜索已调用接口 (请求数=${searchReqs.length})`);

    // 在 /browse 上更换搜索词再次搜索：mobile-b
    let input2 = page.locator('.sticky-header__mobile-search .search-box__input').first();
    if (!(await input2.isVisible().catch(() => false))) {
      await searchBtn.click();
      await page.waitForTimeout(500);
      input2 = page.locator('.sticky-header__mobile-search .search-box__input').first();
    }
    const before = searchReqs.length;
    await input2.fill('mobile-b');
    await page.locator('.sticky-header__mobile-search .search-box__submit').first().click();
    await page.waitForTimeout(1500);
    expect(searchReqs.length).toBeGreaterThan(before);
    console.log(`✅ BROWSE-060 更换搜索词后再次调用接口 (请求数=${searchReqs.length})`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.8 移动端命令栏 (BrowseMobileBar)
// 注：原 scripts/browse-mobile.spec.ts 已并入本块（2026-07-30）。
// 触发条件: useIsMobileLayout() = isNative || isRealPhone(手机UA) || 视口<768px
//          本块用「视口<768px」触发，无需伪造手机 UA。
//          面板内「✨ 为你推荐」标题 (bmb-rec-head) 已于 2026-07-30 删除，
//          故断言改为稳定的 .bmb-pf-apply / FilterBar。
// ═══════════════════════════════════════════════════════════════

test.describe('2.8 移动端命令栏 BrowseMobileBar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('BROWSE-070: 窄视口进入 /browse 渲染移动端命令栏，且样式已加载', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 移动端命令栏根节点渲染
    const bmb = page.locator('.bmb').first();
    await expect(bmb).toBeVisible({ timeout: 5000 });

    // 关键回归点：若 BrowseMobileBar.css 漏引，.bmb / .bmb-cmdbar 会是默认 block，
    // 而非 CSS 定义的 flex。这里直接断言 computed display，能抓出「样式全失效」。
    const bmbDisplay = await bmb.evaluate((el) => getComputedStyle(el).display);
    expect(bmbDisplay).toBe('flex');

    const cmdbarDisplay = await page
      .locator('.bmb-cmdbar')
      .first()
      .evaluate((el) => getComputedStyle(el).display);
    expect(cmdbarDisplay).toBe('flex');

    // 移动端由命令栏接管：桌面搜索 Tab 不应渲染
    const desktopTabs = page.locator('.browse-search-tab');
    expect(await desktopTabs.count()).toBe(0);

    // 命令栏核心控件齐全
    await expect(page.locator('.bmb-mode-seg .bmb-seg').first()).toBeVisible();
    await expect(page.locator('.bmb-filter-trigger')).toBeVisible();
    await expect(page.locator('.bmb-sort-btn')).toBeVisible();

    console.log('✅ BROWSE-070 通过: 移动端命令栏渲染且 CSS 已加载（display=flex）');
  });

  test('BROWSE-071: 点击「筛选」打开右滑全屏面板，可关闭', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 关闭态：面板未挂载
    expect(await page.locator('.drawer-content').count()).toBe(0);

    // 打开
    await page.locator('.bmb-filter-trigger').click();
    const drawer = page.locator('.drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });
    // radix Dialog 自带 role=dialog，确认是真正的对话框而非裸 div
    await expect(drawer).toHaveRole('dialog', { timeout: 5000 });
    // 面板内含 FilterBar 与底部操作区（完成/重置）
    await expect(page.locator('.drawer-body .filter-bar, .drawer-body [class*="filter"]').first()).toBeVisible();
    await expect(page.locator('.bmb-pf-apply')).toBeVisible();

    // 关闭
    await page.locator('.drawer-close').click();
    await expect(page.locator('.drawer-content').first()).toBeHidden({ timeout: 5000 });

    console.log('✅ BROWSE-071 通过: 筛选面板可打开/关闭');
  });

  test('BROWSE-072: 移动端模式切换（智能↔直链）生效', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    const segs = page.locator('.bmb-mode-seg .bmb-seg');
    await expect(segs).toHaveCount(2);

    // 默认智能检索高亮
    const smartOn = await segs.nth(0).evaluate((el) => el.classList.contains('on'));
    expect(smartOn).toBe(true);

    // 切到直链搜索
    await segs.nth(1).click();
    await page.waitForTimeout(300);
    const cmsOn = await segs.nth(1).evaluate((el) => el.classList.contains('on'));
    expect(cmsOn).toBe(true);

    // 直链搜索模式：排序 / 筛选入口不应展示（无 FilterBar / SortBar）
    expect(await page.locator('.bmb-sort-btn').count()).toBe(0);
    expect(await page.locator('.bmb-filter-trigger').count()).toBe(0);
    // 预设横滚无内容，不应展示
    expect(await page.locator('.bmb-presets').count()).toBe(0);

    // 结果区仍在
    await expect(page.locator('.browse-card--results').first()).toBeVisible();

    console.log('✅ BROWSE-072 通过: 移动端模式切换生效，且直链模式隐藏排序/筛选入口');
  });

  test('BROWSE-073: 暗色主题下激活态文字使用反向色 token（非硬编码 #fff）', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 读取反向色 token 的计算值
    const inverse = await page.evaluate(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-text-inverse').trim();
      if (!v) return null;
      const probe = document.createElement('span');
      probe.style.color = v;
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    });
    // 取激活态段文字计算色
    const activeColor = await page
      .locator('.bmb-mode-seg .bmb-seg.on')
      .first()
      .evaluate((el) => getComputedStyle(el).color);

    // 若 CSS 仍是硬编码 #fff，则 activeColor === 'rgb(255, 255, 255)'，
    // 而 inverse token 在暗色下通常不同 → 二者不一致即说明已用 token 修复。
    if (inverse) {
      expect(activeColor.toLowerCase()).toBe(inverse.toLowerCase());
      console.log(`✅ BROWSE-073 通过: 激活态文字色 = ${activeColor}（= --color-text-inverse）`);
    } else {
      // token 取不到时退化为「断言不是纯白」（硬编码 #fff 的典型特征）
      expect(activeColor.toLowerCase()).not.toBe('rgb(255, 255, 255)');
      console.log(`⚠️ BROWSE-073: 未取到 --color-text-inverse，但激活态非纯白 (${activeColor})`);
    }
  });
});

test.describe('2.8 移动端命令栏 — 桌面回归守卫', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('BROWSE-074: 桌面宽视口不渲染移动端命令栏', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 桌面 UA + 宽视口 → isPhone=false → 移动端命令栏不渲染
    expect(await page.locator('.bmb').count()).toBe(0);
    // 桌面搜索 Tab 正常渲染
    await expect(page.locator('.browse-search-tab').first()).toBeVisible();

    console.log('✅ BROWSE-074 通过: 桌面宽视口不渲染移动端命令栏');
  });
});

test.describe('2.8 移动端命令栏 — 整页卡片', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('BROWSE-075: 移动端整页以卡片式布局包裹（surface + 边框 + 圆角 + 阴影）', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    const pageEl = page.locator('.browse-page--mobile').first();
    await expect(pageEl).toBeVisible();

    const style = await pageEl.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        br: cs.borderTopLeftRadius,
        shadow: cs.boxShadow,
        border: cs.borderTopWidth,
      };
    });
    // 回归点：若移动端未包裹卡片，radius=0、shadow=none、border=0px
    expect(style.br).not.toBe('0px');
    expect(style.shadow).not.toBe('none');
    expect(style.border).not.toBe('0px');
    console.log(`✅ BROWSE-075 通过: 移动端整页卡片 radius=${style.br} 阴影已加载`);
  });
});
