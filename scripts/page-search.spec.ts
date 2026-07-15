/**
 * 顶部导航栏搜索功能 — 完整测试场景
 * 覆盖：单页搜索、切页重置、placeholder 变化、多页面交叉联动搜索
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

/** 等待页面加载完成 */
async function waitForPage(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState('networkidle');
}

/** 获取顶部导航栏搜索框 */
function getSearchInput(page: import('@playwright/test').Page) {
  return page.locator('.sticky-header__center .search-box__input');
}

/** 获取搜索按钮 */
function getSearchButton(page: import('@playwright/test').Page) {
  return page.locator('.sticky-header__center .search-box__submit');
}

// ═══════════════════════════════════════════════════════════════
// A. 注册页面 → 非注册页面（6 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('A. 注册页面 → 非注册页面', () => {
  test('A1: IPTV 搜 "CCTV" → 首页：搜索框清空，搜索导航 /browse', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    // 导航到首页
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影片、剧集…');

    // 搜索应导航到 /browse
    await input.fill('test');
    await getSearchButton(page).click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('A2: IPTV 搜 "CCTV" → 详情页：搜索框清空', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');

    await waitForPage(page, '/detail/550');
    await expect(input).toHaveValue('');
  });

  test('A3: IPTV 搜 "CCTV" → 设置页：搜索框清空', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');

    await waitForPage(page, '/settings');
    await expect(input).toHaveValue('');
  });

  test('A4: 收藏搜 "movie" → 首页：搜索框清空', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await input.fill('movie');

    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
  });

  test('A5: 历史搜 "show" → 首页：搜索框清空', async ({ page }) => {
    await waitForPage(page, '/history');
    const input = getSearchInput(page);
    await input.fill('show');

    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
  });

  test('A6: 收藏搜 "movie" → 详情页：搜索框清空', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await input.fill('movie');

    await waitForPage(page, '/detail/550');
    await expect(input).toHaveValue('');
  });
});

// ═══════════════════════════════════════════════════════════════
// B. 非注册页面 → 注册页面（3 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('B. 非注册页面 → 注册页面', () => {
  test('B1: 首页 → IPTV：搜索框清空，IPTV placeholder', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);
    await expect(input).toHaveAttribute('placeholder', '搜索影片、剧集…');

    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');
  });

  test('B2: 首页 → 收藏：搜索框清空，收藏 placeholder', async ({ page }) => {
    await waitForPage(page, '/');
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');
  });

  test('B3: 首页 → 历史：搜索框清空，历史 placeholder', async ({ page }) => {
    await waitForPage(page, '/');
    await waitForPage(page, '/history');
    const input = getSearchInput(page);
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');
  });
});

// ═══════════════════════════════════════════════════════════════
// C. 注册页面 → 注册页面（3 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('C. 注册页面 → 注册页面', () => {
  test('C1: IPTV 搜 "CCTV" → 收藏：搜索框清空，收藏 placeholder', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');

    await waitForPage(page, '/collections');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');
  });

  test('C2: 收藏搜 "movie" → 历史：搜索框清空，历史 placeholder', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await input.fill('movie');

    await waitForPage(page, '/history');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');
  });

  test('C3: 历史搜 "show" → IPTV：搜索框清空，IPTV placeholder', async ({ page }) => {
    await waitForPage(page, '/history');
    const input = getSearchInput(page);
    await input.fill('show');

    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');
  });
});

// ═══════════════════════════════════════════════════════════════
// D. 首页搜索功能（3 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('D. 首页搜索功能', () => {
  test('D1: 首页输入 + 点击搜索按钮 → 导航到 /browse', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);
    await input.fill('复仇者联盟');
    await getSearchButton(page).click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('D2: 首页输入 + 按 Enter → 导航到 /browse', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);
    await input.fill('流浪地球');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/browse/);
  });

  test('D3: 首页搜索框 placeholder 为默认值', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);
    await expect(input).toHaveAttribute('placeholder', '搜索影片、剧集…');
  });
});

// ═══════════════════════════════════════════════════════════════
// E. 注册页面搜索功能（3 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('E. 注册页面搜索功能', () => {
  test('E1: IPTV 输入关键词 → 搜索框值更新', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');
  });

  test('E2: 收藏输入关键词 → 搜索框值更新', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await input.fill('功夫');
    await expect(input).toHaveValue('功夫');
  });

  test('E3: 历史输入关键词 → 搜索框值更新', async ({ page }) => {
    await waitForPage(page, '/history');
    const input = getSearchInput(page);
    await input.fill('速度');
    await expect(input).toHaveValue('速度');
  });
});

// ═══════════════════════════════════════════════════════════════
// F. 切页重置（4 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('F. 切页重置', () => {
  test('F1: IPTV 搜 "CCTV" → 首页 → IPTV', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    // 到首页
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');

    // 回 IPTV
    await waitForPage(page, '/iptv');
    // IPTV 从 useNavStore 恢复搜索词
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');
  });

  test('F2: 收藏搜 "movie" → 首页 → 收藏', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await input.fill('movie');

    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');

    await waitForPage(page, '/collections');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');
  });

  test('F3: 首页 → IPTV → 首页：搜索框始终为空', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);
    await expect(input).toHaveValue('');

    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');

    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
  });

  test('F4: IPTV → 收藏 → 首页', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);

    await waitForPage(page, '/collections');
    await expect(input).toHaveValue('');

    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Placeholder 随页面变化（4 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('G. Placeholder 随页面变化', () => {
  test('G1: 首页 placeholder', async ({ page }) => {
    await waitForPage(page, '/');
    await expect(getSearchInput(page)).toHaveAttribute('placeholder', '搜索影片、剧集…');
  });

  test('G2: IPTV placeholder', async ({ page }) => {
    await waitForPage(page, '/iptv');
    await expect(getSearchInput(page)).toHaveAttribute('placeholder', '搜索频道...');
  });

  test('G3: 收藏（影视 tab）placeholder', async ({ page }) => {
    await waitForPage(page, '/collections');
    await expect(getSearchInput(page)).toHaveAttribute('placeholder', '搜索影视剧...');
  });

  test('G4: 历史（IPTV tab）placeholder', async ({ page }) => {
    await waitForPage(page, '/history');
    await expect(getSearchInput(page)).toHaveAttribute('placeholder', '搜索影视剧...');
  });
});

// ═══════════════════════════════════════════════════════════════
// H. 边界场景（3 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('H. 边界场景', () => {
  test('H1: 收藏页 tab 切换：placeholder 随 tab 变化', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');

    // 切换到 IPTV tab
    await page.click('.category-segmented__item:nth-child(2)');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');
  });

  test('H2: 历史页 tab 切换：placeholder 随 tab 变化', async ({ page }) => {
    await waitForPage(page, '/history');
    const input = getSearchInput(page);
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');

    await page.click('.category-segmented__item:nth-child(2)');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');
  });

  test('H3: IPTV backspace 清空搜索词', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    await input.fill('');
    await expect(input).toHaveValue('');
  });
});

// ═══════════════════════════════════════════════════════════════
// I. 多页面交叉联动搜索（8 个场景）
// ═══════════════════════════════════════════════════════════════

test.describe('I. 多页面交叉联动搜索', () => {
  test('I1: 首页 → IPTV → 首页 交叉搜索', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);

    // 1. 首页输入
    await input.fill('复仇者');
    await expect(input).toHaveValue('复仇者');

    // 2. 导航到 IPTV
    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');

    // 3. IPTV 输入
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    // 4. 导航回首页
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影片、剧集…');

    // 5. 首页输入新词
    await input.fill('流浪地球');
    await expect(input).toHaveValue('流浪地球');

    // 6. 点击搜索 → 导航到 /browse
    await getSearchButton(page).click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('I2: IPTV → 收藏 → 历史 → IPTV 完整循环', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);

    // 1. IPTV 输入
    await input.fill('新闻');
    await expect(input).toHaveValue('新闻');

    // 2. 导航到收藏
    await waitForPage(page, '/collections');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');

    // 3. 收藏输入
    await input.fill('速度');
    await expect(input).toHaveValue('速度');

    // 4. 导航到历史
    await waitForPage(page, '/history');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影视剧...');

    // 5. 历史输入
    await input.fill('激情');
    await expect(input).toHaveValue('激情');

    // 6. 导航回 IPTV
    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');

    // 7. IPTV 输入新词
    await input.fill('体育');
    await expect(input).toHaveValue('体育');
  });

  test('I3: 收藏 tab 切换 + 跨页搜索', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);

    // 1. 收藏影视 tab 输入
    await input.fill('功夫');
    await expect(input).toHaveValue('功夫');

    // 关闭搜索下拉框
    await input.press('Escape');
    await page.waitForTimeout(300);

    // 2. 切换到 IPTV tab
    await page.click('.category-segmented__item:nth-child(2)');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');

    // 3. IPTV tab 输入
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    // 4. 导航到首页
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');

    // 5. 首页输入
    await input.fill('电影');
    await expect(input).toHaveValue('电影');

    // 6. 导航回收藏
    await waitForPage(page, '/collections');
    await expect(input).toHaveValue('');
  });

  test('I4: 历史 tab 切换 + 跨页搜索', async ({ page }) => {
    await waitForPage(page, '/history');
    const input = getSearchInput(page);

    // 1. 历史影视 tab 输入
    await input.fill('速度');
    await expect(input).toHaveValue('速度');

    // 关闭搜索下拉框
    await input.press('Escape');
    await page.waitForTimeout(300);

    // 2. 切换到 IPTV tab
    await page.click('.category-segmented__item:nth-child(2)');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');

    // 3. IPTV tab 输入
    await input.fill('体育');
    await expect(input).toHaveValue('体育');

    // 4. 导航到设置页
    await waitForPage(page, '/settings');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索影片、剧集…');

    // 5. 设置页输入
    await input.fill('设置');
    await expect(input).toHaveValue('设置');

    // 6. 点击搜索 → 导航到 /browse
    await getSearchButton(page).click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('I5: 快速连续导航 + 搜索', async ({ page }) => {
    test.setTimeout(60000); // 快速导航需要更长时间

    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);
    await input.fill('CCTV');

    // 快速连续导航
    await waitForPage(page, '/');
    await waitForPage(page, '/iptv');
    await waitForPage(page, '/collections');
    await waitForPage(page, '/history');
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await page.waitForTimeout(500); // 等待 SearchBox 重新挂载稳定

    // 最终在首页，搜索框应清空
    await expect(input).toHaveValue('');

    // 首页搜索正常工作
    await input.fill('test');
    await expect(input).toHaveValue('test');
    await getSearchButton(page).click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('I6: 搜索后不导航，直接切换页面', async ({ page }) => {
    await waitForPage(page, '/');
    const input = getSearchInput(page);

    // 1. 首页输入（不提交）
    await input.fill('test');
    await expect(input).toHaveValue('test');

    // 2. 导航到 IPTV
    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '搜索频道...');

    // 3. IPTV 输入
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    // 4. 导航回首页
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');

    // 5. 首页输入新词
    await input.fill('新词');
    await expect(input).toHaveValue('新词');

    // 6. 搜索正常工作
    await getSearchButton(page).click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('I7: 收藏/历史页内搜索 + 跨页验证', async ({ page }) => {
    await waitForPage(page, '/collections');
    const input = getSearchInput(page);

    // 1. 收藏影视 tab 输入
    await input.fill('功夫');
    await expect(input).toHaveValue('功夫');

    // 2. 导航到 IPTV
    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');

    // 3. IPTV 输入
    await input.fill('CCTV');
    await expect(input).toHaveValue('CCTV');

    // 4. 导航回收藏
    await waitForPage(page, '/collections');
    await expect(input).toHaveValue('');

    // 5. 收藏输入新词
    await input.fill('新词');
    await expect(input).toHaveValue('新词');
  });

  test('I8: 三页面循环搜索验证', async ({ page }) => {
    await waitForPage(page, '/iptv');
    const input = getSearchInput(page);

    // IPTV 搜索
    await input.fill('A');
    await expect(input).toHaveValue('A');

    // → 收藏
    await waitForPage(page, '/collections');
    await expect(input).toHaveValue('');
    await input.fill('B');
    await expect(input).toHaveValue('B');

    // → 历史
    await waitForPage(page, '/history');
    await expect(input).toHaveValue('');
    await input.fill('C');
    await expect(input).toHaveValue('C');

    // → IPTV
    await waitForPage(page, '/iptv');
    await expect(input).toHaveValue('');
    await input.fill('D');
    await expect(input).toHaveValue('D');

    // → 首页
    await page.click('.sticky-header__logo-group');
    await page.waitForURL('**/');
    await expect(input).toHaveValue('');
  });
});
