// Cloudflare Worker — M3U8/TS 流代理，解决跨域问题
// 部署到 Cloudflare Workers 后，将 Worker URL 填入前端 IPTV 设置中的代理地址

// M3U8 播放列表缓存：60s（直播节目单更新频率通常为 2-10s，60s 缓存可减少
// 源站压力同时不会明显增加直播延迟。对于支持 DVR 的流，M3U8 需更频繁刷新；
// 后续可基于 #EXT-X-TARGETDURATION 动态调整 TTL）
// 注：TS 分片不再做内存缓存——直播分片不可缓存且 Worker 无状态多实例不共享
// 内存，原 tsCache 缓存命中率极低、纯属每次请求的内存/GC 负担，已移除。
const M3U8_CACHE_TTL = 60000;
const m3u8Cache = new Map();

// 定期清理过期缓存条目，防止内存泄漏
function evictCache() {
  const now = Date.now();
  for (const [key, entry] of m3u8Cache) {
    if (now - entry.time > M3U8_CACHE_TTL) {
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
  } else if (url.pathname === "/dash-proxy") {
    return handleDashProxy(request);
  } else if (url.pathname === "/file-proxy") {
    return handleFileProxy(request);
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
          "Timing-Allow-Origin": "*",
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
    const result = rewriteM3U8(m3u8, targetUrl, headers, request.url);
    m3u8Cache.set(cacheKey, { body: result, time: Date.now() });

    return new Response(result, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
        "Timing-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

/**
 * DASH (.mpd) 代理：与 m3u8-proxy 同理，但重写的是 mpd 清单内部的媒体引用。
 * mpd 通过本代理加载后，浏览器（dash.js）会以响应 URL 为 base 解析相对路径，
 * 若直接透传（file-proxy），相对分片会拼成 "worker/file-proxy?url=.../seg.m4s" 的畸形地址。
 * 因此此处把 mpd 内所有相对媒体引用（SegmentTemplate 的 initialization/media、
 * SegmentURL 的 media/url、Initialization/RepresentationIndex 的 sourceURL 等）解析为
 * 绝对源站 URL 后包成 file-proxy 代理地址，dash.js 直接请求绝对地址即可正常拉流。
 */
async function handleDashProxy(request) {
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
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
        "Referer": `${urlObj.protocol}//${urlObj.host}/`,
        "Origin": `${urlObj.protocol}//${urlObj.host}`,
        ...headers,
      },
    });
    if (!response.ok) {
      return new Response("Failed to fetch the mpd file", {
        status: response.status,
      });
    }

    const mpd = await response.text();
    const result = rewriteMPD(mpd, targetUrl, headers, request.url);

    return new Response(result, {
      headers: {
        "Content-Type": "application/dash+xml",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
        "Timing-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

/**
 * 重写 MPD 清单内部的所有媒体 URL，使其经过 file-proxy 代理。
 * 关键点：
 *  - 维护 BaseURL 作用域栈（MPD/Period/AdaptationSet/Representation 各级 BaseURL
 *    会叠加影响后续相对引用的基准），当前基准 = 栈顶 || mpd 源 URL；
 *  - 遇到 <BaseURL> 内容时，将其解析为绝对源站 URL 并包成 file-proxy（作为兜底基准）；
 *  - 遇到媒体引用属性（media / initialization / sourceURL / url）时，基于当前基准解析为
 *    绝对源站 URL 后包成 file-proxy，使 dash.js 直接请求绝对地址，不再依赖 base 拼接。
 *  - 模板占位符（$Number$ / $Time$ / $RepresentationID$ 等）保留，仅做路径基准解析。
 * @param {string} content - mpd 原始 XML
 * @param {string} mpdUrl - 原始 mpd 的源 URL（相对引用基准）
 * @param {object} headers - 传递给子请求的自定义请求头
 * @param {string} workerUrl - Worker 自身请求 URL，用于取 origin
 * @returns {string} 重写后的 mpd 内容
 */
function rewriteMPD(content, mpdUrl, headers, workerUrl) {
  const workerOrigin = new URL(workerUrl).origin;
  const headerStr = encodeURIComponent(JSON.stringify(headers));
  const fileProxy = (u) =>
    `${workerOrigin}/file-proxy?url=${encodeURIComponent(u)}&headers=${headerStr}`;
  const resolve = (ref, base) => {
    try {
      return new URL(ref, base).href;
    } catch {
      return ref;
    }
  };
  // 媒体引用属性（localName 匹配，忽略命名空间前缀）
  const attrRe =
    /(\b(?:media|initialization|sourceURL|url)\s*=\s*)(["'])(.*?)\2/g;

  const tagRe = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[^>]*?)?)(\/?)>/g;
  let result = "";
  let lastIndex = 0;
  const baseStack = [];
  let currentBase = mpdUrl;

  const localNameOf = (name) =>
    name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;

  let m;
  while ((m = tagRe.exec(content)) !== null) {
    result += content.slice(lastIndex, m.index);
    const isClose = m[1] === "/";
    const rawName = m[2];
    const attrs = m[3];
    const selfClose = m[4] === "/";
    const name = localNameOf(rawName).toLowerCase();

    if (name === "baseurl") {
      if (isClose) {
        baseStack.pop();
        currentBase = baseStack.length ? baseStack[baseStack.length - 1] : mpdUrl;
        result += "</BaseURL>";
        lastIndex = tagRe.lastIndex;
        continue;
      }
      // <BaseURL>inner</BaseURL>：内容在开标签之后、闭标签之前
      const closeIdx = content.indexOf("</BaseURL>", tagRe.lastIndex);
      const inner = closeIdx === -1 ? "" : content.slice(tagRe.lastIndex, closeIdx);
      const resolved = resolve(inner.trim(), mpdUrl);
      result += `<BaseURL>${fileProxy(resolved)}</BaseURL>`;
      if (closeIdx !== -1) {
        tagRe.lastIndex = closeIdx + "</BaseURL>".length;
      }
      baseStack.push(resolved);
      currentBase = resolved;
      lastIndex = tagRe.lastIndex;
      continue;
    }

    let newAttrs = attrs;
    if (!isClose) {
      newAttrs = attrs.replace(attrRe, (full, pre, q, val) => {
        // 跳过空值（如某些 url="" 的占位）
        if (!val.trim()) return full;
        const resolved = resolve(val, currentBase);
        return `${pre}${q}${fileProxy(resolved)}${q}`;
      });
    }
    result += `<${isClose ? "/" : ""}${rawName}${newAttrs}${selfClose ? "/" : ""}>`;
    lastIndex = tagRe.lastIndex;
  }
  result += content.slice(lastIndex);
  return result;
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
function rewriteM3U8(content, baseUrl, headers, workerUrl) {
  const headerStr = encodeURIComponent(JSON.stringify(headers));
  const lines = content.split("\n");
  const newLines = [];
  // 使用绝对路径，且必须指向 Worker 自身 origin，避免相对路径在非 Worker origin 的
  // 页面上解析错误（如 dev 模式下页面 origin 是 localhost:3001），更关键的是保证重写后的
  // 子播放列表 / ts 分片 / 密钥地址都回源到 Worker 而非源站域名。
  // 注意：此处 origin 必须来自 Worker 自身的 URL（request.url），不能用 baseUrl（源站 URL），
  // 否则重写地址会指向源站，导致整棵流树请求到源站的非存在路由而全部失败。
  const workerOrigin = new URL(workerUrl).origin;

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (line.startsWith("#EXT-X-KEY:")) {
        const regex = /https?:\/\/[^\""\s]+/g;
        const keyUrl = regex.exec(line)?.[0] ?? "";
        if (keyUrl) {
          const newUrl = `${workerOrigin}/ts-proxy?url=${encodeURIComponent(keyUrl)}&headers=${headerStr}`;
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
        `${workerOrigin}/${proxyPath}?url=${encodeURIComponent(uri.href)}&headers=${headerStr}`
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

    // 流式透传：直接转发源站响应体，不再把整段分片缓冲进内存后再发，
    // 消除直播卡顿主因（边下边传，延迟≈0，且不触发 Workers 响应体大小限制）
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
        "Timing-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

/**
 * 单文件流代理（非 m3u8）：用于 .mp4 / .ts / .m4s 等直接可播放的媒体文件。
 * 与 m3u8-proxy / ts-proxy 的区别：原样透传源站的 Content-Type 与 Range，
 * 使 mp4 等单文件流能被播放器正确识别并支持拖动进度（Range 请求）。
 * 不做内容重写、不做长缓存（单文件可能较大，按需透传即可）。
 */
async function handleFileProxy(request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = new URL(request.url).search.substring(1);
  const targetUrl = searchParams.get("url") || extractUrlParam(rawQuery);
  const headers = JSON.parse(searchParams.get("headers") || "{}");
  const origin = request.headers.get("Origin") || "";

  if (!isOriginAllowed(origin, options)) {
    return new Response(`The origin "${origin}" is not allowed.`, { status: 403 });
  }

  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  try {
    const urlObj = new URL(targetUrl);
    const reqHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
      "Referer": `${urlObj.protocol}//${urlObj.host}/`,
      "Origin": `${urlObj.protocol}//${urlObj.host}`,
      ...headers,
    };
    // 透传 Range，支持单文件流拖动进度
    const range = request.headers.get("Range");
    if (range) reqHeaders["Range"] = range;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: reqHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return new Response(`Failed to fetch file: ${response.status}`, { status: response.status });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Length": response.headers.get("Content-Length") || "",
        "Accept-Ranges": response.headers.get("Accept-Ranges") || "bytes",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
        "Timing-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// 导出供单元测试（vitest）使用，不影响 Cloudflare Worker 部署（部署仅依赖 default.fetch）
export { rewriteM3U8, rewriteMPD, extractUrlParam };
