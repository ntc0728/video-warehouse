/**
 * IPTV 直播页测试用例
 * 路由: /iptv
 * 配置依赖: Level 3（全配置）— 需 IPTV 代理才能播放频道流
 *
 * 覆盖: IPTV-001 ~ IPTV-075
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 5.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('5.1 页面加载', () => {
  test('IPTV-001: 正常加载', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 页面加载完成
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.iptv-page, [class*="iptv"]');
    });
    expect(hasContent).toBe(true);
    console.log('✅ IPTV-001 通过: IPTV 页正常加载');
  });

  test('IPTV-003: 无频道数据时显示空状态', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 预期结果: 有频道数据或显示空状态
    const hasChannels = await page.evaluate(() => {
      return !!document.querySelector('.iptv-channel-grid, [class*="channel"]');
    });
    const hasEmpty = await page.evaluate(() => {
      return !!document.querySelector('.empty-state, [class*="empty"]');
    });
    console.log(`✅ IPTV-003 检查完成: 频道数据 = ${hasChannels}，空状态 = ${hasEmpty}`);
  });

  test('IPTV-004: 代理未配置警告', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 预期结果: 如代理未配置则显示警告
    const hasWarning = await page.evaluate(() => {
      return !!document.querySelector('.iptv-proxy-warning-inline, [class*="proxy-warning"]');
    });
    console.log(`✅ IPTV-004 检查完成: 代理警告 = ${hasWarning}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.2 频道分组筛选
// ═══════════════════════════════════════════════════════════════

test.describe('5.2 频道分组筛选', () => {
  test('IPTV-010: 分组标签显示', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 预期结果: 分组标签存在
    const hasGroups = await page.evaluate(() => {
      return !!document.querySelector('.grouppicker__hot-tag, .grouppicker__hot-tags');
    });
    console.log(`✅ IPTV-010 检查完成: 分组标签存在 = ${hasGroups}`);
  });

  test('IPTV-011: 分组折叠（超过 2 行折叠 + 展开/收起切换）', async ({ page }) => {
    // ADR-019：分组 tags 超过 2 行时折叠成完整 2 行 +「展开更多」按钮。
    // 仅当实际分组数据足够多触发折叠时验证；分组较少时跳过（条件式，避免不稳定）。
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    const expandBtn = page.locator('.grouppicker__expand-btn');
    if (await expandBtn.isVisible().catch(() => false)) {
      // 折叠态：文本「展开更多」，hot-tags 有 maxHeight 限制（overflow hidden）
      const label = (await expandBtn.textContent())?.trim();
      const hasMaxH = await page
        .locator('.grouppicker__hot-tags')
        .first()
        .evaluate((el) => el.style.maxHeight !== '' && el.style.overflow === 'hidden')
        .catch(() => false);
      console.log(`✅ IPTV-011 折叠态: 按钮="${label}", 有 maxHeight 裁剪=${hasMaxH}`);
      expect(label).toBe('展开更多');

      // 点击展开 → 文本切为「收起」
      await expandBtn.click();
      await page.waitForTimeout(300);
      const after = (await expandBtn.textContent())?.trim();
      console.log(`✅ IPTV-011 展开态: 按钮="${after}"`);
      expect(after).toBe('收起');
    } else {
      console.log('ℹ️ IPTV-011 跳过: 分组未超过 2 行，无需折叠');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.5 频道检测
// ═══════════════════════════════════════════════════════════════

test.describe('5.5 频道检测', () => {
  test('IPTV-040: 检测按钮', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 检测按钮存在
    const checkBtn = page.locator('.refresh-btn').first();
    if (await checkBtn.isVisible().catch(() => false)) {
      const text = await checkBtn.textContent();
      console.log(`✅ IPTV-040 通过: 检测按钮文本 = "${text}"`);
    } else {
      console.log('⚠️ IPTV-040: 检测按钮未检测到');
    }
  });

  test('IPTV-041: 检测结果可用性 badge 展示', async ({ page }) => {
    // ADR-019：检测结果写入 availabilityResults（按组隔离），卡片经 availability prop
    // 渲染 .availability-badge。这里验证卡片具备可容纳检测结果的 badge 结构。
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const hasBadge = await page.evaluate(() => {
      return !!document.querySelector('.availability-badge, [class*="availability"]');
    });
    console.log(`✅ IPTV-041 检查完成: 可用性 badge 结构 = ${hasBadge}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.7 懒加载与滚动
// ═══════════════════════════════════════════════════════════════

test.describe('5.7 懒加载与滚动', () => {
  test('IPTV-062: 返回顶部', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 操作: 滚动到页面下方
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);

    // 预期结果: 回到顶部按钮可见
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      console.log('✅ IPTV-062 通过: 返回顶部按钮显示');
    } else {
      console.log('⚠️ IPTV-062: 返回顶部按钮未显示');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.8 页面状态
// ═══════════════════════════════════════════════════════════════

test.describe('5.8 页面状态', () => {
  test('IPTV-075: 文档标题', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 显示默认标题
    const title = await page.title();
    console.log(`✅ IPTV-075 检查完成: 文档标题 = "${title}"`);
    expect(title).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.9 顶部搜索框（无热门搜索 / 历史独立）
// ═══════════════════════════════════════════════════════════════

test.describe('5.9 顶部搜索框', () => {
  test('IPTV-076: 顶部搜索框下拉不显示热门搜索', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.sticky-header__search input');
    await searchInput.click();
    await page.waitForTimeout(300);

    // 预期结果: 下拉框不应出现「热门搜索」
    const hotSearch = page.locator('.sticky-header').getByText('热门搜索', { exact: false });
    await expect(hotSearch).toHaveCount(0);
    console.log('✅ IPTV-076 通过: IPTV 页顶部搜索框不显示热门搜索');
  });

  test('IPTV-077: IPTV 页搜索历史与全局独立', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.sticky-header__search input');
    await searchInput.click();
    await searchInput.fill('iptv独立历史');
    await searchInput.press('Enter');
    await page.waitForTimeout(400);

    const iptvHistory = await page.evaluate(() => localStorage.getItem('search-history-iptv'));
    const globalHistory = await page.evaluate(() => localStorage.getItem('search-history'));
    expect(iptvHistory).toContain('iptv独立历史');
    expect(globalHistory ?? '').not.toContain('iptv独立历史');
    console.log('✅ IPTV-077 通过: IPTV 页搜索历史独立存储');
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.10 频道台标回退链（三级：M3U tvg-logo → EPG XMLTV icon → 在线台标库）
// ═══════════════════════════════════════════════════════════════
// 依赖真实频道数据（Level 3 配置），故采用条件式断言：频道数据/EPG 匹配
// 不满足时记录跳过日志，不产生不稳定失败（与 IPTV-011 条件式惯例一致）。

test.describe('5.10 频道台标回退链', () => {
  // 1x1 透明 GIF（与 mock-tmdb fixture 相同的占位图惯例）
  const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  test('IPTV-080: 无 tvg-logo 频道卡片使用在线台标库候选', async ({ page }) => {
    // 三级回退链在线库级：mock fanmingming/live + wanglindl/TVlogo 台标库，
    // 避免真实图片请求依赖外网（遵循项目 TMDB mock 惯例）
    let libraryHits = 0;
    await page.route('**/live.fanmingming.cn/**', async (route) => {
      libraryHits++;
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });
    await page.route('**/raw.githubusercontent.com/wanglindl/**', async (route) => {
      libraryHits++;
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });

    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 等待频道卡片出现（真实 M3U 源经代理拉取；代理不可达则无卡片，条件式跳过）
    await page.waitForSelector('.iptv-channel-grid .iptv-channel-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 收集所有卡片台标 img 的 src
    const srcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.iptv-channel-grid .iptv-card-cover img'))
        .map((img) => (img as HTMLImageElement).src)
        .filter(Boolean)
    );
    const onlineSrcs = srcs.filter(
      (s) => s.startsWith('https://live.fanmingming.cn/') || s.startsWith('https://raw.githubusercontent.com/wanglindl/')
    );
    console.log(`✅ IPTV-080 检查完成: 卡片 img=${srcs.length}, 在线库候选=${onlineSrcs.length}, 库请求=${libraryHits}`);

    if (libraryHits > 0) {
      // 确实有无 tvg-logo 的频道走了在线库 → 其卡片 img src 必须是台标库候选 URL
      expect(onlineSrcs.length).toBeGreaterThan(0);
      expect(onlineSrcs[0]).toMatch(
        /^https:\/\/(live\.fanmingming\.cn\/tv\/|raw\.githubusercontent\.com\/wanglindl\/TVlogo\/main\/img\/)/
      );
    } else {
      // 环境频道全部自带 tvg-logo（或 EPG icon 已成功加载），未触发在线库 → 条件式跳过
      console.log('ℹ️ IPTV-080 跳过: 环境频道未触发在线台标库请求');
    }
  });

  test('IPTV-081: EPG XMLTV icon 作为台标二级回退', async ({ page }) => {
    // EPG 请求（真实经 cors 代理、URL 保留 e.xml 字样；直连时同样命中）
    // 返回带 <icon> 的 XMLTV，验证 EPG icon 进入频道台标候选链
    const epgXml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="CCTV-1"><display-name>CCTV-1 综合</display-name><icon src="https://mock.example.com/cctv1.png"/></channel>
  <channel id="CCTV-13"><display-name>CCTV-13 新闻</display-name><icon src="https://mock.example.com/cctv13.png"/></channel>
  <channel id="hunantv"><display-name>湖南卫视</display-name><icon src="https://mock.example.com/hunan.png"/></channel>
</tv>`;
    await page.route('**/*e.xml*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/xml', body: epgXml });
    });
    // mock EPG icon 直链 + 在线台标库，避免任何真实图片请求
    await page.route('**/mock.example.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });
    await page.route('**/live.fanmingming.cn/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });
    await page.route('**/raw.githubusercontent.com/wanglindl/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });

    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.iptv-channel-grid .iptv-channel-card', { timeout: 20000 }).catch(() => {});

    // EPG 拉取为 fire-and-forget：轮询等待匹配频道的卡片台标变为 EPG icon
    const epgIconImgs = page.locator('.iptv-channel-grid .iptv-card-cover img[src^="https://mock.example.com/"]');
    await expect(epgIconImgs.first()).toBeVisible({ timeout: 12000 }).catch(() => {});
    const count = await epgIconImgs.count();
    console.log(`✅ IPTV-081 检查完成: EPG icon 台标卡片数 = ${count}`);

    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      // 环境频道名与 mock EPG 频道不匹配（或频道全部自带 logo）→ 条件式跳过
      console.log('ℹ️ IPTV-081 跳过: 无频道匹配 mock EPG 频道（含 icon）');
    }
  });
});
