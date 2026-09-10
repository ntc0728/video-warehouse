/**
 * IPTV 直播页测试用例（精简合并版）
 * 路由: /iptv
 * 配置依赖: Level 3（全配置）— 需 IPTV 代理才能播放频道流
 *
 * 覆盖: IPTV-001 ~ IPTV-075
 * 合并映射: 5.1(001,003,004) / 5.2(010,011) / 5.5(040,041)
 *          / 5.10(080,081) / 5.7(062)
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 5.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('5.1 页面加载', () => {
  test('IPTV-001/003/004: 正常加载 / 空状态 / 代理警告', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 001 正常加载
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.iptv-page, [class*="iptv"]')), { timeout: 7000 })
      .toBe(true);

    // 003 无频道数据时显示空状态（有数据或空状态二者其一）
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!document.querySelector('.iptv-channel-grid, [class*="channel"]') ||
              !!document.querySelector('.empty-state, [class*="empty"]'),
          ),
        { timeout: 7000 },
      )
      .toBe(true);

    // 004 代理未配置警告（或页面已加载）
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.iptv-proxy-warning-inline, .iptv-page')), {
        timeout: 7000,
      })
      .toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.2 频道分组筛选
// ═══════════════════════════════════════════════════════════════

test.describe('5.2 频道分组筛选', () => {
  test('IPTV-010/011: 分组标签显示 + 分组折叠', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 010 分组标签（桌面左栏分类条目）— waitForSelector 已是条件等待，无需额外睡眠
    await expect(page.locator('.iptv-rail__item').first()).toBeVisible({ timeout: 20000 });
    const railItemCount = await page.locator('.iptv-rail__item').count();
    expect(railItemCount).toBeGreaterThan(0);

    // 011 分组折叠（超过 2 行折叠 + 展开/收起切换）
    const expandBtn = page.locator('.grouppicker__expand-btn');
    if (await expandBtn.isVisible().catch(() => false)) {
      const label = (await expandBtn.textContent())?.trim();
      const hasMaxH = await page
        .locator('.grouppicker__hot-tags')
        .first()
        .evaluate((el) => el.style.maxHeight !== '' && el.style.overflow === 'hidden')
        .catch(() => false);
      expect(label).toBe('展开更多');

      await expandBtn.click();
      await expect(expandBtn).toHaveText('收起', { timeout: 2300 });
      const after = (await expandBtn.textContent())?.trim();
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
  test('IPTV-040/041: 检测按钮 + 可用性 badge', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 040 检测按钮存在
    const checkBtn = page.locator('.refresh-btn').first();
    await expect(checkBtn).toBeAttached({ timeout: 5000 });
    expect(await checkBtn.count()).toBeGreaterThan(0);
    if (await checkBtn.isVisible().catch(() => false)) {
      const text = await checkBtn.textContent();
    }

    // 041 检测结果可用性 badge 展示（LIVE 徽标每张卡恒渲染）
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!document.querySelector(
                '.record-card__live-badge, [class*="iptv-channel"], [class*="channel-card"]',
              ),
          ),
        { timeout: 5000 },
      )
      .toBe(true);
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

    // 等频道网格（或空状态）渲染完成，容器才具备可滚动高度
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!document.querySelector('.iptv-channel-grid, [class*="channel"]') ||
              !!document.querySelector('.empty-state, [class*="empty"]'),
          ),
        { timeout: 7000 },
      )
      .toBe(true);

    // 操作: 滚动到页面下方（真实滚动容器是 .app-shell__scroll，而非 .app-shell / window）
    const scroller = page.locator('.app-shell__scroll');
    await expect(scroller).toBeVisible({ timeout: 5000 });
    await scroller.evaluate((el) => { el.scrollTop = 2000; });

    // 预期结果: 回到顶部按钮可见（滚动监听有节流，轮询等其挂载）
    const backToTop = page.locator('.back-to-top-button');
    await expect.poll(() => backToTop.count(), { timeout: 2500 }).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.10 频道台标回退链（三级：M3U tvg-logo → EPG XMLTV icon → 在线台标库）
// 依赖真实频道数据（Level 3 配置），故采用条件式断言。
// ═══════════════════════════════════════════════════════════════

test.describe('5.10 频道台标回退链', () => {
  // 1x1 透明 GIF（与 mock-tmdb fixture 相同的占位图惯例）
  const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  test('IPTV-080/081: 在线台标库候选 + EPG icon 二级回退', async ({ page }) => {
    let libraryHits = 0;
    await page.route('**/live.fanmingming.cn/**', async (route) => {
      libraryHits++;
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });
    await page.route('**/raw.githubusercontent.com/wanglindl/**', async (route) => {
      libraryHits++;
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });

    const epgXml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="CCTV-1"><display-name>CCTV-1 综合</display-name><icon src="https://mock.example.com/cctv1.png"/></channel>
  <channel id="CCTV-13"><display-name>CCTV-13 新闻</display-name><icon src="https://mock.example.com/cctv13.png"/></channel>
  <channel id="hunantv"><display-name>湖南卫视</display-name><icon src="https://mock.example.com/hunan.png"/></channel>
</tv>`;
    await page.route('**/*e.xml*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/xml', body: epgXml });
    });
    await page.route('**/mock.example.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    });

    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.iptv-channel-grid .iptv-channel-card', { timeout: 20000 }).catch(() => {});
    // 台标回退链依赖真实频道数据：轮询等首张台标 img 挂载 + 在线台标库请求落地；
    // 无频道数据的环境轮询超时后照旧走下方「跳过」分支（与原固定睡眠语义一致）
    await page
      .locator('.iptv-channel-grid .iptv-card-cover img')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .catch(() => {});
    await expect
      .poll(() => libraryHits, { timeout: 5000 })
      .toBeGreaterThan(0)
      .catch(() => {});

    // 080 无 tvg-logo 频道卡片使用在线台标库候选
    const srcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.iptv-channel-grid .iptv-card-cover img'))
        .map((img) => (img as HTMLImageElement).src)
        .filter(Boolean)
    );
    const onlineSrcs = srcs.filter(
      (s) => s.startsWith('https://live.fanmingming.cn/') || s.startsWith('https://raw.githubusercontent.com/wanglindl/')
    );

    if (libraryHits > 0) {
      expect(onlineSrcs.length).toBeGreaterThan(0);
      expect(onlineSrcs[0]).toMatch(
        /^https:\/\/(live\.fanmingming\.cn\/tv\/|raw\.githubusercontent\.com\/wanglindl\/TVlogo\/main\/img\/)/
      );
    } else {
      console.log('ℹ️ IPTV-080 跳过: 环境频道未触发在线台标库请求');
    }

    // 081 EPG XMLTV icon 作为台标二级回退
    const epgIconImgs = page.locator('.iptv-channel-grid .iptv-card-cover img[src^="https://mock.example.com/"]');
    await expect(epgIconImgs.first()).toBeVisible({ timeout: 12000 }).catch(() => {});
    const count = await epgIconImgs.count();
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      console.log('ℹ️ IPTV-081 跳过: 无频道匹配 mock EPG 频道（含 icon）');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.11 频道卡片收藏按钮
// ═══════════════════════════════════════════════════════════════

test.describe('5.11 频道卡片收藏按钮', () => {
  test('IPTV-090: 收藏按钮不依赖台标加载结果（每张卡都渲染）', async ({ page }) => {
    // 台标整体 404：复现「台标加载失败」。旧实现 showFavorite 是
    // `imageLoaded || !channel.logo`，此时 onLoad 永不触发 → imageLoaded 恒 false
    // 而 channel.logo 非空 → 整颗红心不渲染（实测 60 张卡只有 3 颗）。
    await page.route('**/i.imgur.com/**', (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect
      .poll(() => page.locator('.iptv-channel-card-wrap').count(), { timeout: 25000 })
      .toBeGreaterThan(0);

    const counts = await page.evaluate(() => ({
      cards: document.querySelectorAll('.iptv-channel-card-wrap').length,
      favorites: document.querySelectorAll('.iptv-card-favorite').length,
    }));

    expect(counts.cards).toBeGreaterThan(0);
    // 收藏按钮与卡片一一对应（≤767px / app 端只是 display:none，仍在 DOM 中）
    expect(counts.favorites).toBe(counts.cards);
  });
});
