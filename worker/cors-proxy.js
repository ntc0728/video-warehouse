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

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname !== "/proxy") {
    return new Response("Not Found", { status: 404 });
  }

  const targetUrl = url.searchParams.get("url");
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
