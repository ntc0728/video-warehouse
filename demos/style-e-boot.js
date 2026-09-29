/* ============================================================
   Demo E · 报刊排版式 —— 共享启动层（除首页外的全站页面通用）
   ------------------------------------------------------------
   提供：报头 / 导航 / 搜索 / 主题 / FAB / 页脚 / 数据组装 / 图片绑定 / 收藏。
   依赖（按序引入）：_data.js（kinoLoad + kinoBindPics）、_data-e-tmdb.js（TMDB 快照）。
   用法：页面脚本末尾调用 KINO_E.boot({ key:'browse', title:'浏览 · 报刊版' })，
        boot 返回 Promise<DATA>；页面拿到数据后自行渲染主体。
   ------------------------------------------------------------
   数据口径与首页 Demo E 完全一致：TMDB 快照优先（真实标题/海报/评分/年份/类型），
   快照缺失时回退 _data.js 的 CMS kinoLoad（含离线兜底）。
   进度 / 热度 / 收藏种子 / 频道与 EPG / 检测延迟 等无真实来源的量 = 演示值，
   均在界面上标明「演示值」，不与真实数据混淆。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 页面导航（demo 索引，页间可互跳） ---------- */
  var PAGES = [
    { key: 'home', label: '首页', href: 'home-style-e-typographic.html' },
    { key: 'browse', label: '浏览', href: 'e-browse.html' },
    { key: 'chart', label: '榜单', href: 'e-chart.html' },
    { key: 'detail', label: '详情', href: 'e-detail.html' },
    { key: 'person', label: '人物', href: 'e-person.html' },
    { key: 'player', label: '播放', href: 'e-player.html' },
    { key: 'iptv', label: 'IPTV', href: 'e-iptv.html' },
    { key: 'collections', label: '收藏', href: 'e-collections.html' },
    { key: 'history', label: '历史', href: 'e-history.html' },
    { key: 'settings', label: '设置', href: 'e-settings.html' },
  ];

  /* ---------- 工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function uniq(arr) { var s = new Set(); return arr.filter(function (x) { return x && x.id && !s.has(x.id) && s.add(x.id); }); }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; } return Math.abs(h); }
  /** 确定性伪随机（同一 seed 稳定，刷新不变 → 演示值不跳） */
  function seeded(seed, i) { return ((hash(String(seed) + '#' + i) % 1000) / 1000); }

  /* ---------- 收藏（localStorage，跨 demo 共享） ---------- */
  var FAVS = new Set();
  try { (JSON.parse(localStorage.getItem('kino-demo-favs') || '[]') || []).forEach(function (x) { FAVS.add(String(x)); }); } catch (e) { /* ignore */ }
  function favSave() { try { localStorage.setItem('kino-demo-favs', JSON.stringify(Array.from(FAVS))); } catch (e) { /* ignore */ } }
  function isFav(id) { return FAVS.has(String(id)); }
  function toggleFav(id) { if (FAVS.has(String(id))) FAVS.delete(String(id)); else FAVS.add(String(id)); favSave(); return isFav(id); }

  /* ---------- 图片容器（_data.js 的 IO 懒渲染；缺失时内置兜底） ---------- */
  var io = null;
  function bindPics(root) {
    if (window.kinoBindPics) { window.kinoBindPics(root || document); return; }
    if (!io) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target; io.unobserve(el);
          var raw = el.getAttribute('data-raw'); if (!raw) { el.classList.add('is-empty'); return; }
          var img = document.createElement('img');
          img.decoding = 'async'; img.alt = el.getAttribute('data-alt') || '';
          img.onload = function () { el.classList.add('is-loaded'); };
          img.onerror = function () { el.classList.add('is-broken'); };
          img.src = raw; el.appendChild(img);
        });
      }, { rootMargin: '300px 400px' });
    }
    (root || document).querySelectorAll('[data-raw]:not([data-bound])').forEach(function (el) {
      el.setAttribute('data-bound', '1'); io.observe(el);
    });
  }
  /** 图片容器 HTML：inner 可塞角标 */
  function pic(item, w, inner) {
    return '<div class="kpic" data-raw="' + esc(item.pic || item.backdrop || '') + '" data-w="' + (w || 480) +
      '" data-alt="' + esc(item.title) + '">' + (inner || '') + '</div>';
  }

  /* ---------- 类型名（快照 genres 真实口径） ---------- */
  var GENRES = (window.KINO_E_TMDB && window.KINO_E_TMDB.genres) || { movie: {}, tv: {} };
  function genreName(item) {
    var g = (item.mediaType === 'tv' ? GENRES.tv : GENRES.movie) || {};
    var ids = item.genreIds || [];
    return g[ids[0]] || (item.mediaType === 'tv' ? '剧集' : '电影');
  }

  /* ---------- 数据组装（与首页 Demo E 同口径） ---------- */
  var ROW_ORDER = ['nowPlaying', 'popularMovies', 'topRatedMovies', 'upcomingMovies', 'popularTv', 'topRatedTv', 'airingTodayTv'];
  var ROW_EN = {
    nowPlaying: 'NOW PLAYING', popularMovies: 'TRENDING FILMS', topRatedMovies: 'TOP RATED',
    upcomingMovies: 'COMING SOON', popularTv: 'POPULAR SERIES', topRatedTv: 'CRITICS’ PICKS', airingTodayTv: 'ON AIR TODAY',
  };
  var DATA = null;

  function assemble(S) {
    var fix = function (x) {
      var o = {}; for (var k in x) o[k] = x[k];
      o.cls = genreName(x);
      return o;
    };
    var used = new Set();
    var rows = ROW_ORDER.map(function (k) {
      return {
        key: k, en: ROW_EN[k],
        title: (S.rowTitles || {})[k] || k,
        items: (S.rows[k] || []).map(fix).filter(function (x) { if (used.has(x.id)) return false; used.add(x.id); return true; }),
      };
    });
    var trending = (S.trending || []).map(fix);
    return {
      offline: false, tmdb: true, snapDate: S.snapDate,
      sourceName: 'TMDB 快照 ' + S.snapDate,
      trending: trending, rows: rows, counts: null, genres: GENRES,
    };
  }

  function cmsFallback() {
    return window.kinoLoad().then(function (d) {
      return {
        offline: !!d.offline, tmdb: false, snapDate: null, sourceName: d.sourceName,
        trending: (d.rows && d.rows[0] ? d.rows[0].items : []).slice(0, 20),
        rows: d.rows || [], counts: d.counts || null, genres: { movie: {}, tv: {} },
      };
    }).catch(function () {
      return { offline: true, tmdb: false, sourceName: '离线', trending: [], rows: [], counts: {}, genres: { movie: {}, tv: {} } };
    });
  }

  /** 全站条目池（去重）：rows + trending */
  function allItems() {
    if (!DATA) return [];
    return uniq([].concat(DATA.trending || [], (DATA.rows || []).reduce(function (a, r) { return a.concat(r.items || []); }, [])));
  }
  function movies() { return allItems().filter(function (x) { return x.mediaType !== 'tv'; }); }
  function tvItems() { return allItems().filter(function (x) { return x.mediaType === 'tv'; }); }
  function byKey(k) { var r = (DATA.rows || []).filter(function (x) { return x.key === k; })[0]; return r ? r.items : []; }
  /** 确定性取样：n 条，seed 稳定 */
  function pick(list, n, seed) {
    var out = [], seen = new Set(), i = 0, guard = 0;
    while (out.length < n && guard++ < list.length * 4) {
      var idx = Math.floor(seeded(seed, i++) * list.length);
      var it = list[idx];
      if (!it || seen.has(it.id)) continue;
      seen.add(it.id); out.push(it);
    }
    return out;
  }

  /* ---------- 轻量页眉 / 页脚（内页不复用首页大报头） ---------- */
  function renderChrome(cur, title) {
    var tp = $('#tb-page');
    if (tp) {
      var pg = PAGES.filter(function (x) { return x.key === cur; })[0];
      tp.textContent = title || (pg ? pg.label : '');
      tp.title = tp.textContent;
    }
    var ft = $('#foot-stats');
    if (ft) {
      ft.textContent = DATA && DATA.tmdb
        ? '快照 ' + DATA.snapDate + ' · 收录 ' + allItems().length + ' 条（真实 TMDB）'
        : (DATA && DATA.counts ? '收录 ' + Object.keys(DATA.counts).length + ' 类' : '');
    }
    var f = document.querySelector('footer .foot-links');
    if (f) f.innerHTML = '<a href="home-style-e-typographic.html">返回首页 →</a>';
    renderTabBar(cur);
  }

  /* 移动端底部 TabBar（对齐 Layout/TabBar.tsx：首页 / IPTV / 收藏 / 历史 / 设置，仅 ≤767 显示） */
  var TABBAR = [
    { key: 'home', label: '首页', icon: '⌂', href: 'home-style-e-typographic.html' },
    { key: 'iptv', label: 'IPTV', icon: '📺', href: 'e-iptv.html' },
    { key: 'collections', label: '收藏', icon: '★', href: 'e-collections.html' },
    { key: 'history', label: '历史', icon: '◷', href: 'e-history.html' },
    { key: 'settings', label: '设置', icon: '⚙', href: 'e-settings.html' },
  ];
  function renderTabBar(cur) {
    if (document.querySelector('.mtabbar')) return;           // 已渲染（页面自带或已插入）
    var bar = document.createElement('nav');
    bar.className = 'mtabbar';
    bar.setAttribute('aria-label', '底部导航');
    bar.innerHTML = TABBAR.map(function (t) {
      return '<a class="' + (t.key === cur ? 'on' : '') + '" href="' + t.href + '">' +
        '<span class="ic">' + t.icon + '</span><span>' + t.label + '</span></a>';
    }).join('');
    document.body.appendChild(bar);
  }

  function initTheme() {
    var b = $('#theme-btn'); if (!b) return;
    /* 三态循环（对齐真实 StickyHeader handleThemeToggle）：浅色 → 深色 → 跟随系统；
       模式存 kino-demo-theme-mode，data-theme 只存解析结果（day/night，CSS 消费）。 */
    var MODES = ['light', 'dark', 'system'];
    var ICON = { light: '☀', dark: '☾', system: '◐' };
    var LABEL = { light: '浅色', dark: '深色', system: '跟随系统' };
    function mode() { try { return localStorage.getItem('kino-demo-theme-mode') || 'light'; } catch (e) { return 'light'; } }
    function apply(m) {
      var night = m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', night ? 'night' : 'day');
      b.textContent = ICON[m] || '☀';
      b.title = '当前主题：' + (LABEL[m] || m) + '，点击切换';
      b.setAttribute('aria-label', b.title);
    }
    function sync() { apply(mode()); }
    sync();
    b.addEventListener('click', function () {
      var next = MODES[(MODES.indexOf(mode()) + 1) % MODES.length];
      try { localStorage.setItem('kino-demo-theme-mode', next); } catch (e) { /* ignore */ }
      sync();
    });
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSys = function () { if (mode() === 'system') sync(); };
    if (mq.addEventListener) mq.addEventListener('change', onSys);
    else if (mq.addListener) mq.addListener(onSys);
  }

  function initFab() {
    var top = $('#fab-top'), ref = $('#fab-refresh');
    if (top) top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if (ref) ref.addEventListener('click', function () {
      ref.classList.add('spinning');
      setTimeout(function () { ref.classList.remove('spinning'); }, 700);
      location.reload();
    });
    /* 与首页同口径：滚过 280px 立即显示，回到页首立即隐藏（无停止滚动延迟） */
    var fab = document.querySelector('.fab');
    if (fab) {
      var syncFab = function () {
        var y = window.scrollY || document.documentElement.scrollTop;
        fab.classList.toggle('on', y > 280);
      };
      window.addEventListener('scroll', syncFab, { passive: true });
      syncFab();
    }
  }

  function initSearch() {
    var wrap = $('#search-wrap'), btn = $('#search-btn'), form = $('#search-form'),
      input = $('#search-input'), drop = $('#search-drop'), close = $('#search-close'),
      navFn = $('#nav-fn') || $('#tb-links');
    if (!wrap) return;
    function open() {
      form.hidden = false; navFn.classList.add('searching');
      requestAnimationFrame(function () { wrap.classList.add('open'); input.focus(); });
    }
    function shut() {
      wrap.classList.remove('open'); navFn.classList.remove('searching');
      setTimeout(function () { form.hidden = true; drop.hidden = true; }, 340);
    }
    btn.addEventListener('click', open);
    close.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
      if (e.key === 'Escape' && wrap.classList.contains('open')) shut();
    });
    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (!q) { drop.hidden = true; return; }
      var hit = allItems().filter(function (x) { return (x.title || '').indexOf(q) >= 0; }).slice(0, 8);
      drop.innerHTML = hit.length ? hit.map(function (x) {
        return '<div class="sd-item" data-id="' + esc(x.id) + '">' +
          '<span class="sd-pic">' + pic(x, 200) + '</span>' +
          '<span class="sd-t"><b>' + esc(x.title) + '</b><span>' + esc(x.year || '') + ' · ' + esc(x.cls || '') + ' · ★' + (x.score ? (+x.score).toFixed(1) : '—') + '</span></span></div>';
      }).join('') : '<div class="empty">未找到「' + esc(q) + '」相关条目</div>';
      drop.hidden = false;
      bindPics(drop);
    });
    drop.addEventListener('click', function (e) {
      var it = e.target.closest('.sd-item'); if (!it) return;
      location.href = 'e-detail.html?id=' + encodeURIComponent(it.getAttribute('data-id'));
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim(); if (!q) return;
      location.href = 'e-browse.html?q=' + encodeURIComponent(q);
    });
  }

  function initXdev() {
    var d = new URLSearchParams(location.search).get('device');
    if (!d) return;
    document.documentElement.setAttribute('data-device', d);
    var b = document.createElement('div');
    b.className = 'xdev-badge';
    b.textContent = d === 'tv' ? 'TV · 10-FOOT MODE' : d === 'beamer' ? 'PROJECTOR MODE' : '';
    if (b.textContent) document.body.appendChild(b);
    if (d === 'beamer') {
      addEventListener('load', function () {
        setTimeout(function () {
          function lum(a) { if (!a) return 1; var m = a.match(/[\d.]+/g); if (!m || m.length < 3) return 1; if (m.length > 3 && +m[3] === 0) return 1; return .2126 * (+m[0] / 255) + .7152 * (+m[1] / 255) + .0722 * (+m[2] / 255); }
          var lv = lum(getComputedStyle(document.body).backgroundColor);
          if (lv >= 1) lv = lum(getComputedStyle(document.documentElement).backgroundColor);
          if (lv > .5) document.documentElement.setAttribute('data-invert', '1');
        }, 300);
      });
    }
  }

  /* ---------- 移动端顶栏 ☰ + 导航抽屉（对齐真实 StickyHeader menu-btn + Sidebar isMobile 抽屉：
     真实移动端每页顶栏左侧都有 ☰，点开左侧滑入抽屉；6 项与 Sidebar.tsx tabs 同序同文案。
     boot 动态注入，仅 ≤767 显示；e-iptv-player 无 .topbar（真实 IPTVPlayer 不走 AppLayout），自动跳过） ---------- */
  function initMobileNav() {
    var tb = document.querySelector('.topbar');
    if (!tb || document.querySelector('.drawer')) return;
    var btn = document.createElement('button');
    btn.className = 'menu-btn'; btn.type = 'button'; btn.hidden = true;
    btn.setAttribute('aria-label', '打开导航菜单'); btn.title = '导航菜单';
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    tb.insertBefore(btn, tb.firstChild);
    var ov = document.createElement('div'); ov.className = 'drawer-overlay';
    var dr = document.createElement('aside'); dr.className = 'drawer';
    dr.setAttribute('aria-label', '导航菜单');
    var here = location.pathname.split('/').pop();
    var NAV = [   // Sidebar.tsx tabs 同序：首页 / 搜索中心 / IPTV / 收藏 / 历史记录 / 设置
      ['home-style-e-typographic.html', '首页'],
      ['e-browse.html', '搜索中心'],
      ['e-iptv.html', 'IPTV'],
      ['e-collections.html', '收藏'],
      ['e-history.html', '历史记录'],
      ['e-settings.html', '设置'],
    ];
    dr.innerHTML = '<div class="drawer-head"><b>Kino<em>TV</em> 影视日报</b>' +
      '<button class="drawer-close" type="button" aria-label="关闭">✕</button></div>' +
      '<nav class="drawer-nav">' + NAV.map(function (it) {
        return '<a href="' + it[0] + '"' + (here === it[0] ? ' class="on"' : '') + '>' + it[1] + '</a>';
      }).join('') + '</nav>';
    document.body.appendChild(ov); document.body.appendChild(dr);
    function set(open) {
      ov.classList.toggle('on', open); dr.classList.toggle('on', open);
      btn.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    btn.addEventListener('click', function () { set(!dr.classList.contains('on')); });
    ov.addEventListener('click', function () { set(false); });
    dr.querySelector('.drawer-close').addEventListener('click', function () { set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    var mq = window.matchMedia('(max-width:767px)');
    function sync() { btn.hidden = !mq.matches; if (!mq.matches) set(false); }
    if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
    sync();
  }

  /* ---------- 启动 ---------- */
  function boot(cfg) {
    cfg = cfg || {};
    var S = window.KINO_E_TMDB;
    var p = (S && S.trending && S.rows && Object.keys(S.rows).length) ? Promise.resolve(assemble(S)) : cmsFallback();
    return p.then(function (d) {
      DATA = d;
      renderChrome(cfg.key, cfg.title);
      initTheme(); initSearch(); initFab(); initMobileNav(); initXdev();
      document.documentElement.classList.remove('booting');
      return d;
    });
  }

  window.KINO_E = {
    PAGES: PAGES, boot: boot, bindPics: bindPics, pic: pic, esc: esc,
    genreName: genreName, seeded: seeded, pick: pick,
    all: allItems, movies: movies, tv: tvItems, byKey: byKey,
    fav: { is: isFav, toggle: toggleFav, all: function () { return FAVS; } },
    data: function () { return DATA; },
  };
})();
