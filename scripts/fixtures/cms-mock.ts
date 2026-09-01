/**
 * CMS 视频源 + 本地 HLS 双 Mock Fixture（用于播放页沙箱稳定化）
 *
 * 问题背景：
 *   播放页 /play/:id 在加载 TMDB 视频时，需要经视频代理向 CMS 采集站发
 *   `ac=videolist&wd=<标题>` 搜索请求，解析出 vod_play_url 才能挂载真实播放器
 *   （.up-universal-player 进入非 placeholder 模式，控制栏等 UI 才渲染）。
 *   沙箱环境视频代理 / CMS 源均不可达 → 请求失败 → currentSrc 永远为 null →
 *   播放器停留在 placeholder 分支 → 控制栏断言全部 flaky。
 *
 * 方案：
 *   1. 拦截所有含 `ac=videolist` 的 CMS 搜索请求，返回固定 CMSListResponse，
 *      其 vod_play_url 指向本地 mock 主机 cms-mock.local 上的 HLS 流。
 *      vod_play_url 自带可解析的直链（默认线路$第1集$https://...m3u8），
 *      因此 resolvePlaySources 走「直接解析」分支，不会触发二次 ids= 请求。
 *   2. 拦截 cms-mock.local 的 HLS 请求，从本地 fixtures/hls/stream 目录读取
 *      m3u8 + ts 直接 fulfill，hls.js 可完整初始化并播放，避免错误态。
 *
 * 用法：
 *   import { test, expect } from './fixtures/cms-mock';
 *   // 在 mock-tmdb 的 TMDB 拦截基础上，额外具备 CMS 源 + 本地 HLS 能力。
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test as tmdbTest, expect } from './mock-tmdb';

/** 本地 HLS 片段目录（ESM 下用 import.meta.url 推导） */
const HLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'hls', 'stream');

/** 固定返回的 CMS 搜索结果（电影条目，vod_play_url 指向本地 HLS） */
const CMS_SEARCH_RESPONSE = {
  code: 1,
  msg: 'ok',
  page: 1,
  pagecount: 1,
  limit: 20,
  total: 1,
  list: [
    {
      vod_id: '550',
      vod_name: 'Fight Club',
      vod_type: 'movie',
      type_id: '1',
      type_name: '电影',
      vod_en: 'Fight Club',
      vod_pic: '',
      vod_remarks: 'HD',
      vod_play_url: '默认线路$第1集$https://cms-mock.local/stream/index.m3u8',
    },
  ],
};

/** 读取 HLS 文件并 fulfill */
async function fulfillHls(route: import('@playwright/test').Route) {
  const url = route.request().url();
  const after = url.split('/stream/')[1] || 'index.m3u8';
  const file = path.join(HLS_DIR, after);
  try {
    const buf = fs.readFileSync(file);
    const isM3u8 = after.endsWith('.m3u8');
    await route.fulfill({
      status: 200,
      contentType: isM3u8 ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
      body: buf,
    });
  } catch {
    await route.fulfill({ status: 404, body: 'not found' });
  }
}

/**
 * 判断是否 CMS 搜索请求：可能直接发（ac=videolist），也可能经 CORS 代理包装，
 * 代理把目标地址编码进 url= 参数，ac=videolist 会变成 ac%3Dvideolist。两者都要匹配。
 */
function isCmsSearchRequest(url: URL): boolean {
  const raw = url.toString();
  return raw.includes('ac=videolist') || raw.includes('ac%3Dvideolist');
}

/**
 * 在 mock-tmdb（TMDB 拦截）基础上，叠加 CMS 源搜索 + 本地 HLS 拦截。
 * 收到的 page 已带 TMDB 路由，这里仅追加两条规则。
 */
export const test = tmdbTest.extend({
  page: async ({ page }, use) => {
    // 1) CMS 搜索请求（ac=videolist，可能经代理编码为 ac%3Dvideolist）→ 固定返回可解析的电影条目
    await page.route(isCmsSearchRequest, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CMS_SEARCH_RESPONSE),
      });
    });

    // 2) 本地 mock HLS 流（m3u8 + ts）
    await page.route(/cms-mock\.local/, fulfillHls);

    await use(page);
  },
});

export { expect };
