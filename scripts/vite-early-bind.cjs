/**
 * vite dev 端口提前 bind（npm/pnpm 通用，2026-10-11）
 * ─────────────────────────────────────────────────────────────────────────────
 * 背景：vite 原版 _createServer 把 httpServer.listen 包装成「先 await
 * initServer(true) 再真 bind」——depsOptimizer init（2–8s，缓存失效更久）期间
 * 端口不可连 → 浏览器 ECONNREFUSED 纯白屏，连 early-index-html 中间件都无机会执行。
 * 旧方案是 pnpm.patchedDependencies 直改 vite 内部 chunk，但 npm 安装路径从不
 * apply pnpm patch（本地 npm run dev 吃不到），且手写 patch 非法导致 Cloudflare
 * CI frozen install 首爆（见 changelogs/2026-10-11.md）。
 *
 * 本脚本经 NODE_OPTIONS=--require 在 vite CLI 之前加载（dev 脚本 / e2e-vite-server.cjs），
 * patch `http.createServer`：vite 的 `_createServer` 是在 createServer() 返回**之后**
 * 才执行 `const listen = httpServer.listen.bind(httpServer)` 并覆写 listen 属性——
 * 所以我们在返回前把实例 listen 属性换成包装（bind 捕获到的即本包装），实现：
 *   ① 实例创建即真 bind 最终端口（CLI --port/-p 覆盖 > 默认 3001）→ 端口秒可连；
 *   ② vite 上层包装 init 完成后回调 listen：已 listening → noop+回调（避免
 *      ERR_SERVER_ALREADY_LISTEN）；未 listening（早期 bind 撞 EADDRINUSE 被自吞）
 *      → 照常真 bind，vite 标准 port+1 重试链完整保留；
 *   ③ 防御：若上层传入端口与早期实际绑定端口不一致（cjs 默认值与 vite.config
 *      漂移等场景）→ close 后按新端口重 bind。
 * 仅装饰本进程第一个 createServer 实例（vite dev 主 server；HMR ws 复用同一 server），
 * 后续实例原样返回。VITE_NO_EARLY_BIND=1 可整体关闭。
 *
 * ⚠️ 默认端口/宿主与 vite.config.ts server.port/host 是两处常量（cjs 读不了 TS 配置）：
 *    改 vite.config 端口时同步这里；即便漂移，③ 的端口不一致检测会纠偏，不致错绑。
 */
'use strict'
const http = require('node:http')

if (!process.env.VITE_NO_EARLY_BIND && !http.createServer.__kinotvEarlyBind) {
  const DEFAULT_PORT = 3001
  const DEFAULT_HOST = '::'

  /** 解析 CLI 覆盖的 --port / -p / --host（近似 cac：只识别显式值形态） */
  function readCliOverride(flagLong, flagShort) {
    const argv = process.argv
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i]
      if (a === flagLong || (flagShort && a === flagShort)) return argv[i + 1]
      if (a.startsWith(flagLong + '=')) return a.slice(flagLong.length + 1)
    }
    return undefined
  }

  const origCreateServer = http.createServer
  const decorated = function createServerPatched(...args) {
    const srv = origCreateServer.apply(this, args)
    http.createServer.__kinotvEarlyBind = true // 只装饰第一个实例
    http.createServer = origCreateServer
    if (!srv.listen || typeof srv.listen !== 'function') return srv // 非常规实例（如 http2）原样
    const realListen = srv.listen.bind(srv)
    srv.listen = function wrappedListen(...largs) {
      const cb = largs.find((a) => typeof a === 'function')
      if (srv.listening) {
        const addr = srv.address()
        const wantPort = typeof largs[0] === 'number' ? largs[0] : Number(largs[0])
        const bound = addr && typeof addr === 'object' ? addr.port : undefined
        if (Number.isFinite(wantPort) && wantPort !== 0 && bound !== undefined && wantPort !== bound) {
          // ③ 端口漂移纠偏：关掉早期绑定，按上层期望参数重 bind
          srv.close(() => realListen(...largs))
          return srv
        }
        if (cb) queueMicrotask(cb)
        return srv
      }
      return realListen(...largs)
    }
    // ① 早期 bind：host 只接受字符串（多 host 数组等非常规形态直接放弃，宁缺毋错）
    const portArg = readCliOverride('--port', '-p')
    const port = portArg !== undefined ? Number(portArg) : DEFAULT_PORT
    const hostArg = readCliOverride('--host')
    const host = hostArg !== undefined && !hostArg.startsWith('-') ? hostArg : DEFAULT_HOST
    if (Number.isFinite(port)) {
      // 失败自吞（once 拦截，防 'error' 无监听者抛未捕获异常）：
      // vite 上层 listen 随后照常真 bind，走标准 EADDRINUSE port+1 重试链。
      const swallow = () => srv.removeListener('error', swallow)
      srv.once('error', swallow)
      try {
        realListen(port, host)
      } catch {
        /* 同步异常回退 vite 原路径 */
      }
    }
    return srv
  }
  http.createServer = decorated
}
