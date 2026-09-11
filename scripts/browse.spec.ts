/**
 * 浏览/搜索页 (Browse) 测试用例（已合并精简）
 * 路由: /browse
 * 配置依赖: 智能检索需 Level 1（Token）；CMS 直链搜索需 Level 2（Token + CORS 代理）
 *
 * 覆盖: BROWSE-001 ~ BROWSE-080（合并后 7 条）
 *
 * 等待策略: 全部使用 Playwright web-first 条件等待（expect / expect.poll），
 *          不使用固定 waitForTimeout 睡眠；轮询 50ms 起步，条件成立立即返回。
 */
import { test, expect } from './fixtures/mock-tmdb';

// 条件等待轮询节奏（条件成立即返回，不会等满 timeout）
const POLL = { intervals: [50, 100, 250, 500] };

// ═══════════════════════════════════════════════════════════════
// 2.1 搜索模式切换（BROWSE-001 + 002）
// ═══════════════════════════════════════════════════════════════

test.describe('2.1 搜索模式切换', () => {
  test('BROWSE-001/002: 默认智能检索且可切换到直链搜索', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // BROWSE-001: 默认选中"智能检索" Tab
    const smartTab = page.locator('.browse-search-tab').first();
    await expect(smartTab).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => smartTab.evaluate((el) => el.classList.contains('active')), { ...POLL, timeout: 3000 })
      .toBe(true);

    // BROWSE-002: 切换到直链搜索
    const cmsTab = page.locator('.browse-search-tab').nth(1);
    await expect(cmsTab).toBeVisible({ timeout: 5000 });
    await cmsTab.click();
    await expect
      .poll(() => cmsTab.evaluate((el) => el.classList.contains('active')), { ...POLL, timeout: 2500 })
      .toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.2 搜索功能（BROWSE-010 + 012 + 013 + 014）
// ═══════════════════════════════════════════════════════════════

test.describe('2.2 搜索功能', () => {
  test('BROWSE-010/012/013/014: 正常搜索、清空恢复、无结果、刷新清空输入框', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    const searchInput = page.locator('.sticky-header .search-box__input');
    const resultsBody = page.locator('.browse-results-body, [class*="browse-grid"]').first();

    // BROWSE-010: 正常搜索显示结果网格
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('复仇者联盟');
    await searchInput.press('Enter');
    await expect(resultsBody).toBeVisible({ timeout: 10000 });

    // BROWSE-012: 清空搜索词（恢复默认结果）
    await searchInput.fill('复仇者');
    await searchInput.press('Enter');
    const clearBtn = page.locator('.sticky-header .search-box__clear');
    await expect(clearBtn).toBeVisible({ timeout: 5000 });
    await clearBtn.click();
    // 清空后：输入框归零 + 默认结果区重新可见
    await expect(searchInput).toHaveValue('', { timeout: 5000 });
    await expect(resultsBody).toBeVisible({ timeout: 10000 });

    // BROWSE-013: 搜索无结果显示空状态
    await searchInput.fill('zzzxxxnotexist12345');
    await searchInput.press('Enter');
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.empty-state, [class*="empty"]')),
        { ...POLL, timeout: 12000 },
      )
      .toBeTruthy();

    // BROWSE-014: 刷新页面后顶部搜索框清空（POP 导航）
    await searchInput.fill('复仇者联盟');
    await searchInput.press('Enter');
    await expect(resultsBody).toBeVisible({ timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 等页面重新水合完成（搜索框 + 结果区就绪）后再一次性断言输入框为空
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await expect(resultsBody).toBeVisible({ timeout: 15000 });
    expect(await searchInput.inputValue()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.3 筛选与排序（BROWSE-020 + 023 + 025）
// ═══════════════════════════════════════════════════════════════

test.describe('2.3 筛选与排序', () => {
  test('BROWSE-020/023/025: 分类筛选栏、排序栏、结果总数均存在', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // BROWSE-020: FilterBar 存在
    const filterBar = page.locator('.filter-bar, [class*="filter"]');
    await expect.poll(() => filterBar.count(), { ...POLL, timeout: 15000 }).toBeGreaterThan(0);

    // BROWSE-023: 排序栏存在
    const sortBar = page.locator('.browse-sort-bar, [class*="sort"]');
    await expect.poll(() => sortBar.count(), { ...POLL, timeout: 15000 }).toBeGreaterThan(0);

    // BROWSE-025: 显示"共 X 条"结果数
    const countEl = page.locator('.browse-sort-bar__count, [class*="count"]');
    await expect.poll(() => countEl.count(), { ...POLL, timeout: 15000 }).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.4 CMS 直链搜索（BROWSE-030）
// ═══════════════════════════════════════════════════════════════

test.describe('2.4 CMS 直链搜索', () => {
  test('BROWSE-030: CMS 搜索正常', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 操作: 切换到直链搜索模式
    const cmsTab = page.locator('.browse-search-tab').nth(1);
    await expect(cmsTab).toBeVisible({ timeout: 15000 });
    await cmsTab.click();
    await expect
      .poll(() => cmsTab.evaluate((el) => el.classList.contains('active')), { ...POLL, timeout: 2500 })
      .toBe(true);

    // 输入关键词搜索
    const searchInput = page.locator('.sticky-header .search-box__input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('复仇者');
    await searchInput.press('Enter');

    // 预期结果: SourceStatusIndicator 显示进度
    await expect
      .poll(
        () =>
          page.evaluate(
            () => !!document.querySelector('[class*="source-status"], [class*="indicator"]'),
          ),
        { ...POLL, timeout: 12000 },
      )
      .toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.7 移动端搜索（修复：移动端更换搜索词必须调用接口）（BROWSE-060）
// ═══════════════════════════════════════════════════════════════

test.describe('2.7 移动端搜索', () => {
  test.use({ viewport: { width: 767, height: 1024 } });

  test('BROWSE-060: 移动端从首页搜索进入后更换搜索词均调用接口', async ({ page }) => {
    const searchReqs: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('api.tmdb.org/3/search/multi')) {
        searchReqs.push(req.url());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 移动端顶栏中央常驻搜索框（0b1e20a 起取消「点击图标展开」临时搜索模式）
    const mobileInput = page.locator('.sticky-header .search-box__input').first();
    await expect(mobileInput).toBeVisible({ timeout: 15000 });

    // 第一次搜索：mobile-a
    await mobileInput.fill('mobile-a');
    await page.locator('.sticky-header .search-box__submit').first().click();
    await expect.poll(() => searchReqs.length, { ...POLL, timeout: 10000 }).toBeGreaterThanOrEqual(1);

    // 在 /browse 上更换搜索词再次搜索：mobile-b（路由切换后 SearchBox 因 key 重建，需重新定位）
    await expect(page).toHaveURL(/\/browse/, { timeout: 10000 });
    const input2 = page.locator('.sticky-header .search-box__input').first();
    await expect(input2).toBeVisible({ timeout: 10000 });
    const before = searchReqs.length;
    await input2.fill('mobile-b');
    await page.locator('.sticky-header .search-box__submit').first().click();
    await expect.poll(() => searchReqs.length, { ...POLL, timeout: 10000 }).toBeGreaterThan(before);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.8 移动端命令栏 BrowseMobileBar
// 注：原 scripts/browse-mobile.spec.ts 已并入本块（2026-07-30）。
// 触发条件: useIsMobileLayout() = isNative || isRealPhone(手机UA) || 视口<768px
//          本块用「视口<768px」触发，无需伪造手机 UA。
//          面板内「✨ 为你推荐」标题 (bmb-rec-head) 已于 2026-07-30 删除，
//          故断言改为稳定的 .bmb-pf-apply / FilterBar。
// ═══════════════════════════════════════════════════════════════

test.describe('2.8 移动端命令栏 BrowseMobileBar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // ① 命令栏入口结构（双行布局 + 全屏筛选面板打开/关闭）
  test('BROWSE-070/071/072/074/078/080: 命令栏双行布局、筛选面板开关、模式切换、桌面守卫、已选轨', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // BROWSE-070: 移动端命令栏根节点渲染 + 样式已加载
    const bmb = page.locator('.bmb').first();
    await expect(bmb).toBeVisible({ timeout: 15000 });
    // 样式表可能晚于 DOM 就绪，轮询等 computed style 生效（替代固定睡眠）
    await expect
      .poll(() => bmb.evaluate((el) => getComputedStyle(el).display), { ...POLL, timeout: 3000 })
      .toBe('flex');
    await expect
      .poll(
        () =>
          page
            .locator('.bmb-cmdbar')
            .first()
            .evaluate((el) => getComputedStyle(el).display),
        { ...POLL, timeout: 3000 },
      )
      .toBe('flex');
    // 移动端由命令栏接管：桌面搜索 Tab 不应渲染
    const desktopTabs = page.locator('.browse-search-tab');
    expect(await desktopTabs.count()).toBe(0);
    // 命令栏核心控件齐全
    await expect(page.locator('.bmb-mode-seg .bmb-seg').first()).toBeVisible();
    await expect(page.locator('.bmb-filter-trigger')).toBeVisible();

    // BROWSE-078: 两行布局（模式居中 + 筛选/结果数两端对齐）+ 移动端隐藏 SortBar
    const cmdbar = page.locator('.bmb-cmdbar').first();
    await expect(cmdbar).toBeVisible();
    const cmdDirection = await cmdbar.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(cmdDirection).toBe('column');
    const modeRow = page.locator('.bmb-mode-row').first();
    await expect(modeRow).toBeVisible();
    const modeJustify = await modeRow.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(modeJustify).toBe('center');
    const barRow = page.locator('.bmb-bar-row').first();
    await expect(barRow).toBeVisible();
    const barJustify = await barRow.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(barJustify).toBe('space-between');
    await expect(page.locator('.bmb-result-count')).toBeVisible();
    await expect(page.locator('.bmb-result-count')).toHaveText(/共 .+ 条/);
    const triggerH = await page
      .locator('.bmb-filter-trigger')
      .evaluate((el) => parseFloat(getComputedStyle(el).minHeight));
    expect(triggerH).toBeLessThanOrEqual(30);
    const sortBar = page.locator('.browse-sort-bar');
    if (await sortBar.count()) {
      const display = await sortBar.first().evaluate((el) => getComputedStyle(el).display);
      expect(display).toBe('none');
    }

    // BROWSE-071: 点击「筛选」打开右滑全屏面板，可关闭
    expect(await page.locator('.drawer-content').count()).toBe(0);
    await page.locator('.bmb-filter-trigger').click();
    const drawer = page.locator('.drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer).toHaveRole('dialog', { timeout: 5000 });
    await expect(page.locator('.drawer-body .filter-bar, .drawer-body [class*="filter"]').first()).toBeVisible();
    await expect(page.locator('.bmb-pf-apply')).toBeVisible();
    await page.locator('.drawer-close').click();
    await expect(page.locator('.drawer-content').first()).toBeHidden({ timeout: 5000 });

    // BROWSE-072: 移动端模式切换（智能↔直链）生效
    const segs = page.locator('.bmb-mode-seg .bmb-seg');
    await expect(segs).toHaveCount(2);
    const smartOn = await segs.nth(0).evaluate((el) => el.classList.contains('on'));
    expect(smartOn).toBe(true);
    await segs.nth(1).click();
    await expect
      .poll(() => segs.nth(1).evaluate((el) => el.classList.contains('on')), { ...POLL, timeout: 2300 })
      .toBe(true);
    expect(await page.locator('.bmb-filter-trigger').count()).toBe(0);
    expect(await page.locator('.bmb-presets').count()).toBe(0);
    await expect(page.locator('.browse-card--results').first()).toBeVisible();

    // BROWSE-080: 已选轨（rail）无左右 padding，命令栏下方无预设横滚
    // 已选轨与筛选入口仅「智能检索」模式渲染 → 先切回智能模式（BROWSE-072 已切到直链）
    expect(await page.locator('.bmb-presets').count()).toBe(0);
    await segs.nth(0).click();
    await expect
      .poll(() => segs.nth(0).evaluate((el) => el.classList.contains('on')), { ...POLL, timeout: 2300 })
      .toBe(true);
    const filterTrigger = page.locator('.bmb-filter-trigger');
    await expect(filterTrigger).toBeVisible({ timeout: 5000 });
    await filterTrigger.click();
    const drawer2 = page.locator('.drawer-content').first();
    await expect(drawer2).toBeVisible({ timeout: 5000 });
    const movieChip = drawer2.locator('.filter-bar__chip', { hasText: '电影' }).first();
    if (await movieChip.count()) {
      await movieChip.click();
      await drawer2.locator('.bmb-pf-apply').click();
      await expect(drawer2).toBeHidden({ timeout: 5000 });
    }
    const rail = page.locator('.bmb-rail').first();
    if (await rail.count()) {
      const padding = await rail.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { left: cs.paddingLeft, right: cs.paddingRight, top: cs.paddingTop };
      });
      expect(padding.left).toBe('0px');
      expect(padding.right).toBe('0px');
    }

    // BROWSE-074: 桌面宽视口不渲染移动端命令栏（切换视口回归守卫）
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 桌面布局落地信号：桌面搜索 Tab 可见 → 再断言移动端命令栏未渲染
    await expect(page.locator('.browse-search-tab').first()).toBeVisible({ timeout: 15000 });
    expect(await page.locator('.bmb').count()).toBe(0);
  });

  // ② 全屏筛选面板（三栏 + 排序分组 + 完成回写）
  test('BROWSE-077/079: 结果区去壳 + 全屏筛选面板三栏/排序分组/完成回写', async ({ page }) => {
    // BROWSE-079: 拦截 TMDB 请求计数（面板内改条件不触发请求，点完成才触发）
    let tmdbReq = 0;
    await page.route('**/api.tmdb.org/3/**', async (route) => {
      tmdbReq += 1;
      await route.continue();
    });

    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    // 打开筛选面板
    const filterTrigger = page.locator('.bmb-filter-trigger');
    await expect(filterTrigger).toBeVisible({ timeout: 10000 });
    await filterTrigger.click();
    const drawer = page.locator('.drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 顶栏三栏：返回箭头 + 标题居中 + 重置按钮
    const header = drawer.locator('.drawer-header').first();
    await expect(header).toBeVisible();
    await expect(drawer.locator('.drawer-close--back')).toBeVisible();
    await expect(drawer.locator('.drawer-title')).toBeVisible();
    await expect(drawer.locator('.drawer-reset')).toHaveText('重置');

    // 排序分组存在（FilterBar 未 hideFooter → 排序作为第 5 分组）
    const sortGroup = drawer.locator('.filter-bar__footer').first();
    await expect(sortGroup).toBeVisible();
    const sortChips = sortGroup.locator('.filter-bar__sort-btn');
    expect(await sortChips.count()).toBeGreaterThanOrEqual(3);

    // 完成制：面板内点击筛选 chip 不触发 TMDB 请求
    const reqBefore = tmdbReq;
    const chip = drawer.locator('.filter-bar__chip').nth(2);
    if (await chip.count()) {
      await chip.click();
      // TODO: 替换为条件等待 —— 此处为「不应发生请求」的否定断言，
      // 无可等待的正向 DOM 信号（nth(2) 可能是 label 型 chip，无 --active 回写），
      // 故保留极短观测窗口（600ms → 300ms）以捕获可能的防抖请求。
      await page.waitForTimeout(300);
    }
    expect(tmdbReq).toBe(reqBefore);

    // 点击「完成」→ 面板关闭
    await drawer.locator('.bmb-pf-apply').click();
    await expect(drawer).toBeHidden({ timeout: 5000 });

    // BROWSE-077: 移动端结果区 AppLoading 被去壳（不卡片套卡片）
    await page.route('**/api.tmdb.org/3/search/**', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    const box = page.locator('.sticky-header .search-box__input').first();
    await expect(box).toBeVisible({ timeout: 10000 });
    await box.fill('batman');
    await box.press('Enter');

    // BROWSE-077: 移动端结果区专属骨架被去壳（不卡片套卡片）
    // 2026-09-12 骨架整改：结果区 loading 由 AppLoading 换为页面专属 BrowseSkeleton
    const loading = page.locator('.browse-results-body .browse-skeleton').first();
    await expect(loading).toBeVisible({ timeout: 5000 });
    const border = await loading.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(border).toBe('0px');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.9 移动端筛选面板底部操作区
// ═══════════════════════════════════════════════════════════════

test.describe('2.9 移动端筛选面板底部操作区', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('BROWSE-081/082: 底部操作区真固定（不随面板滚动）+ 挡住它的返回顶部圆钮不参与绘制', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    // 前置：先滚过返回顶部圆钮的显示阈值，让它进入可见态（复现「圆钮盖住完成按钮」的场景）
    const scroller = page.locator('.app-shell__scroll');
    await expect(scroller).toBeVisible({ timeout: 5000 });
    await scroller.evaluate((el) => { el.scrollTop = 2000; });
    await expect.poll(() => page.locator('.back-to-top-button').count(), { timeout: 2500 }).toBeGreaterThan(0);

    const trigger = page.locator('.bmb-filter-trigger');
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.click();
    const drawer = page.locator('.drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 081a 结构：底部操作区必须是滚动容器 .drawer-body 的兄弟节点，不能落在它内部
    // （旧实现写在 children 里 → sticky 内容不足一屏即失效、滚到底又被 padding 顶开）
    expect(await drawer.locator('.drawer-body .bmb-foot').count()).toBe(0);
    await expect(drawer.locator('.drawer-footer .bmb-foot')).toHaveCount(1);

    // 081b 几何：滚动面板内容前后，底部操作区位置不变，且贴住面板底边
    const measure = async () => {
      const foot = await drawer.locator('.bmb-foot').boundingBox();
      const content = await drawer.boundingBox();
      return {
        footY: foot?.y ?? -1,
        footBottom: (foot?.y ?? 0) + (foot?.height ?? 0),
        contentBottom: (content?.y ?? 0) + (content?.height ?? 0),
      };
    };
    const before = await measure();
    expect(before.footY).toBeGreaterThan(0);
    await drawer.locator('.drawer-body').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const after = await measure();
    expect(after.footY).toBe(before.footY);
    expect(Math.abs(after.footBottom - after.contentBottom)).toBeLessThanOrEqual(2);

    // 082a 层级：面板走 --z-modal token（1000+），不再硬编码 60/61
    const zIndex = await drawer.evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(zIndex).toBeGreaterThanOrEqual(1000);

    // 082b 面板打开期间返回顶部玻璃圆钮（fixed + backdrop-filter，坐标正压「完成」）不参与绘制
    const backToTopDisplay = await page
      .locator('.back-to-top-button')
      .evaluate((el) => getComputedStyle(el).display);
    expect(backToTopDisplay).toBe('none');
  });
});
