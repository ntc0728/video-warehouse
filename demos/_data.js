/* KINO demo 共享数据层 —— CMS 真实数据 + 图片链路修复版
 *
 * 图片链路（修复「海报全空」根因）：
 *   根因 = 60+ 张 128KB 原图并发打同一图床主机，HTTP/1.1 每主机 6 连接，
 *   其余全部 pending 挂起 → 页面永远是空块。
 *   修法 = weserv 缩图 CDN（w=480 ≈47KB，全球缓存）+ IO 懒渲染 +
 *          onerror 回退原图 + decoding=async。
 */
(function () {
  'use strict';

  const SOURCES = [
    { name: '豆瓣资源', api: 'https://caiji.dbzy5.com/api.php/provide/vod' },
    { name: '茅台资源', api: 'https://caiji.maotaizy.cc/api.php/provide/vod' },
  ];

  /* ---------- 图片 URL ---------- */
  // 主源：weserv 缩图；onerror 时由 <img> 回退到原图
  window.kinoImg = function (raw, w) {
    if (!raw) return '';
    const bare = raw.replace(/^https?:\/\//, '');
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(bare) + '&w=' + (w || 480) + '&we&output=jpg&q=78';
  };
  window.kinoImgRaw = function (raw) { return raw || ''; };

  /* ---------- fetch JSON（带超时） ---------- */
  function getJSON(url, ms) {
    return new Promise((resolve, reject) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms || 12000);
      fetch(url, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((j) => { clearTimeout(t); resolve(j); })
        .catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  // 顺序尝试多源（避免并发打爆），单源内分类请求做 2 并发小池
  async function trySources(pathMaker) {
    for (const s of SOURCES) {
      try {
        const first = await getJSON(pathMaker(s.api, 1));
        if (!first || first.code !== 1 || !Array.isArray(first.list) || !first.list.length) continue;
        return { src: s, call: (pg, extra) => getJSON(pathMaker(s.api, pg) + (extra || '')) };
      } catch (e) { /* next source */ }
    }
    return null;
  }

  // 小并发池：并发 3，保持输入序
  async function pool(items, worker, concurrency) {
    const out = new Array(items.length);
    let i = 0;
    async function run() {
      while (i < items.length) {
        const idx = i++;
        try { out[idx] = await worker(items[idx], idx); } catch (e) { out[idx] = null; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
    return out;
  }

  function normalize(it, hue) {
    return {
      id: it.vod_id,
      title: (it.vod_name || '').trim(),
      pic: it.vod_pic || '',
      remarks: (it.vod_remarks || '').trim(),
      year: it.vod_year || '',
      cls: (it.vod_class || '').split(',').filter(Boolean).slice(0, 2).join(' · '),
      score: it.vod_score || '',
      content: (it.vod_content || '').replace(/<[^>]+>/g, '').trim().slice(0, 90),
      hue: hue,
    };
  }

  /* ---------- 离线兜底 ---------- */
  function fallbackData() {
    const mk = (n, t, hue, rm) => ({ id: n, title: t, pic: '', remarks: rm || 'HD', year: '2026', cls: '演示', score: (7 + (n % 25) / 10).toFixed(1), content: '离线演示数据——CMS 接口不可达时展示，联网后自动替换为真实收录。', hue: hue });
    const T = ['雾海孤灯', '长夜将尽', '城市折叠术', '春潮', '铁翼苍穹', '雪线之下', '环形公路', '第十三次日出', '暮色巡游', '解药', '北回归线', '玻璃海'];
    let id = 0;
    const gen = (start, cnt) => Array.from({ length: cnt }, (_, i) => mk(id++, T[(start + i) % T.length], (start * 37 + i * 47) % 360));
    return {
      offline: true,
      sourceName: '离线演示',
      featured: gen(1, 1)[0],
      heroSide: gen(2, 4),
      continue_: gen(3, 6),
      rows: [
        { key: 'now', title: '正在热映', en: 'NOW PLAYING', items: gen(4, 10) },
        { key: 'hotmovie', title: '热门电影', en: 'TRENDING FILMS', items: gen(5, 10) },
        { key: 'scoremovie', title: '高分电影', en: 'TOP RATED', items: gen(6, 10) },
        { key: 'soon', title: '即将上映', en: 'COMING SOON', items: gen(7, 10) },
        { key: 'hotseries', title: '热门剧集', en: 'POPULAR SERIES', items: gen(8, 10) },
        { key: 'scoreseries', title: '高分剧集', en: 'CRITICS\' PICKS', items: gen(9, 10) },
        { key: 'today', title: '今日播出', en: 'ON AIR TODAY', items: gen(10, 10) },
      ],
      counts: { movie: 1284, series: 2310, variety: 456, anime: 1024 },
    };
  }

  /* ---------- 主加载 ---------- */
  window.kinoLoad = async function () {
    try {
      // 最新收录（近 168h）
      const latest = await trySources((api, pg) => api + '?ac=videolist&pg=' + pg + '&h=168');
      if (!latest) throw new Error('all sources down');
      const res = await latest.call(1);
      if (!res || res.code !== 1 || !res.list.length) throw new Error('empty');
      const latestItems = res.list.map((it, i) => normalize(it, (i * 53) % 360));

      // 四大分类（t=1电影 2剧集 3综艺 4动漫），并发 2
      const typeNames = { 1: '电影', 2: '剧集', 3: '综艺', 4: '动漫' };
      const typeRes = await pool([1, 2, 3, 4], async (t) => {
        const j = await latest.call(1, '&t=' + t);
        return [t, j && j.code === 1 ? j.total : 0, (j && Array.isArray(j.list) ? j.list : []).slice(0, 12).map((it, i) => normalize(it, (t * 61 + i * 43) % 360))];
      }, 2);

      const counts = {};
      const pools = {};
      typeRes.forEach((r) => { if (r) { counts[r[0]] = r[1]; pools[r[0]] = r[2]; } });

      // 组装 7 行（与现有首页同标题），从分类池 + 最新池取材，按标题去重
      const uniq = (arr) => { const s = new Set(); return arr.filter((x) => x.title && !s.has(x.title) && s.add(x.title)); };
      const cut = (arr, n) => arr.slice(0, n);
      const L = latestItems;
      const rows = [
        { key: 'now', title: '正在热映', en: 'NOW PLAYING', items: cut(uniq([...(pools[1] || []), ...L]), 12) },
        { key: 'hotmovie', title: '热门电影', en: 'TRENDING FILMS', items: cut(uniq([...(pools[1] || [])].reverse().concat(L)), 12) },
        { key: 'scoremovie', title: '高分电影', en: 'TOP RATED', items: cut(uniq([...(pools[1] || [])].sort((a, b) => (+b.score || 0) - (+a.score || 0))), 12) },
        { key: 'soon', title: '即将上映', en: 'COMING SOON', items: cut(uniq([...L].reverse().concat(pools[1] || [])), 12) },
        { key: 'hotseries', title: '热门剧集', en: 'POPULAR SERIES', items: cut(uniq([...(pools[2] || []), ...(pools[4] || []), ...L]), 12) },
        { key: 'scoreseries', title: '高分剧集', en: 'CRITICS\' PICKS', items: cut(uniq([...(pools[2] || [])].sort((a, b) => (+b.score || 0) - (+a.score || 0))), 12) },
        { key: 'today', title: '今日播出', en: 'ON AIR TODAY', items: cut(L, 12) },
      ].map((r, ri) => ({ ...r, items: r.items.length ? r.items : latestItems.slice(ri, ri + 6) }));

      return {
        offline: false,
        sourceName: latest.src.name,
        featured: latestItems[0],
        heroSide: latestItems.slice(1, 5),
        continue_: latestItems.slice(0, 6),
        rows,
        counts: { movie: counts[1] || 0, series: counts[2] || 0, variety: counts[3] || 0, anime: counts[4] || 0 },
      };
    } catch (e) {
      return fallbackData();
    }
  };

  /* ---------- 懒渲染图片（IO 驱动，根治并发挂起） ---------- */
  const io = new IntersectionObserver((es) => {
    es.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      const raw = el.getAttribute('data-raw');
      const w = el.getAttribute('data-w') || 480;
      if (!raw) { el.classList.add('is-empty'); return; }
      const img = document.createElement('img');
      img.decoding = 'async';
      img.loading = 'eager';
      img.alt = el.getAttribute('data-alt') || '';
      img.onload = () => { clearTimeout(img._t); el.classList.add('is-loaded'); };
      img.onerror = () => {
        clearTimeout(img._t);
        // weserv 失败 → 回退原图一次
        if (img.src.indexOf('weserv') > -1 && raw.startsWith('http')) { img.src = raw; armRawTimeout(); }
        else el.classList.add('is-broken');
      };
      // 超时自愈：weserv 偶发排队 >8s → 直接换原图
      let fell = false;
      function armRawTimeout() {
        clearTimeout(img._t);
        img._t = setTimeout(() => {
          if (img.complete) return;
          if (!fell && raw.startsWith('http')) { fell = true; img.src = raw; }
          else el.classList.add('is-broken');
        }, 8000);
      }
      armRawTimeout();
      img.src = window.kinoImg(raw, w);
      el.appendChild(img);
    });
  }, { rootMargin: '300px 400px' });

  // 用法：任意 <div data-raw="..." data-alt="..." data-w="480"> 容器（.kpic/.cpic 等类名不限）
  window.kinoBindPics = function (root) {
    (root || document).querySelectorAll('[data-raw]:not([data-bound])').forEach((el) => {
      el.setAttribute('data-bound', '1');
      io.observe(el);
    });
  };
})();
