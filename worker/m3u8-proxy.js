// Cloudflare Worker — M3U8/TS 流代理，解决跨域问题
// 部署到 Cloudflare Workers 后，将 Worker URL 填入前端 IPTV 设置中的代理地址

// M3U8 播放列表缓存：60s（直播节目单更新频率通常为 2-10s，60s 缓存可减少
// 源站压力同时不会明显增加直播延迟。对于支持 DVR 的流，M3U8 需更频繁刷新；
// 后续可基于 #EXT-X-TARGETDURATION 动态调整 TTL）
const M3U8_CACHE_TTL = 60000;
const m3u8Cache = new Map();

// TS 分片缓存：5s（同一分片可能在短时间内被多次请求，5s 缓存可吸收突发流量）
const TS_CACHE_TTL = 5000;
const tsCache = new Map();

// 定期清理过期缓存条目，防止内存泄漏
function evictCache() {
  const now = Date.now();
  for (const [key, entry] of m3u8Cache) {
    if (now - entry.time > M3U8_CACHE_TTL) {
      m3u8Cache.delete(key);
    }
  }
  for (const [key, entry] of tsCache) {
    if (now - entry.time > TS_CACHE_TTL) {
      tsCache.delete(key);
    }
  }
}

export default {
  async fetch(request) {
    return handleRequest(request);
  },
};

async function handleRequest(request) {
  const url = new URL(request.url);

  // 每次请求时清理过期缓存
  evictCache();

  if (url.pathname === "/m3u8-proxy") {
    return handleM3U8Proxy(request);
  } else if (url.pathname === "/ts-proxy") {
    return handleTsProxy(request);
  }

  return new Response("Not Found", { status: 404 });
}

const options = {
  originBlacklist: [],
  originWhitelist: ["*"],
};

const isOriginAllowed = (origin, options) => {
  if (options.originWhitelist.includes("*")) {
    return true;
  }
  if (
    options.originWhitelist.length &&
    !options.originWhitelist.includes(origin)
  ) {
    return false;
  }
  if (
    options.originBlacklist.length &&
    options.originBlacklist.includes(origin)
  ) {
    return false;
  }
  return true;
};

/**
 * 从原始查询字符串中提取 url 参数的完整值。
 * 当 url 参数未编码时，searchParams.get("url") 会在第一个 & 处截断。
 * 本函数从原始字符串中定位 "url=" 后，取到下一个顶层 & 之间的全部内容。
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

async function handleM3U8Proxy(request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = new URL(request.url).search.substring(1);
  const targetUrl = searchParams.get("url") || extractUrlParam(rawQuery);
  const headers = JSON.parse(searchParams.get("headers") || "{}");
  const origin = request.headers.get("Origin") || "";

  if (!isOriginAllowed(origin, options)) {
    return new Response(`The origin "${origin}" is not allowed.`, {
      status: 403,
    });
  }
  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  try {
    const cacheKey = targetUrl;
    const cached = m3u8Cache.get(cacheKey);
    if (cached && Date.now() - cached.time < M3U8_CACHE_TTL) {
      return new Response(cached.body, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    }

    const urlObj = new URL(targetUrl);
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
        "Referer": `${urlObj.protocol}//${urlObj.host}/`,
        "Origin": `${urlObj.protocol}//${urlObj.host}`,
        ...headers,
      },
    });
    if (!response.ok) {
      return new Response("Failed to fetch the m3u8 file", {
        status: response.status,
      });
    }

    const m3u8 = await response.text();
    const result = rewriteM3U8(m3u8, targetUrl, headers);
    m3u8Cache.set(cacheKey, { body: result, time: Date.now() });

    return new Response(result, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

/**
 * 重写 m3u8 内容中的所有 URL，使其经过代理。
 * - 相对 URL：基于 baseUrl 解析为绝对 URL，再转为代理 URL
 * - 绝对 URL：直接转为代理 URL
 * @param {string} content - m3u8 原始内容
 * @param {string} baseUrl - 用于解析相对 URL 的基准地址（原始 m3u8 URL）
 * @param {object} headers - 传递给子请求的自定义请求头
 * @returns {string} 重写后的 m3u8 内容
 */
function rewriteM3U8(content, baseUrl, headers) {
  const headerStr = encodeURIComponent(JSON.stringify(headers));
  const lines = content.split("\n");
  const newLines = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (line.startsWith("#EXT-X-KEY:")) {
        const regex = /https?:\/\/[^\""\s]+/g;
        const keyUrl = regex.exec(line)?.[0] ?? "";
        if (keyUrl) {
          const newUrl = `/ts-proxy?url=${encodeURIComponent(keyUrl)}&headers=${headerStr}`;
          newLines.push(line.replace(keyUrl, newUrl));
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    } else if (line.trim()) {
      const uri = new URL(line.trim(), baseUrl);
      const pathname = uri.pathname;
      const proxyPath =
        pathname.endsWith(".m3u8") || pathname.endsWith(".m3u")
          ? "m3u8-proxy"
          : "ts-proxy";
      newLines.push(
        `/${proxyPath}?url=${encodeURIComponent(uri.href)}&headers=${headerStr}`
      );
    } else {
      newLines.push(line);
    }
  }

  return newLines.join("\n");
}

async function handleTsProxy(request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = new URL(request.url).search.substring(1);
  const targetUrl = searchParams.get("url") || extractUrlParam(rawQuery);
  const headers = JSON.parse(searchParams.get("headers") || "{}");
  const origin = request.headers.get("Origin") || "";

  if (!isOriginAllowed(origin, options)) {
    return new Response(`The origin "${origin}" is not allowed.`, {
      status: 403,
    });
  }
  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  try {
    // Check TS segment cache first
    const tsCacheKey = targetUrl;
    const tsCached = tsCache.get(tsCacheKey);
    if (tsCached && Date.now() - tsCached.time < TS_CACHE_TTL) {
      return new Response(tsCached.body, {
        status: tsCached.status,
        headers: {
          "Content-Type": "video/mp2t",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    }

    const urlObj = new URL(targetUrl);
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
        "Referer": `${urlObj.protocol}//${urlObj.host}/`,
        "Origin": `${urlObj.protocol}//${urlObj.host}`,
        ...headers,
      },
    });

    if (!response.ok) {
      return new Response("Failed to fetch segment", {
        status: response.status,
      });
    }

    // Clone and cache the response body for short-duration reuse
    const clonedResponse = response.clone();
    const body = await clonedResponse.arrayBuffer();
    tsCache.set(targetUrl, {
      body,
      status: response.status,
      time: Date.now(),
    });

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
