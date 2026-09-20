/**
 * E2E 测试环境共享常量与公网 mock 载荷（单一事实源）
 *
 * 背景：global-setup 往 storageState 注入的是**真实内置源**（IPTV 大 m3u 数 MB、
 * EPG 站点、CMS 采集站），测试跑起来要么依赖公网（慢、flaky），要么在无外网时
 * 每条请求挂满超时（卡死根因之一）。本模块被 global-setup 与 mock-tmdb fixture
 * 共同引用：
 *   - global-setup 用它确定注入哪些源下标；
 *   - fixture 据此为这些源的主机生成确定性 mock（小 m3u / 空 EPG），
 *     保证「频道卡片有数据可渲染」的同时永不真正出网。
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

loadDotenv({ path: resolve(ROOT, '.env.local') });

/**
 * 用户在 .env.local 配置的 CORS/IPTV 代理主机：守卫放行白名单。
 * 这些是「测试期望可达」的正规数据通道（home CMS 数据、IPTV 源拉取都经它），
 * 守卫只拦"绕开代理乱打公网"的逃逸请求，不能把配置内通道掐死。
 */
export function getProxyAllowedHostnames(): string[] {
  const hosts: string[] = [];
  for (const key of ['CORS_PROXY', 'IPTV_PROXY']) {
    const v = process.env[key];
    if (!v) continue;
    try {
      hosts.push(new URL(v).hostname);
    } catch {
      /* 非法值忽略 */
    }
  }
  return hosts;
}

// video-sources.json 下标：0=爱奇艺 1=豆瓣 6=猫眼 11=非凡 21=光速
export const VIDEO_SOURCE_INDICES = [0, 1, 6, 11, 21];

// iptv-sources.json 下标：0=IPTV(GitHub) 2=猫影视TV 7=风云TV4
export const IPTV_SOURCE_INDICES = [0, 2, 7];

/** 取出注入的 IPTV 源 URL（与 global-setup 同源） */
export function getMockedIptvSourceUrls(): string[] {
  const json = JSON.parse(
    readFileSync(resolve(ROOT, 'public/data/iptv-sources.json'), 'utf8'),
  ) as { name: string; url: string }[];
  return IPTV_SOURCE_INDICES.map((i) => json[i].url);
}

/** 内置 EPG 地址主机（global-setup 的 epgUrls 注入值） */
export const EPG_HOSTS = ['epg.51zmt.top'];

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 确定性小播放列表：3 频道、无 tvg-logo（台标链路交给各测试自己的 EPG/台标库 mock） */
export const MOCK_IPTV_PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 group-title="央视",CCTV-1 综合',
  'http://127.0.0.1:1/live/cctv1.m3u8',
  '#EXTINF:-1 group-title="卫视",湖南卫视',
  'http://127.0.0.1:1/live/hunan.m3u8',
  '#EXTINF:-1 group-title="其他",TV8',
  'http://127.0.0.1:1/live/tv8.m3u8',
  '',
].join('\n');

/**
 * iptv-org 主干 mock（cn.m3u 形态，tvg-id 走 org 命名）。
 * IPTV 页默认主干即此源（src/services/iptvOrgService.ts:28），旧方案每轮测试
 * 真拉 cn.m3u + channels.json(gzip 0.98MB)，慢且 flaky；这里用确定性列表替代。
 * 40 条保证网格超视口高度（懒加载/返回顶部等滚动用例依赖长列表）。
 * group-title 必须用 iptvOrgService CATEGORY_ZH 的真实英文键（news/sports/movies…），
 * 未知键会原样透传英文拉长一级栏宽，破坏「按内容定宽」类像素契约（IPTVP-023）。
 * 前三条对齐 iptv.spec 5.10 台标链的桩数据（id + tvg-logo 指向 fanmingming/wanglindl，
 * 与真实 cn.m3u「台标内联、logos.json 已退役」形态一致），否则该功能用例在
 * hermetic 环境下被条件跳过掏空（2026-09-20 取舍纠偏）。
 */
export const MOCK_ORG_PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="CCTV-1" tvg-logo="https://live.fanmingming.cn/tv/CCTV1.png" group-title="general",CCTV-1 综合',
  'http://127.0.0.1:1/live/cctv1.m3u8',
  '#EXTINF:-1 tvg-id="CCTV-13" group-title="news",CCTV-13 新闻',
  'http://127.0.0.1:1/live/cctv13.m3u8',
  '#EXTINF:-1 tvg-id="hunantv" tvg-logo="https://raw.githubusercontent.com/wanglindl/TVlogo/main/img/hunantv.png" group-title="general",湖南卫视',
  'http://127.0.0.1:1/live/hunan.m3u8',
  ...Array.from({ length: 37 }, (_, i) => {
    const n = i + 4;
    const [group, name] =
      n <= 10
        ? ['general', `CCTV-${n} 综合`]
        : n <= 16
          ? ['news', `新闻频道 ${n - 10}`]
          : n <= 22
            ? ['sports', `体育频道 ${n - 16}`]
            : n <= 30
              ? ['movies', `电影频道 ${n - 22}`]
              : n <= 37
                ? ['series', `电视剧频道 ${n - 30}`]
                : ['kids', `少儿频道 ${n - 37}`];
    return `#EXTINF:-1 tvg-id="CH${n}.cn" group-title="${group}",${name}\nhttp://127.0.0.1:1/live/ch${n}.m3u8`;
  }),
  '',
].join('\n');

/** 空 EPG（合法 XMLTV、0 节目）：应用优雅降级，而不是挂在数 MB 的公网 xml 上 */
export const MOCK_EPG_XML = '<?xml version="1.0" encoding="UTF-8"?><tv></tv>';

export interface NetworkMockRule {
  pattern: RegExp;
  respond: (url: string) => { contentType: string; body: string };
  /**
   * 模拟网络时延（ms）。必需：mock 瞬时返回会让「加载中」形态一闪而过
   * （regression 细节修复B 等断言骨架可见窗口的用例直接错过），也让网速类
   * 探测瞬间完成。真实世界没有 0ms 响应，留一小段延迟反而更接近原行为。
   */
  delayMs?: number;
}

/**
 * 为「storageState 注入的真实源主机 + iptv-org 主干 + 测速探测点」生成确定性 mock 规则。
 * 正则不锚定位置：同时覆盖直连请求与经代理转发的形态（url 被 encodeURIComponent 后
 * `raw.githubusercontent.com%2F...` 中主机名仍是明文子串）。
 */
export function buildNetworkMockRules(): NetworkMockRule[] {
  const rules: NetworkMockRule[] = [];
  for (const url of getMockedIptvSourceUrls()) {
    try {
      const pattern = new RegExp(escapeRegExp(new URL(url).hostname));
      rules.push({ pattern, delayMs: 600, respond: () => ({ contentType: 'application/vnd.apple.mpegurl', body: MOCK_IPTV_PLAYLIST }) });
    } catch {
      /* 非法 URL 忽略 */
    }
  }
  for (const h of EPG_HOSTS) {
    rules.push({
      pattern: new RegExp(escapeRegExp(h)),
      delayMs: 600,
      respond: () => ({ contentType: 'application/xml', body: MOCK_EPG_XML }),
    });
  }
  // iptv-org：/api/*.json 返回空数组，其余（cn.m3u 形态）返回小播放列表
  rules.push({
    pattern: /iptv-org\.github\.io/,
    delayMs: 600,
    respond: (url) =>
      url.includes('/api/')
        ? { contentType: 'application/json', body: '[]' }
        : { contentType: 'application/vnd.apple.mpegurl', body: MOCK_ORG_PLAYLIST },
  });
  // 网速检测探测点（src/pages/SourceChecker/index.tsx:74 SPEED_TEST_URLS）：
  // 守卫 abort 会让「检测中」状态毫秒内消失、CHK-001 观测不到；给 1.5s 时延 +
  // 明确 content-length，检测中状态可观测、带宽数字确定。
  rules.push({
    pattern: /(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/,
    delayMs: 1500,
    respond: () => ({ contentType: 'application/javascript', body: MOCK_SPEED_PROBE }),
  });
  // 「明确无结果」关键词（BROWSE-013 的 zzzxxxnotexist12345）：智能检索 TMDB 空结果后
  // 应用回退 CMS 聚合（走真实代理，并发下 >12s 拖垮用例）。该关键词本就是「无结果」
  // 契约专用桩 → 对含它的任何 URL（TMDB 直连 / 代理包裹的 CMS）统一返回空结果超集 JSON。
  rules.push({
    pattern: /zzzxxxnotexist/i,
    delayMs: 0,
    respond: () => ({
      contentType: 'application/json',
      body: '{"code":1,"msg":"ok","page":1,"limit":20,"total":1,"list":[],"results":[],"total_pages":1,"total_results":0}',
    }),
  });
  return rules;
}

/** 测速探针载荷（body 长度即 content-length，1200KB → 带宽数字稳定可预期） */
export const MOCK_SPEED_PROBE = 'x'.repeat(1200 * 1024);
