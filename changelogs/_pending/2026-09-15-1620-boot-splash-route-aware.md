---
date: 2026-09-15
module: index.html
type: feat
build: vite build 通过（tsc -b 因既有 LazyImage TS2322 失败，与本次无关）
files: ['index.html']
demo:
---

## 启动骨架按路由变形（消除非首页刷新的「结构错构」）

- 日期：2026-09-15
- 问题：在 `/iptv`、`/collections`、`/browse` 等任意非首页硬刷新（F5 / 直输 URL / Capacitor 冷启动）时，都会先看到一套**首页形态**的启动骨架（hero 16:9 扁条 + 一行竖版海报卡），随后跳变到目标页真实结构。观感上像「先闪一下首页再变成别的页」。
- 旧逻辑：`#boot-splash` 是 `index.html` 里写死的一套 DOM（`.bs-hero` + 一行 8 张 `.bs-card`，仅随视口 `--card-cols` 分档），**没有按路由分支的代码**。原因是单入口 SPA：全站只有一份 `index.html`（`dist/` 内亦然），Vite dev 与 Cloudflare Pages 的 SPA fallback 把任意路径都返回同一份 HTML；`main.tsx:58` 的摘除条件只看 `#root.childElementCount > 0`，与 `location.pathname` 无关。因此「非首页刷新看到首页骨架」是必然结果。
- 新逻辑：`index.html` 内联脚本（零依赖、不引用任何外部资源、无 `100dvh`、保持 `pointer-events:none`）读取 `location`（含 hash 路由 `#!` 与 `#/` 两种形态）判定页型，**在 HTML 解析期就地重建骨架 DOM**，10 种形态：

  | shape | 触发路径 | 骨架形态 |
  | --- | --- | --- |
  | `home` | `/` | 复用静态 HTML 原骨架，不改建 |
  | `iptv` | `/iptv` | 左栏分类 + 频道网格（`--iptv-cols` 分档） |
  | `play` | `/iptv/play` | 播放器骨架 + 提示文案「正在打开播放器…」 |
  | `browse` | `/browse` | 筛选条 + 卡网格 |
  | `chart` | `/chart` | 筛选条 + 榜单行 |
  | `collections` | `/collections` | 双分区头 + 记录卡网格 |
  | `history` | `/history` | 分区头 + 记录卡网格 |
  | `detail` | `/detail/*` | hero + 文本块 |
  | `person` | `/person/*` | 人物头 + 文本块 |
  | `plain` | 其余（`/settings`、`/source-checker`…） | 仅顶栏 + 居中「正在启动…」，中性兜底 |

  - 列数分档与真实网格**逐档对齐 token**：海报网格 `3 →4(768) →5(1024) →6(1280) →7(1440) →8(1920)`（`--card-cols`）；频道网格 `2 →3(768) →4(1024) →5(1440)`（`--iptv-cols`）。
  - 设备档与 `AppLayout` 的 `data-device` 同源语义，新增 `#boot-splash[data-cols="tv"|"app"]` 覆盖档，**恒定不随视口流动**（tv：海报 8 / 频道 5；app：海报 3 / 频道 2）。
  - 封面比例按卡型分：`.bs-row` 海报 2:3 / `.bs-row--channel` 频道 3:2 / `.bs-row--record` 记录卡 16:9 + 两行文字条。
  - IPTV 左栏阈值与真实页一致：`1024` 起显示，默认 `display:none`。
- 涉及文件：`index.html`（+199 / −12，脚本 5670 字符，全部内联在 `<style>` / `<script>`，零外部请求）
- 关联 Demo：无（启动骨架为纯 HTML/CSS 结构，形态核对以逐路由几何读回为准）
- 构建：`vite build` 通过（15.19s），产物 `dist/index.html` 已含 `data-shape` / `bs-rail` / `bs-split`。`npm run build` 首步 `tsc -b` 报**既有**错误 `src/components/LazyImage/LazyImage.tsx(236,5): TS2322 Type 'number' is not assignable to type 'Timeout'`（与本次改动无关，绕过方式：直接调 `vite build`）。
- 验证：沙箱内 Playwright/Chromium 合成器不产帧（`page.screenshot` 与 CDP `Page.captureScreenshot` 均挂），改用 **jsdom 离线跑分支脚本 + 几何读回**，17 个用例全绿 + 列数交叉核对 0 漂移：

  ```
  OK  /  /iptv  /iptv/play  /collections  /history  /browse  /chart
  OK  /detail/603  /person/1234  /settings      （shape 与期望全一致）
  OK  /  /#/  /#/iptv  /collections/            （hash 与尾斜杠形态）
  OK  / [tv]  /iptv [tv]  /iptv [app]           （设备档覆盖）
  390/768/1024/1280/1440/1920/2200/2560/3840 海报 3-4-5-6-7-8-8-8-8  频道 2-3-4-4-5-5-5-5-5
  IPTV 左栏阈值 1024 起显示 OK / 默认 display:none OK
  列数漂移档数=0   ALL_PASS
  ```
- 备注：改动已随 `59ab4e8 docs(design): …+ 启动骨架/白名单留痕` 入库（并行会话一并提交）。
