// Cloudflare Worker — 通用 CORS 代理
// 代理任意 API 请求，解决浏览器跨域限制
// 部署后将 Worker URL 填入前端设置页的"视频采集CORS代理"配置中

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

  const rawQuery = url.search.substring(1);
  const targetUrl = unwrapSelfNested(
    url.searchParams.get("url") || extractUrlParam(rawQuery),
    url.origin,
  );
  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
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
