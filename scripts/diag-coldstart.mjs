/**
 * 冷启动诊断工具 —— 量化 Vite dev 首屏模块图规模
 *
 * 背景：本地 dev 冷启动出现「白屏 ~30s 后才开始加载 JS」，需要把白屏时间拆成
 *   T1 服务就绪（本脚本不管，看 dev server 自身日志）
 *   T2 HTML → 首个模块响应（--noproxy 直连计时，排除代理）
 *   T3 模块图下载 + 执行（本脚本量化：模块数 / 总字节 / 依赖深度 / Top 大模块）
 *
 * 原理：以 /src/main.tsx 为根，跟随 Vite 重写后的静态 import 做 BFS，
 * 统计真实请求规模。动态 import（React.lazy 的路由 chunk）单独统计但不递归
 * （加了 --deep 才递归，用于评估「预加载全部路由」的成本）。
 *
 * 用法：
 *   node scripts/diag-coldstart.mjs
 *   node scripts/diag-coldstart.mjs --origin http://127.0.0.1:3001 --deep
 *   node scripts/diag-coldstart.mjs --top 20 --concurrency 6
 *
 * 只读工具：不修改任何业务代码，只发 GET 请求。
 */
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const ORIGIN = arg('origin', 'http://127.0.0.1:3001');
const ENTRY = arg('entry', '/src/main.tsx');
const TOP_N = Number(arg('top', '15'));
const CONCURRENCY = Number(arg('concurrency', '6'));
const DEEP = flag('deep');
const MAX_MODULES = Number(arg('max', '4000'));

const IMPORT_RE = /(?:^|[\s;}])(?:import|export)[\s\S]{0,400}?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm;

function extractImports(code) {
  const out = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(code)) !== null) {
    const spec = m[1] || m[2] || m[3];
    if (!spec) continue;
    out.push({ spec, dynamic: Boolean(m[2]) });
  }
  return out;
}

function resolveSpec(spec, fromUrl) {
  if (/^https?:\/\//.test(spec)) return null;
  if (spec.startsWith('/')) return spec;
  if (spec.startsWith('.')) {
    try {
      const u = new URL(spec, ORIGIN + fromUrl);
      return u.pathname + u.search;
    } catch {
      return null;
    }
  }
  return null;
}

const cache = new Map();

async function fetchModule(url) {
  if (cache.has(url)) return cache.get(url);
  const started = Date.now();
  const res = await fetch(ORIGIN + url, { headers: { Accept: '*/*' } });
  const text = await res.text();
  const rec = {
    url,
    status: res.status,
    bytes: Buffer.byteLength(text),
    ms: Date.now() - started,
    imports: res.ok ? extractImports(text) : [],
  };
  cache.set(url, rec);
  return rec;
}

async function timed(label, fn) {
  const t = Date.now();
  const out = await fn();
  return { label, ms: Date.now() - t, ...out };
}

const fmtMs = (n) => `${n}ms`;
const fmtKb = (n) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  console.log(`\n冷启动诊断  ${ORIGIN}${ENTRY}  ${DEEP ? '(deep: 递归动态 import)' : '(仅静态图)'}\n`);

  const html = await timed('HTML', async () => {
    const t = Date.now();
    const res = await fetch(ORIGIN + '/');
    const text = await res.text();
    return { status: res.status, bytes: Buffer.byteLength(text), ms: Date.now() - t };
  });
  console.log(`T1 HTML            ${fmtMs(html.ms).padStart(8)}  ${fmtKb(html.bytes).padStart(9)}  status ${html.status}`);

  const first = await fetchModule(ENTRY);
  console.log(`T2 首个模块        ${fmtMs(first.ms).padStart(8)}  ${fmtKb(first.bytes).padStart(9)}  status ${first.status}`);

  const seen = new Set([ENTRY]);
  const queue = [{ url: ENTRY, depth: 1 }];
  const dynamicOnly = new Set();
  let maxDepth = 1;
  const t0 = Date.now();
  let truncated = false;

  while (queue.length) {
    if (seen.size > MAX_MODULES) {
      truncated = true;
      break;
    }
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map((it) => fetchModule(it.url)));
    for (let i = 0; i < results.length; i++) {
      const rec = results[i];
      const depth = batch[i].depth;
      if (depth > maxDepth) maxDepth = depth;
      for (const { spec, dynamic } of rec.imports) {
        const url = resolveSpec(spec, rec.url);
        if (!url) continue;
        if (seen.has(url)) continue;
        if (dynamic && !DEEP) {
          dynamicOnly.add(url);
          continue;
        }
        seen.add(url);
        queue.push({ url, depth: depth + 1 });
      }
    }
  }

  const crawlMs = Date.now() - t0;
  const all = [...seen].map((u) => cache.get(u)).filter(Boolean);
  const totalBytes = all.reduce((s, r) => s + r.bytes, 0);
  const slowest = [...all].sort((a, b) => b.ms - a.ms).slice(0, 5);
  const biggest = [...all].sort((a, b) => b.bytes - a.bytes).slice(0, TOP_N);

  console.log(`T3 模块图爬取      ${fmtMs(crawlMs).padStart(8)}  (并发 ${CONCURRENCY}，含服务端 transform 时间)`);
  console.log(`\n── 规模 ──`);
  console.log(`静态模块数        ${all.length}${truncated ? `+ (截断于 ${MAX_MODULES})` : ''}`);
  console.log(`依赖最大深度      ${maxDepth}`);
  console.log(`模块总字节        ${fmtKb(totalBytes)} (${(totalBytes / 1024 / 1024).toFixed(2)}MB)`);
  console.log(`动态 import(未递归) ${dynamicOnly.size}`);

  console.log(`\n── 最慢响应 Top 5 ──`);
  for (const r of slowest) {
    console.log(`  ${fmtMs(r.ms).padStart(7)}  ${fmtKb(r.bytes).padStart(9)}  ${r.url}`);
  }

  console.log(`\n── 最大模块 Top ${TOP_N} ──`);
  for (const r of biggest) {
    console.log(`  ${fmtKb(r.bytes).padStart(9)}  ${fmtMs(r.ms).padStart(7)}  ${r.url}`);
  }

  if (dynamicOnly.size) {
    console.log(`\n── 动态 import 入口（React.lazy 路由 chunk，渲染/preload 时才拉）──`);
    for (const u of [...dynamicOnly].slice(0, 20)) console.log(`  ${u}`);
  }

  console.log(`\n提示：HTTP/1.1 浏览器同域并发 6，${all.length} 个模块 ≈ ${Math.ceil(all.length / 6)} 轮往返。`);
}

main().catch((e) => {
  console.error('诊断失败：', e.message);
  process.exit(1);
});
