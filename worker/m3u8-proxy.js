// Cloudflare Worker — M3U8/TS 流代理，解决跨域问题
// 部署到 Cloudflare Workers 后，将 Worker URL 填入前端 IPTV 设置中的代理地址

const CACHE_TTL = 30000; // 30秒缓存，减少对源站的重复请求
const m3u8Cache = new Map();

// 定期清理过期缓存条目，防止内存泄漏
function evictCache() {
  const now = Date.now();
  for (const [key, entry] of m3u8Cache) {
    if (now - entry.time > CACHE_TTL) {
      m3u8Cache.delete(key);
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
    if (cached && Date.now() - cached.time < CACHE_TTL) {
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

    const lines = m3u8.split("\n");
    const newLines = [];

    lines.forEach((line) => {
      if (line.startsWith("#")) {
        if (line.startsWith("#EXT-X-KEY:")) {
          const regex = /https?:\/\/[^\""\s]+/g;
          const keyUrl = regex.exec(line)?.[0] ?? "";
          const newUrl = `/ts-proxy?url=${encodeURIComponent(
            keyUrl
          )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
          newLines.push(line.replace(keyUrl, newUrl));
        } else {
          newLines.push(line);
        }
      } else {
        const uri = new URL(line, targetUrl);
        const pathname = uri.pathname;
        const proxyPath = pathname.endsWith('.m3u8') || pathname.endsWith('.m3u')
          ? 'm3u8-proxy'
          : 'ts-proxy';
        newLines.push(
          `/${proxyPath}?url=${encodeURIComponent(
            uri.href
          )}&headers=${encodeURIComponent(JSON.stringify(headers))}`
        );
      }
    });

    const result = newLines.join("\n");
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

    return new Response(response.body, {
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
