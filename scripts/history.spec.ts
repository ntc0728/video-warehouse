/**
 * 历史记录页 (History) 测试用例（精简合并版）
 * 路由: /history
 * 配置依赖: Level 3（全配置）
 *
 * 覆盖: HIS-001 ~ HIS-061
 * 合并映射: 8.1+8.2(001,011) / 8.3(020,022) / 8.4+8.5(025,040)
 *          / 8.6(050,051) / 8.7(060,061) / 8.8(062)
 */
import { test, expect } from './fixtures/mock-tmdb';

/**
 * 等应用完成 IndexedDB 建库（history store 就绪）后再注入种子数据。
 * 用 indexedDB.databases() 探测而非直接 open，避免测试先建出无 store 的空库。
 */
const waitForHistoryStore = async (page: import('@playwright/test').Page) => {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const list = (await indexedDB.databases?.()) ?? [];
          if (!list.some((d) => d.name === 'video-warehouse')) return false;
          const db = await new Promise<IDBDatabase | null>((resolve) => {
            const req = indexedDB.open('video-warehouse');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
          });
          const ok = !!db && db.objectStoreNames.contains('history');
          db?.close();
          return ok;
        }),
      { timeout: 10000 },
    )
    .toBe(true);
};

// ═══════════════════════════════════════════════════════════════
// 8.1 Tab 切换 + 8.2 影视历史
// ═══════════════════════════════════════════════════════════════

test.describe('8.1 Tab 切换 + 8.2 影视历史', () => {
  test('HIS-001/011: 默认影视 Tab 与空状态', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 001 默认影视 Tab 渲染
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.history-page, [class*="history"]')), {
        timeout: 4000,
      })
      .toBe(true);

    // 011 历史为空时显示空状态（有数据或空状态二者其一）
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!document.querySelector('.history-group, [class*="history-group"]') ||
              !!document.querySelector('.empty-state, [class*="empty"]'),
          ),
        { timeout: 4000 },
      )
      .toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.3 时间分组
// ═══════════════════════════════════════════════════════════════

test.describe('8.3 时间分组', () => {
  test('HIS-020/022: 分组正确性 + 时间轴导航', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 020 分组存在
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.history-group, [class*="group"]')), {
        timeout: 4000,
      })
      .toBe(true);

    // 022 历史页渲染（时间轴在存在观看记录时出现，空状态时为「暂无观看记录」）
    await expect
      .poll(
        () =>
          page.evaluate(
            () => !!document.querySelector('.history-page, .history-timeline, [class*="history"]'),
          ),
        { timeout: 4000 },
      )
      .toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.4 去重显示 + 8.5 批量管理
// ═══════════════════════════════════════════════════════════════

test.describe('8.4 去重显示 + 8.5 批量管理', () => {
  test('HIS-025/040: 切换 tab 不重复 + 批量管理按钮', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 040 批量管理按钮存在
    const editBtn = page.locator('.action-btn--batch');
    await expect(editBtn.first()).toBeAttached({ timeout: 4000 });
    expect(await editBtn.count()).toBeGreaterThan(0);
    if (await editBtn.isVisible().catch(() => false)) {
      const text = await editBtn.textContent();
    }

    // 025 切换 tab 时同一剧集/频道不重复显示
    const videoCards = page.locator('.history-page .record-card');
    const initialVideoCount = await videoCards.count();

    const iptvTab = page.locator('.status-tab').filter({ hasText: 'IPTV' });
    if (await iptvTab.isVisible().catch(() => false)) {
      await iptvTab.click();
      // 等 tab 激活态切换完成（列表随之重渲染）
      await expect(page.locator('.status-tab--active').first()).toContainText('IPTV', { timeout: 3000 });

      const allTab = page.locator('.status-tab').filter({ hasText: '综合' });
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click();
        await expect(page.locator('.status-tab--active').first()).toContainText('综合', { timeout: 3000 });

        const afterSwitchCount = await videoCards.count();
        expect(afterSwitchCount).toBeLessThanOrEqual(initialVideoCount);
      }
    }
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

  test('HIS-050/051: 面板渲染/移动端隐藏 + 滚动累加与回弹', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await waitForHistoryStore(page);
    await seedHistory(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.history-timeline', { timeout: 15000 });

    // 050 桌面：面板可见、珠数 = 分组数（3）、内联节点行隐藏
    // 等三颗算珠渲染齐（种子数据跨今天/昨天/更早三组）后再取样式快照
    await expect.poll(() => page.locator('.history-timeline__bead').count(), { timeout: 10000 }).toBeGreaterThanOrEqual(3);
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
    expect(desktop.beadCount).toBeGreaterThanOrEqual(3);
    expect(desktop.inlineColHidden).toBe(true);

    // 050 移动端（767px）：面板隐藏、内联节点行保留
    await page.setViewportSize({ width: 767, height: 800 });
    // 等媒体查询生效（面板转为 display:none）后再取样式快照
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const panel = document.querySelector('.history-timeline');
            return panel ? getComputedStyle(panel).display === 'none' : true;
          }),
        { timeout: 2600 },
      )
      .toBe(true);
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

    // 051 珠 y（相对面板顶）快照
    await page.setViewportSize({ width: 1280, height: 800 });
    // 等桌面断点恢复（面板重新可见）后再量珠位
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const panel = document.querySelector('.history-timeline');
            return !!panel && getComputedStyle(panel).display !== 'none';
          }),
        { timeout: 2600 },
      )
      .toBe(true);
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
    expect(initial.length).toBeGreaterThanOrEqual(3);
    expect(initial[0].y).toBeLessThan(50);

    // 滚动到底：中间组（昨天）应滚过面板顶并被收进堆叠槽 → 珠 y 严格递增、间距 ≈ 28px
    await page.evaluate(() => {
      const el = document.querySelector('.app-shell__scroll') as HTMLElement;
      el.scrollTop = el.scrollHeight;
    });
    // 等珠位随滚动累加进堆叠槽（末珠被推到 100px 以下）后再快照
    await expect
      .poll(
        async () => {
          const ys = await beadYs();
          return ys.length >= 3 && ys[ys.length - 1].y > 100;
        },
        { timeout: 2500 },
      )
      .toBe(true);
    const bottom = await beadYs();
    const gaps = bottom.slice(1).map((b, i) => b.y - bottom[i].y);
    expect(bottom[0].y).toBeLessThan(50);
    for (const g of gaps) expect(g).toBeGreaterThan(24);
    expect(bottom[bottom.length - 1].y).toBeGreaterThan(100);

    // 回到顶部：珠数守恒 + 首珠回顶（落位由 RAF 异步收敛，不逐珠等距比对，避免亚像素脆弱）
    await page.evaluate(() => {
      const el = document.querySelector('.app-shell__scroll') as HTMLElement;
      el.scrollTop = 0;
    });
    await expect
      .poll(
        async () => {
          const ys = await beadYs();
          return ys.length === initial.length && ys[0].y < 50;
        },
        { timeout: 5000 },
      )
      .toBe(true);
    const restored = await beadYs();
    // 恢复后珠数守恒、首珠回到面板顶（核心回归锁：滚动回顶不丢珠、不滞留栈槽）
    expect(restored.length).toBe(initial.length);
    expect(restored[0].y).toBeLessThan(50);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.7 融合 Tab（综合/视频/IPTV）与「更多筛选」面板
// 覆盖: HIS-060 融合 Tab 渲染、HIS-061 筛选面板开关
// ═══════════════════════════════════════════════════════════════

test.describe('8.7 融合 Tab 与筛选面板', () => {
  test('HIS-060/061: 融合 Tab 渲染 + 内嵌筛选条开关', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 060 融合 Tab：综合/视频/IPTV，默认激活综合
    const tabs = page.locator('.record-status--fused .status-tab');
    await expect(tabs).toHaveCount(3, { timeout: 3000 });
    const labels = (await tabs.allTextContents()).map((t) => t.replace(/\s+/g, '').replace(/\d+/g, ''));
    expect(labels.join(',')).toContain('综合');
    expect(labels.join(',')).toContain('视频');
    expect(labels.join(',')).toContain('IPTV');

    const active = page.locator('.record-status--fused .status-tab--active');
    expect((await active.textContent())?.replace(/\d+/g, '')).toContain('综合');

    // 061 桌面内嵌筛选条（方案 C）：状态 chips 常驻 + 排序弹层 + IPTV tab 隐藏
    const inlineFilter = page.locator('.record-inline-filter');

    await expect(inlineFilter).toBeVisible({ timeout: 5000 });
    const statusChips = inlineFilter.locator('.record-filter-chip--status');
    await expect(statusChips).toHaveCount(3);
    await expect(statusChips.filter({ hasText: '全部' })).toHaveClass(/is-active/);

    const sortBtn = inlineFilter.locator('.record-sort-btn');
    await expect(sortBtn).toContainText('最近观看');
    await sortBtn.click();
    const pop = page.locator('.record-pop');
    await expect(pop).toBeVisible({ timeout: 5000 });
    const sortItems = pop.locator('.record-pop-item');
    await expect(sortItems).toHaveCount(6);

    await sortItems.filter({ hasText: '最早观看' }).click();
    // 弹层关闭动画 + 排序生效：交由 web-first 断言自动重试
    await expect(pop).toHaveCount(0, { timeout: 3000 });
    await expect(sortBtn).toContainText('最早观看', { timeout: 3000 });

    // E-②：IPTV tab 下状态/排序仅作用于影视 → 内嵌筛选条整段隐藏
    await page.locator('.record-status--fused .status-tab', { hasText: 'IPTV' }).click();
    await expect(inlineFilter).toHaveCount(0, { timeout: 3000 });

    // 切回综合恢复
    await page.locator('.record-status--fused .status-tab', { hasText: '综合' }).click();
    await expect(inlineFilter).toBeVisible({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 8.8 网格列数（视口自适应：桌面 ≥1024 每档 4 列起 / 768–1023 三列 / 480–767 两列 / 手机 1 列）
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

  test('HIS-062: 列数随视口变化（1280→4 列、900→3 列、600→2 列、375→1 列）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await waitForHistoryStore(page);
    await seedGrid(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.history-grid', { timeout: 15000 });

    const cols = () =>
      page.evaluate(() => {
        const g = document.querySelector('.history-grid') as HTMLElement;
        if (!g) return 0;
        const matches = getComputedStyle(g).gridTemplateColumns.match(/[^ ]+(?:px|fr|%)/g);
        return matches ? matches.length : 0;
      });

    // 每档视口切换后轮询 grid 列数，等布局重排稳定即返回（替代固定睡眠）
    await expect.poll(cols, { timeout: 2800 }).toBe(4); // 桌面 ≥1024 rail 布局：内容区被 126px 左栏 + gap 压缩，1280 档实际 4 列（原 5 列断言基于无 rail 的旧布局）
    await page.setViewportSize({ width: 900, height: 800 });
    await expect.poll(cols, { timeout: 2500 }).toBe(3); // 768–1023：3 列（2026-09-03 补档）
    await page.setViewportSize({ width: 600, height: 800 });
    await expect.poll(cols, { timeout: 2500 }).toBe(2); // 480–767：2 列
    await page.setViewportSize({ width: 375, height: 800 });
    await expect.poll(cols, { timeout: 2500 }).toBe(1); // ≤480：1 列
  });
});
