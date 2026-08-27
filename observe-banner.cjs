const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('1. 导航到目标站点...');
  await page.goto('https://tv.ouonnki.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'C:/Users/13438/AppData/Local/Temp/opencode/banner-01-initial.png' });
  console.log('截图1: 初始状态');

  // 检查所有大尺寸容器
  const candidates = await page.evaluate(() => {
    const results = [];
    const selectors = [
      '[class*="banner"]', '[class*="Banner"]',
      '[class*="swiper"]', '[class*="Swiper"]',
      '[class*="hero"]', '[class*="Hero"]',
      '[class*="slide"]', '[class*="Slide"]',
      '[class*="carousel"]', '[class*="Carousel"]',
      '[class*="slider"]', '[class*="Slider"]',
      'section', 'main',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetWidth > 600) {
          results.push({
            tag: el.tagName,
            className: el.className?.toString?.().substring(0, 300),
            childCount: el.children.length,
            width: el.offsetWidth,
            height: el.offsetHeight,
          });
        }
      }
    }
    return results;
  });
  console.log('\n2. 大尺寸容器候选:');
  for (const c of candidates) {
    console.log(`  <${c.tag}> .${c.className.substring(0, 120)} (${c.width}x${c.height}, ${c.childCount} children)`);
  }

  // 找 banner 结构
  const bannerInfo = await page.evaluate(() => {
    const els = document.querySelectorAll('section, [class*="hero"], [class*="banner"], [class*="Banner"], [class*="Hero"]');
    const results = [];
    for (const el of els) {
      if (el.offsetWidth > 600 && el.offsetHeight > 200) {
        results.push({
          tag: el.tagName,
          className: el.className?.toString?.().substring(0, 300),
          innerHTML: el.innerHTML.substring(0, 2000),
        });
      }
    }
    return results;
  });
  console.log('\n3. Banner 结构:');
  for (const b of bannerInfo) {
    console.log(`\n  <${b.tag}> class="${b.className.substring(0, 150)}"`);
    console.log(`  内容: ${b.innerHTML.substring(0, 1500)}`);
  }

  // 等待自动轮播
  console.log('\n4. 等待自动轮播（10秒）...');
  const t1 = await page.evaluate(() => {
    const el = document.querySelector('[class*="banner"], [class*="hero"], [class*="swiper"], section');
    if (!el) return null;
    return {
      className: el.className?.toString?.().substring(0, 200),
      textContent: el.textContent?.substring(0, 500),
    };
  });
  console.log('  轮播前:', t1?.textContent?.substring(0, 200));

  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'C:/Users/13438/AppData/Local/Temp/opencode/banner-02-after-autoplay.png' });
  console.log('截图2: 自动轮播后');

  const t2 = await page.evaluate(() => {
    const el = document.querySelector('[class*="banner"], [class*="hero"], [class*="swiper"], section');
    if (!el) return null;
    return {
      textContent: el.textContent?.substring(0, 500),
    };
  });
  console.log('  轮播后:', t2?.textContent?.substring(0, 200));

  await browser.close();
  console.log('\n完成。');
})();
