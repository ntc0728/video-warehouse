---
date: 2026-10-10 14:27
module: Vite Dev（冷启动）
type: perf
build: pass
files:
  - vite.config.ts
demo: 无
---

# dev 冷启动 early-HTML：document 白屏 hold 2.1s/8.6s → ~1s

## 问题

- 本地 `npm run dev` 冷启动后页面长时间纯白屏，**浏览器 Network 里没有任何 JS/API 请求**（不是慢，是 document 本身没回来）；boot-splash 骨架救不了 —— HTML 没到，内联骨架无从执行。
- 缓存命中场景 document 被 hold 至 ~2.1s；`node_modules/.vite/deps` 缓存失效（re-optimize，如改 vite.config 后）hold ~8.6s。

## 根因（探针实测，拆两段）

1. **请求进入 connect 栈即被事件循环排队**：Vite 启动后 `depsOptimizer.init()`（scan + esbuild optimize）占用主线程，实测端口 ~400ms 已 bind（TCP 可连、Vite ready 日志已打），但 HTTP 请求的 middleware enter 延迟到 ~1s。
2. **`server.transformIndexHtml` 自身再耗 ~1.3s**：内部 `devHtmlHook` 的 `preTransformRequest`（warmup `/src/main.tsx`）与 init 争抢事件循环 —— 早期版本 early 中间件即便最先注册，走 transformIndexHtml 实测仍 2526ms，方案无效。

## 方案

`early-index-html` 插件（`configureServer` 内最先 use）：GET / 无扩展名 / Accept:text/html 的 document 请求直接读磁盘 `index.html`，**绕过 `transformIndexHtml`**，手动注入与 Vite dev 输出等价的三要素后立即 200：

1. `injectLayoutTokensHtml`（复用单真源函数，与 `inject-layout-tokens` 插件同源）
2. `/@vite/client`（Vite dev 公开约定，devHtmlHook 同款 head-prepend）
3. react preamble（@vitejs/plugin-react 公开约定，`__vite_plugin_react_preamble_installed__` 检测变量同款）

三者均为长期稳定公开约定；若未来注入过时，症状仅 HMR 降级（console 警告 + 整页刷新），页面功能不受影响。模块请求（`/src/*.tsx`、`/@vite/client` 等）不被接管，仍由 Vite 正常排队至 init 完成。调试打点：`VITE_EARLY_HTML_DEBUG=1`。

## 对照

| 场景 | 旧 | 新 |
| --- | --- | --- |
| 冷启动 document 首字节（deps 缓存命中，系统空闲时） | 2147ms | 1042ms（空闲时 346ms） |
| early 中间件处理耗时 | transformIndexHtml 1355ms | 读文件+注入 1ms |
| deps 缓存失效 re-optimize | 8630ms | ~1.2s（enter 受事件循环排队下限约束） |
| HTML 输出 vs 稳态正常路径 | — | **字节级完全一致（69666B == 69666B）** |

剩余下限（~1s 内的 enter 延迟）是 init 扫描占用事件循环的物理排队，属 Vite 单线程模型约束，无法在中间件层消除；收益是骨架随 HTML 立即渲染（原 2.1s/8.6s 完全无内容）。

## 验证

- `npm run lint:all` 七门全绿（design/css/json/version-sync/test-map/eslint/build 30.2s）
- `npm run test:e2e:boot-iso` 42 passed（冷启动骨架同构回归）
- `npm run test:e2e:skeleton` 36 passed / 1 failed —— 失败为 SKEL-014 **既有失败**：`FILL_CHIPS=14`（ff5930f，10-09）未同步 spec 期望 `6+8+8=22`，实际理论值 73（20+26+27）与实测吻合，判界与本次改动无关（见另行汇报）。
