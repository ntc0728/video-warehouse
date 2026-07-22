// 用真实地址验证 IPTV 代理链路：抓取 [IPTV 代理调试] 日志 + 校验 nmz996 返回的是否为有效 m3u8
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3001';
const PROXY = 'https://iptv.nmz996.cc.cd';

// 真实频道源（来自用户提供的三层代理链，最内层是 mgtv 源站）
const CHANNEL_URL =
  'https://gh-proxy.com/m3u8-proxy?url=' +
  encodeURIComponent(
    'http://hlsal-ldvt.qing.mgtv.com/nn_live/nn_x64/Y2RuZXhfaWQ9YWxfaGxzX2xkdnQmZT02OTE0NjA0JnY9MSZpZD1ITldTWkdTVCZzPTcwN2RiYTc2YzJjNmJmMTQ4MmUyZGYzOWU2NWM3YWFi/HNWSZGST.m3u8'
  );

// 复刻 IPTVChannelCard 的深链构造：playUrl 先走 buildProxyUrl(nmz996) 再双重编码
function buildDeepLink(playUrl, id, name) {
  const params = new URLSearchParams({
    url: encodeURIComponent(playUrl),
    id,
    name,
  });
  return `/iptv/play?${params.toString()}`;
}

function validateM3U8(body) {
  if (!body) return { valid: false, reason: '空响应' };
  const head = body.slice(0, 2000);
  const trimmed = head.trimStart();
  const isExt = trimmed.startsWith('#EXTM3U');
  const hasInf = head.includes('#EXTINF') || head.includes('#EXT-X-STREAM-INF');
  const hasSeg =
    /\.ts(\?|$)/.test(head) || /\.m3u8(\?|$)/.test(head) || /#EXT-X-BYTERANGE/.test(head);
  return {
    valid: isExt,
    isExtM3U: isExt,
    hasPlaylistTags: hasInf || hasSeg,
    length: body.length,
    preview: trimmed.slice(0, 400),
  };
}

const consoleLogs = [];
const nmzResponses = [];

async function runOne(page, label, deepLink) {
  console.log(`\n========== ${label} ==========`);
  console.log(`深链: ${BASE}${deepLink.slice(0, 120)}...`);
  const before = nmzResponses.length;
  await page.goto(`${BASE}${deepLink}`, { waitUntil: 'domcontentloaded' });
  // 等待 hls.js 发起请求并解析
  await page.waitForTimeout(20000);
  const newResp = nmzResponses.slice(before);
  console.log(`\n--- [IPTV 代理调试] 日志 (${label}) ---`);
  const dbg = consoleLogs.filter((l) => l.includes('[IPTV 代理调试]'));
  if (dbg.length === 0) console.log('(无)');
  dbg.forEach((l) => console.log(l));
  console.log(`\n--- hls.js / 播放相关日志 (${label}) ---`);
  const hls = consoleLogs.filter((l) => /hls\.js|manifest|Media|error|Error/i.test(l));
  hls.slice(0, 30).forEach((l) => console.log(l));
  console.log(`\n--- nmz996 响应 (${label}): ${newResp.length} 条 ---`);
  for (const r of newResp) {
    console.log(`\n[${r.status}] ${r.contentType}\n${r.url.slice(0, 140)}`);
    const v = validateM3U8(r.body);
    console.log(`m3u8 校验:`, JSON.stringify(v, null, 2));
  }
  if (newResp.length === 0) console.log('(未捕获到 nmz996 的网络响应)');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // 在应用读取前注入 IPTV 设置：proxyUrl = nmz996（复刻设置页填写的自定义流代理）
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'iptv-store',
        JSON.stringify({
          state: { settings: { proxyUrl: 'https://iptv.nmz996.cc.cd', proxyPattern: '' } },
          version: 0,
        })
      );
    } catch (e) {
      console.log('seed localStorage failed:', e.message);
    }
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const t = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(t);
  });
  page.on('pageerror', (err) => consoleLogs.push(`[pageerror] ${err.message}`));
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('iptv.nmz996.cc.cd')) {
      let body = '';
      try {
        body = await resp.text();
      } catch {
        body = '(读取响应体失败)';
      }
      nmzResponses.push({
        url,
        status: resp.status(),
        contentType: resp.headers()['content-type'] || '',
        body,
      });
    }
  });

  // 测试 A：直接把 gh-proxy 预代理的频道地址作为深链 —— 验证修复后会被 nmz996 重包
  await runOne(
    page,
    'A: 原始频道地址(gh-proxy 预代理) → 期望被 nmz996 重包',
    buildDeepLink(CHANNEL_URL, '0-channel-22', '湖南卫视')
  );

  // 测试 B：点击频道后实际生成的深链（已是 nmz996 外层）—— 验证无双重代理 + nmz996 可播放
  const playUrlB = `${PROXY}/m3u8-proxy?url=${encodeURIComponent(CHANNEL_URL)}`;
  await runOne(
    page,
    'B: 修复后点击生成的深链(nmz996 外层) → 期望无双重代理且可播放',
    buildDeepLink(playUrlB, '0-channel-22', '湖南卫视')
  );

  await browser.close();
  console.log('\n===== 验证结束 =====');
})().catch((e) => {
  console.error('脚本异常:', e);
  process.exit(1);
});
