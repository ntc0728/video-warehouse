/**
 * PLAYER 源不可用自动故障转移 E2E
 *
 * 验证 VOD 自动故障转移（同源切下一线路 → 跨源重搜）确实生效：
 * 注入一个「双线路电影」，首线路指向不可达主机（必然失败），
 * 次线路指向本地可播放 mock HLS。播放器应在首线路致命错误后自动切到次线路并恢复。
 *
 * 这是「源不可用自愈」方案的核心回归用例：一旦有人把错误出口改回「只弹错不转移」，
 * 本例会直接失败。
 */
import { test, expect, setCmsSearchResponse } from './fixtures/cms-mock';

const TEST_MOVIE_ID = 'tmdb-movie-550';

test.describe('PLAYER 源不可用自动故障转移', () => {
  test('PLAYER-094: 首线路死亡 → 自动切到次线路恢复播放', async ({ page }) => {
    // 双线路电影：线路1 必然失败，线路2 可播放
    setCmsSearchResponse({
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
          vod_play_url:
            '线路1$第1集$https://dead-source.local/dead.m3u8$$$线路2$第1集$https://cms-mock.local/stream/index.m3u8',
        },
      ],
    });

    // 首线路主机：直接 403（模拟 CDN 临时目录实效 / 防盗链拒绝）
    await page.route(/dead-source\.local/, (route) =>
      route.fulfill({
        status: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'forbidden',
      }),
    );

    const seen: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.includes('dead-source.local') || u.includes('cms-mock.local/stream')) seen.push(u);
    });

    await page.goto(`/play/${TEST_MOVIE_ID}`);

    // 等待故障转移完成：活线路（次线路）被请求，即证明播放器在首线路致命失败后
    // 自动切到了次线路。这一步是真正的「等待」，不能提前结束测试。
    await expect
      .poll(() => seen.some((u) => u.includes('cms-mock.local/stream')), {
        timeout: 30000,
        message: '应自动切到次线路并请求活 HLS（故障转移生效）',
      })
      .toBeTruthy();

    // 故障转移发生在「首线路失败」之后，因此活线路被请求时，死线路必然已被请求过
    expect(
      seen.some((u) => u.includes('dead-source.local')),
      `应请求过死亡的首线路。seen=${JSON.stringify(seen)}`,
    ).toBeTruthy();

    // 错误覆盖层最终应被清除（转移成功后播放恢复，不会有「源不可用」常驻）
    await expect(page.locator('.up-player-error')).toHaveCount(0, { timeout: 5000 });
  });
});
