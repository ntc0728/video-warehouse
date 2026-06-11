// Cloudflare Worker — 通用 CORS 代理
// 代理任意 API 请求，解决浏览器跨域限制
// 部署后将 Worker URL 填入前端设置页的"视频采集CORS代理"配置中

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

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
      },
    });

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
