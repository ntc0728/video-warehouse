// Cloudflare Worker — CMS API CORS 代理
// 部署后将 Worker URL 填入前端设置页的"视频采集CORS代理"配置中
//
// 访问控制（防开放代理滥用）：
//   1. 仅接受 GET/HEAD（采集站 API 均为只读；OPTIONS 仅回预检响应）
//   2. 目标域名白名单 ALLOWED_TARGET_HOSTS：内置采集站（提取自 public/data/video-sources.json）
//      + 默认 EPG 源。新增自定义采集站 / EPG 源时，把对应域名追加进来即可。
//   3. 调用方来源校验 ALLOWED_CLIENT_HOSTS：浏览器跨域请求必带 Origin/Referer，
//      只放行本站与本机开发端口；无来源头的直连请求一律 403。

// 目标域名白名单（内置采集站 + 默认 EPG 源）
const ALLOWED_TARGET_HOSTS = new Set([
  "360zy.com",
  "360zyzz.com",
  "api.apibdzy.com",
  "api.ffzyapi.com",
  "api.guangsuapi.com",
  "api.maoyanapi.top",
  "api.ukuapi88.com",
  "api.wujinapi.me",
  "api.wwzy.tv",
  "api.xinlangapi.com",
  "api.zuidapi.com",
  "bdzy1.com",
  "bfzy.tv",
  "bfzyapi.com",
  "caiji.dbzy5.com",
  "caiji.dyttzyapi.com",
  "caiji.maotaizy.cc",
  "caiji.moduapi.cc",
  "cj.ffzyapi.com",
  "cj.lzcaiji.com",
  "cj.rycjapi.com",
  "dbzy.tv",
  "hhzyapi.com",
  "ikunzy.com",
  "ikunzyapi.com",
  "iqiyizyapi.com",
  "jinyingzy.com",
  "jszyapi.com",
  "lovedan.net",
  "mtzy.me",
  "p2100.net",
  "subocaiji.com",
  "wolongzyw.com",
  "wujinzy.com",
  "www.haohuazy.com",
  "www.hongniuzy.com",
  "www.hongniuzy2.com",
  "www.maoyanzy.com",
  "www.mdzyapi.com",
  "www.moduzy.net",
  "www.ryzyw.com",
  "www.subozy.com",
  "www.ukuzy.com",
  "xinlangapi.com",
  "zuida.xyz",
  "epg.51zmt.top",
]);

// 调用方来源（站点自身 + 本机开发端口；站点子域名按后缀匹配）
const ALLOWED_CLIENT_HOSTS = new Set([
  "video-warehouse.top",
  "www.video-warehouse.top",
  "localhost",
  "127.0.0.1",
]);

const isAllowedClient = (request) => {
  const source =
    request.headers.get("Origin") || request.headers.get("Referer") || "";
  if (!source) return false;
  try {
    const host = new URL(source).hostname;
    return (
      ALLOWED_CLIENT_HOSTS.has(host) ||
      host.endsWith(".video-warehouse.top")
    );
  } catch {
    return false;
  }
};

const isAllowedTarget = (targetUrl) => {
  try {
    return ALLOWED_TARGET_HOSTS.has(new URL(targetUrl).hostname);
  } catch {
    return false;
  }
};

// 短 TTL 内存缓存：CMS API（如搜索）请求频繁但内容变化不剧烈，
// 60s 缓存可显著降低源站压力（注意 Worker 多实例内存不共享，缓存只是尽力命中，
// 命中率取决于请求集中度，无副作用——miss 时正常回源）。
const CACHE_TTL = 60000;
const responseCache = new Map();

// 清理过期条目，防止内存泄漏
function evictCache() {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (now - entry.time > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}

/**
 * 从原始查询字符串中提取 url 参数的完整值（容错：url 参数未整体编码时，
 * searchParams.get("url") 会在第一个 & 处截断，取不到完整目标地址）。
 * 与 m3u8-proxy 的 extractUrlParam 同逻辑，保持两个 worker 行为一致。
 */
function extractUrlParam(rawQuery) {
  const marker = "url=";
  const start = rawQuery.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  let depth = 0;
  for (; i < rawQuery.length; i++) {
    const ch = rawQuery[i];
    if (ch === "%" && rawQuery[i + 1] === "2" && rawQuery[i + 2] === "6") {
      i += 2;
      continue;
    }
    if (ch === "?") { depth++; continue; }
    if (ch === "&" && depth === 0) break;
    if (ch === "&") depth--;
  }
  return decodeURIComponent(rawQuery.substring(start + marker.length, i));
}

/**
 * 防御：历史版本前端在响应拦截器重试时会把已包装的代理地址再包一层
 * （proxy?url=proxy?url=...），多出的编码层会泄漏到目标站（wd 带字面量 %）。
 * 前端已修复（请求拦截器幂等防护），此处对存量/缓存中的自嵌套地址解开一层兜底。
 */
function unwrapSelfNested(targetUrl, requestOrigin) {
  if (!targetUrl) return targetUrl;
  try {
    const u = new URL(targetUrl);
    if (u.origin === requestOrigin && u.pathname === "/proxy") {
      const inner = u.searchParams.get("url");
      if (inner) return inner;
    }
  } catch { /* 非法 URL 交由后续 fetch 报错 */ }
  return targetUrl;
}

// 部署入口（Cloudflare Workers 环境）；加 typeof 守卫以便 vitest 导入测纯函数
if (typeof addEventListener === "function") {
  addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
  });
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname !== "/proxy") {
    return new Response("Not Found", { status: 404 });
  }

  // 采集站 API 均为只读：仅接受 GET/HEAD（OPTIONS 回预检响应）
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 调用方来源：无 Origin/Referer = 非浏览器直连 → 拒绝
  if (!isAllowedClient(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const rawQuery = url.search.substring(1);
  const targetUrl = unwrapSelfNested(
    url.searchParams.get("url") || extractUrlParam(rawQuery),
    url.origin,
  );
  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  // 目标域名白名单：只代理内置采集站与 EPG 源，防止被当作开放代理滥用
  if (!isAllowedTarget(targetUrl)) {
    return new Response("Target host not allowed", { status: 403 });
  }

  // 仅缓存 GET 请求（CMS API 都是 GET；写请求/带自定义头一律透传）
  if (request.method === "GET") {
    evictCache();
    const cacheKey = `${targetUrl}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          ...cached.headers,
          "X-Cache": "HIT",
        },
      });
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
      },
    });

    // 仅缓存成功的 GET 响应（避免缓存源站错误响应）
    if (request.method === "GET" && response.status >= 200 && response.status < 300) {
      const body = await response.clone().text();
      const headers = {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      };
      responseCache.set(targetUrl, {
        body,
        status: response.status,
        headers,
        time: Date.now(),
      });
      return new Response(body, { status: response.status, headers });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// 导出供单元测试（vitest）使用；部署入口仍是上方 addEventListener("fetch")
if (typeof module !== "undefined" && module.exports) {
  module.exports = { extractUrlParam, unwrapSelfNested };
}
