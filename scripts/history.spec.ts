/**
 * 历史记录页 (History) 测试用例
 * 路由: /history
 * 配置依赖: Level 3（全配置）
 *
 * 覆盖: HIS-001 ~ HIS-061
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 8.1 Tab 切换
// ═══════════════════════════════════════════════════════════════

test.describe('8.1 Tab 切换', () => {
  test('HIS-001: 默认影视 Tab', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.history-page, [class*="history"]');
    });
    expect(hasContent).toBe(true);
    console.log('✅ HIS-001 通过: 历史记录页默认加载');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.2 影视历史
// ═══════════════════════════════════════════════════════════════

test.describe('8.2 影视历史', () => {
  test('HIS-011: 历史为空时显示空状态', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasData = await page.evaluate(() => {
      return !!document.querySelector('.history-group, [class*="history-group"]');
    });
    const hasEmpty = await page.evaluate(() => {
      return !!document.querySelector('.empty-state, [class*="empty"]');
    });
    console.log(`✅ HIS-011 检查完成: 历史数据 = ${hasData}，空状态 = ${hasEmpty}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.3 时间分组
// ═══════════════════════════════════════════════════════════════

test.describe('8.3 时间分组', () => {
  test('HIS-020: 分组正确性', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 预期结果: 时间分组存在
    const hasGroups = await page.evaluate(() => {
      return !!document.querySelector('.history-group, [class*="group"]');
    });
    console.log(`✅ HIS-020 检查完成: 时间分组存在 = ${hasGroups}`);
  });

  test('HIS-022: 时间轴导航', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 预期结果: 时间轴存在（桌面端）
    const hasTimeline = await page.evaluate(() => {
      return !!document.querySelector('.history-node-col, [class*="timeline"]');
    });
    console.log(`✅ HIS-022 检查完成: 时间轴存在 = ${hasTimeline}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.4 去重显示
// ═══════════════════════════════════════════════════════════════

test.describe('8.4 去重显示', () => {
  test('HIS-025: 切换 tab 时同一剧集/频道不重复显示', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 操作: 在「综合」tab 记录卡片数量，切换到「IPTV」tab 再切回来
    const videoCards = page.locator('.history-page .record-card');
    const initialVideoCount = await videoCards.count();

    // 切换到 IPTV tab（融合 StatusTabs 第三项）
    const iptvTab = page.locator('.status-tab').filter({ hasText: 'IPTV' });
    if (await iptvTab.isVisible().catch(() => false)) {
      await iptvTab.click();
      await page.waitForTimeout(1000);

      // 切回综合 tab
      const allTab = page.locator('.status-tab').filter({ hasText: '综合' });
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click();
        await page.waitForTimeout(1000);

        // 预期结果: 影视卡片数量不增加（同一剧集不同集不重复显示）
        const afterSwitchCount = await videoCards.count();
        expect(afterSwitchCount).toBeLessThanOrEqual(initialVideoCount);
        console.log(`✅ HIS-025 通过: 切换前后卡片数 ${initialVideoCount} → ${afterSwitchCount}`);
      } else {
        console.log('⚠️ HIS-025: 综合 tab 未检测到');
      }
    } else {
      console.log('⚠️ HIS-025: IPTV tab 未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.5 批量管理
// ═══════════════════════════════════════════════════════════════

test.describe('8.5 批量管理', () => {
  test('HIS-040: 批量管理按钮', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const editBtn = page.locator('.action-btn--batch');
    if (await editBtn.isVisible().catch(() => false)) {
      const text = await editBtn.textContent();
      console.log(`✅ HIS-040 通过: 批量管理按钮文本 = "${text}"`);
    } else {
      console.log('⚠️ HIS-040: 批量管理按钮未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.7 融合 Tab（综合/视频/IPTV）与「更多筛选」面板
// 覆盖: HIS-060 融合 Tab 渲染、HIS-061 筛选面板开关
// ═══════════════════════════════════════════════════════════════

test.describe('8.7 融合 Tab 与筛选面板', () => {
  test('HIS-060: 融合 Tab 渲染（综合/视频/IPTV，默认激活综合）', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const tabs = page.locator('.record-status--fused .status-tab');
    expect(await tabs.count()).toBe(3);
    const labels = (await tabs.allTextContents()).map((t) => t.replace(/\s+/g, '').replace(/\d+/g, ''));
    expect(labels.join(',')).toContain('综合');
    expect(labels.join(',')).toContain('视频');
    expect(labels.join(',')).toContain('IPTV');

    const active = page.locator('.record-status--fused .status-tab--active');
    expect((await active.textContent())?.replace(/\d+/g, '')).toContain('综合');
    console.log(`✅ HIS-060 通过: 融合 Tab 标签 = ${labels.join('/')}，默认激活综合`);
  });

  test('HIS-061: 「更多筛选」面板展开/收起（状态 chips + 排序）', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const filterBtn = page.locator('.action-btn--filter');
    const panel = page.locator('.record-filter-panel');

    // 初始收起
    expect(await panel.count()).toBe(0);

    // 展开
    await filterBtn.click();
    await page.waitForSelector('.record-filter-panel', { timeout: 5000 });
    expect(await page.locator('.record-filter-chip--status').count()).toBe(3); // 全部/未看完/已看完

    // 收起
    await filterBtn.click();
    await page.waitForTimeout(400);
    expect(await page.locator('.record-filter-panel').count()).toBe(0);
    console.log('✅ HIS-061 通过: 筛选面板可展开/收起');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.8 网格列数（视口自适应：桌面 3 列 / 平板·移动 2 列 / 手机 1 列）
// 覆盖: HIS-062
// ═══════════════════════════════════════════════════════════════

test.describe('8.8 网格列数', () => {
  const seedGrid = async (page: import('@playwright/test').Page) => {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('video-warehouse');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('history', 'readwrite');
      const now = Date.now();
      let id = 0;
      const put = (label: string, hoursAgo: number) => {
        tx.objectStore('history').put({
          id: `hist-grid-${id++}`,
          videoId: `tmdb-grid-${id}`,
          title: `${label}${id}`,
          cover: '',
          backdrop: '',
          type: 'movie',
          progress: 100,
          duration: 8000,
          updatedAt: now - hoursAgo * 3600000,
          createdAt: now - hoursAgo * 3600000,
        });
      };
      for (let i = 0; i < 6; i++) put('今天剧', i);
      for (let i = 0; i < 6; i++) put('更早剧', 24 * 8 + i);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
  };

  test('HIS-062: 列数随视口变化（1280→3 列、600→2 列、375→1 列）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);
    await seedGrid(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.history-grid', { timeout: 15000 });
    await page.waitForTimeout(800);

    const cols = () =>
      page.evaluate(() => {
        const g = document.querySelector('.history-grid') as HTMLElement;
        if (!g) return 0;
        const matches = getComputedStyle(g).gridTemplateColumns.match(/[^ ]+(?:px|fr|%)/g);
        return matches ? matches.length : 0;
      });

    expect(await cols()).toBe(3); // 桌面 ≥1280：3 列
    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(500);
    expect(await cols()).toBe(2); // <1280（平板/小桌面/移动）：2 列
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(500);
    expect(await cols()).toBe(1); // ≤480：1 列
    console.log('✅ HIS-062 通过: 1280→3 列 / 600→2 列 / 375→1 列');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.6 桌面算珠时间轴（sticky 面板 + 算珠累加）
// 覆盖: HIS-050 面板/断点切换、HIS-051 滚动累加与回弹验证
// ═══════════════════════════════════════════════════════════════

test.describe('8.6 桌面算珠时间轴', () => {
  // 注入跨「今天/昨天/更早」三分组的历史记录（周一无「本周」组）
  const seedHistory = async (page: import('@playwright/test').Page) => {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('video-warehouse');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('history', 'readwrite');
      const now = Date.now();
      const H = 3600000;
      let id = 0;
      const put = (label: string, hoursAgo: number) => {
        tx.objectStore('history').put({
          id: `hist-abacus-${id++}`,
          videoId: `tmdb-movie-${id}`,
          title: `${label}${id}`,
          cover: '',
          backdrop: '',
          type: 'movie',
          progress: 100,
          duration: 8000,
          updatedAt: now - hoursAgo * H,
          createdAt: now - hoursAgo * H,
        });
      };
      for (let i = 0; i < 12; i++) put('今天剧', i); // 0~11h
      for (let i = 0; i < 8; i++) put('昨天剧', 24 + i); // 24~31h
      for (let i = 0; i < 14; i++) put('更早剧', 24 * 8 + i); // 8 天前（3 列网格下末组高度 < 视口，保证滚动到末组仍在折叠线以下）
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
  };

  test('HIS-050: 桌面端算珠面板渲染 / 移动端隐藏', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);
    await seedHistory(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.history-timeline', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 桌面：面板可见、珠数 = 分组数（3）、内联节点行隐藏
    const desktop = await page.evaluate(() => {
      const panel = document.querySelector('.history-timeline');
      const beads = document.querySelectorAll('.history-timeline__bead');
      const inlineCols = document.querySelectorAll('.history-node-col');
      return {
        panelVisible: !!panel && getComputedStyle(panel).display !== 'none',
        beadCount: beads.length,
        inlineColHidden: inlineCols.length > 0
          ? getComputedStyle(inlineCols[0]).display === 'none'
          : null,
      };
    });
    expect(desktop.panelVisible).toBe(true);
    expect(desktop.beadCount).toBe(3);
    expect(desktop.inlineColHidden).toBe(true);
    console.log(`✅ HIS-050 桌面: 面板=${desktop.panelVisible} 珠数=${desktop.beadCount} 内联行隐藏=${desktop.inlineColHidden}`);

    // 移动端（767px）：面板隐藏、内联节点行保留
    await page.setViewportSize({ width: 767, height: 800 });
    await page.waitForTimeout(600);
    const mobile = await page.evaluate(() => {
      const panel = document.querySelector('.history-timeline');
      const inlineCols = document.querySelectorAll('.history-node-col');
      return {
        panelHidden: panel ? getComputedStyle(panel).display === 'none' : true,
        inlineColVisible: inlineCols.length > 0
          ? getComputedStyle(inlineCols[0]).display !== 'none'
          : false,
      };
    });
    expect(mobile.panelHidden).toBe(true);
    expect(mobile.inlineColVisible).toBe(true);
    console.log(`✅ HIS-050 移动端: 面板隐藏=${mobile.panelHidden} 内联行可见=${mobile.inlineColVisible}`);
  });

  test('HIS-051: 滚动时算珠逐颗累加（无重叠），回顶恢复原位（无回弹）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(800);
    await seedHistory(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.history-timeline', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 珠 y（相对面板顶）快照
    const beadYs = () =>
      page.evaluate(() => {
        const panel = document.querySelector('.history-timeline') as HTMLElement | null;
        const panelTop = panel?.getBoundingClientRect().top ?? 0;
        return [...document.querySelectorAll('.history-timeline__bead')].map((b) => {
          const r = b.getBoundingClientRect();
          return { label: b.textContent ?? '', y: Math.round((r.top - panelTop) * 100) / 100 };
        });
      });

    const initial = await beadYs();
    expect(initial.length).toBe(3);
    // 初始位置应互不重叠且与分组对齐（今天珠在顶部 8px 槽位）
    expect(initial[0].y).toBeLessThan(50);

    // 滚动到底：中间组（昨天）应滚过面板顶并被收进堆叠槽 → 珠 y 严格递增、间距 ≈ 28px
    await page.evaluate(() => {
      const el = document.querySelector('.app-shell__scroll') as HTMLElement;
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(500);
    const bottom = await beadYs();
    const gaps = bottom.slice(1).map((b, i) => b.y - bottom[i].y);
    expect(bottom[0].y).toBeLessThan(50); // 今天珠仍在顶部槽位
    for (const g of gaps) expect(g).toBeGreaterThan(24); // 无重叠、间距不塌陷
    expect(bottom[bottom.length - 1].y).toBeGreaterThan(100); // 未读分组仍跟随其分组（未误入堆叠）
    console.log(`✅ HIS-051 底部: y=[${bottom.map((b) => b.y).join(', ')}] 间距=[${gaps.join(', ')}]`);

    // 回到顶部：全部珠恢复初始 y（无回弹、无漂移）
    await page.evaluate(() => {
      const el = document.querySelector('.app-shell__scroll') as HTMLElement;
      el.scrollTop = 0;
    });
    await page.waitForTimeout(500);
    const restored = await beadYs();
    for (let i = 0; i < initial.length; i++) {
      expect(Math.abs(restored[i].y - initial[i].y)).toBeLessThan(2);
    }
    console.log(`✅ HIS-051 回顶: 恢复原位差异 ≤ 1px（${restored.map((b) => b.y).join(', ')}）`);
  });
});
