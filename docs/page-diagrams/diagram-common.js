/**
 * diagram-common.js — 页面原理图共享数据加载与渲染工具
 *
 * 所有页面通过此脚本加载 diagram-data.json 真实数据，
 * 并提供 IPTV / Video 代理 URL 构建工具和 TMDB 实时获取能力。
 *
 * 代理配置：
 *   Video Proxy (CORS): https://video-warehouse.nmziptv.top/proxy?url=
 *   IPTV Proxy (M3U8):  https://iptv.nmz996.cc.cd/m3u8-proxy?url=
 *   TS Proxy:            https://iptv.nmz996.cc.cd/ts-proxy?url=
 */
(function (global) {
  'use strict';

  // ── 代理配置 ──────────────────────────────────────
  const PROXIES = {
    videoProxy: 'https://video-warehouse.nmziptv.top',
    iptvProxy: 'https://iptv.nmz996.cc.cd',
    get corsProxy() { return this.videoProxy + '/proxy?url='; },
    get m3u8Proxy() { return this.iptvProxy + '/m3u8-proxy?url='; },
    get tsProxy() { return this.iptvProxy + '/ts-proxy?url='; },
  };

  const TMDB_BASE = 'https://api.tmdb.org/3';
  const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

  // ── 数据缓存 ──────────────────────────────────────
  let _data = null;
  let _tmdbToken = localStorage.getItem('tmdb_token') || '';

  /**
   * 加载 diagram-data.json
   * @returns {Promise<Object>}
   */
  async function loadData() {
    if (_data) return _data;
    try {
      const resp = await fetch('diagram-data.json');
      _data = await resp.json();
    } catch (e) {
      console.error('[diagram] 加载 diagram-data.json 失败:', e);
      _data = { meta: { proxies: PROXIES }, tmdb: null, cms: null, iptv: null };
    }
    return _data;
  }

  // ── 代理 URL 构建 ──────────────────────────────────
  function buildCorsProxyUrl(targetUrl) {
    return PROXIES.corsProxy + encodeURIComponent(targetUrl);
  }
  function buildM3u8ProxyUrl(targetUrl) {
    return PROXIES.m3u8Proxy + encodeURIComponent(targetUrl);
  }
  function buildTsProxyUrl(targetUrl) {
    return PROXIES.tsProxy + encodeURIComponent(targetUrl);
  }

  // ── TMDB 图片 URL ──────────────────────────────────
  function tmdbImage(path, size) {
    if (!path) return '';
    return TMDB_IMAGE_BASE + '/' + (size || 'w500') + path;
  }

  // ── TMDB 实时获取 ──────────────────────────────────
  function getTmdbToken() { return _tmdbToken; }
  function setTmdbToken(token) {
    _tmdbToken = token;
    if (token) localStorage.setItem('tmdb_token', token);
    else localStorage.removeItem('tmdb_token');
  }

  async function fetchTMDB(endpoint, params) {
    if (!_tmdbToken) return null;
    const sp = new URLSearchParams(Object.assign({ language: 'zh-CN' }, params || {}));
    const url = TMDB_BASE + endpoint + '?' + sp.toString();
    try {
      const resp = await fetch(url, {
        headers: { Authorization: 'Bearer ' + _tmdbToken },
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } catch (e) {
      console.warn('[TMDB] 获取失败:', endpoint, e.message);
      return null;
    }
  }

  // ── 渲染工具 ──────────────────────────────────────

  /** HTML 转义 */
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /** 格式化数字（万） */
  function formatCount(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return String(n);
  }

  /** 渲染 TMDB 海报卡片 */
  function renderPosterCard(item) {
    const poster = item.poster
      ? '<img src="' + esc(item.poster) + '" loading="lazy" alt="' + esc(item.title) + '" style="width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:var(--radius-md);">'
      : '<div style="width:100%;aspect-ratio:2/3;background:linear-gradient(135deg,#e0e0e0,#c0c0c0);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:var(--color-text-tertiary);font-size:var(--text-xs);">无图片</div>';
    const badge = item.rating && parseFloat(item.rating) > 0
      ? '<span class="poster-badge">★ ' + esc(item.rating) + '</span>'
      : '';
    return '<div class="grid-item" onclick="window.location.href=\'detail.html?id=' + esc(item.id) + '\'">' +
      '<div class="poster-inner" style="background:var(--color-surface);">' + poster + badge + '</div>' +
      '<div class="poster-title">' + esc(item.title) + (item.year ? ' (' + esc(item.year) + ')' : '') + '</div>' +
      '</div>';
  }

  /** 渲染 TMDB 海报行 */
  function renderMovieRow(title, items, icon) {
    if (!items || items.length === 0) return '';
    const cards = items.map(renderPosterCard).join('');
    return '<div class="movie-row">' +
      '<div class="movie-row-header">' +
      '<span class="row-title">' + (icon || '') + ' ' + esc(title) + '</span>' +
      '<span class="row-more" onclick="window.location.href=\'browse.html\'">查看更多 →</span>' +
      '</div>' +
      '<div class="mock-grid">' + cards + '</div>' +
      '</div>';
  }

  /** 渲染 CMS 视频卡片 */
  function renderCMSCard(item) {
    const poster = item.poster
      ? '<img src="' + esc(item.poster) + '" loading="lazy" alt="' + esc(item.title) + '" style="width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:var(--radius-md);" onerror="this.style.display=\'none\'">'
      : '<div style="width:100%;aspect-ratio:2/3;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:#fff;font-size:var(--text-xs);">' + esc(item.title) + '</div>';
    return '<div class="grid-item">' +
      '<div class="poster-inner" style="background:var(--color-surface);">' + poster + '</div>' +
      '<div class="poster-title">' + esc(item.title) + (item.year ? ' (' + esc(item.year) + ')' : '') + '</div>' +
      '</div>';
  }

  /** 渲染 IPTV 频道项 */
  function renderIPTVChannel(ch) {
    const logo = ch.logo
      ? '<img src="' + esc(ch.logo) + '" loading="lazy" alt="' + esc(ch.name) + '" style="width:40px;height:40px;border-radius:var(--radius-sm);object-fit:cover;" onerror="this.style.display=\'none\'">'
      : '<div style="width:40px;height:40px;border-radius:var(--radius-sm);background:var(--color-hover-bg);display:flex;align-items:center;justify-content:center;font-size:14px;">📺</div>';
    return '<div class="iptv-channel-item" data-url="' + esc(ch.proxiedUrl || ch.url) + '" data-name="' + esc(ch.name) + '">' +
      '<div class="iptv-channel-logo">' + logo + '</div>' +
      '<div class="iptv-channel-info">' +
      '<div class="iptv-channel-name">' + esc(ch.name) + '</div>' +
      '<div class="iptv-channel-group">' + esc(ch.group || '未分组') + ' · ' + esc(ch.sourceName || '') + '</div>' +
      '</div>' +
      '<button class="iptv-play-btn btn btn--primary btn--sm" onclick="DiagramCommon.playChannel(\'' + esc(ch.proxiedUrl || ch.url) + '\',\'' + esc(ch.name) + '\')">播放</button>' +
      '</div>';
  }

  /** 播放 IPTV 频道（在新窗口打开） */
  function playChannel(url, name) {
    window.open(url, '_blank');
  }

  /** 渲染 TMDB 未配置提示 */
  function renderTmdbNotice() {
    return '<div class="tmdb-notice">' +
      '<div class="tmdb-notice-icon">🔑</div>' +
      '<div class="tmdb-notice-text">' +
      '<strong>TMDB Token 未配置</strong><br>' +
      '<span>TMDB 数据需配置 Bearer Token。请在 <a href="settings.html">设置页</a> 填入 token，或运行脚本时传入 <code>TMDB_TOKEN=xxx</code>。</span>' +
      '</div></div>';
  }

  /** 渲染代理信息栏 */
  function renderProxyBar() {
    return '<div class="proxy-bar">' +
      '<span class="proxy-badge" title="CORS 代理">Video Proxy: ' + esc(PROXIES.videoProxy) + '</span>' +
      '<span class="proxy-badge" title="M3U8 流代理">IPTV Proxy: ' + esc(PROXIES.iptvProxy) + '</span>' +
      '<button class="btn btn--sm" onclick="DiagramCommon.refreshData()">🔄 刷新数据</button>' +
      '</div>';
  }

  /** 刷新数据（重新运行脚本需手动执行，此处重新加载 JSON） */
  async function refreshData() {
    _data = null;
    await loadData();
    location.reload();
  }

  /** 获取 URL 查询参数 */
  function getQueryParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // ── 导出 ──────────────────────────────────────────
  global.DiagramCommon = {
    PROXIES,
    loadData,
    buildCorsProxyUrl,
    buildM3u8ProxyUrl,
    buildTsProxyUrl,
    tmdbImage,
    getTmdbToken,
    setTmdbToken,
    fetchTMDB,
    esc,
    formatCount,
    renderPosterCard,
    renderMovieRow,
    renderCMSCard,
    renderIPTVChannel,
    renderTmdbNotice,
    renderProxyBar,
    playChannel,
    refreshData,
    getQueryParam,
  };
})(window);
