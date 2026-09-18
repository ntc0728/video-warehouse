---
date: 2026-09-18 18:20
module: skeleton
type: refactor
build: tsc -b 0 err / eslint 改动文件 0 新增 / stylelint 0 问题 / vite build 过 / skeleton.spec.ts 18 passed (19s)
---

# 2026-09-18 骨架整改：结构同构 + 视口填充 + gate 下沉，并修掉「E2E 必卡死」

## 背景

用户指出三条未落地的问题：

1. **固定行数**：Chart/History/Person/Browse 等卡骨架写死 ROWS，视口拉高后下方一片空白。
2. **已知常量当未知**：Browse 类型数（7）、排序数（3）、IPTV 分类数、Detail tab 数（2）、
   推荐区数（2）、剧照数（6）本就是常量，骨架不该「随便糊几块」。
3. **gate 位置错**：`App.tsx` 用 `dbReady` 在 App 层挡住渲染 → History/Collections 的页级
   骨架**永远是死代码**（等待被上层吃掉），所以「改了也不生效」。

## 改动

### 一、gate 下沉（App.tsx）

- 删 `useState dbReady` 与 `AppLoading` 早返回；`loadFromDB()` 移入 `useEffect` 直发。
- 页面自读 `useUserStore._loading` 决定骨架 —— History/Collections 的骨架窗口**首次真正存在**
  （旧编号 SKEL-010 上挂的 `test.skip` 随之删除）。

### 二、行数按视口实测（useFillRows 重写）

- 语义由「返回要追加的 extra 行」改为「**返回总行数**」：量已渲染首行的真实 step
  （行高 + 行 gap）→ `ceil((视口可见底 − 网格顶 − reserve) / step)`。
- 视口底取 `useScrollContainer()`（`.app-shell__scroll`），**不是 window**；
  cols 变化（跨断点）回落到 `minRows` 重新收敛。
- 接入 Browse / Person / Chart / History / Collections（影视 + 直播双网格）/ IPTV / Detail。

### 三、结构与已知常量同构

- Explore/浏览类：Browse 类型 pill = `CATEGORY_CONFIG` 键数、排序 pill = `SORT_OPTIONS.length`；
  IPTV 分类 = `IPTV_CATEGORIES.length(+__other__)`、源 = `aggregatorUrls.length`。
- Detail：补 tab 条 / 演员行 / 简介 / 剧照 / 两个推荐区，数量全部取自真源常量。
- IPTV：左栏复刻真实结构（分类 + `__sep` + 「更多台」`__box`）+ content-bar + `.iptv-sec`。
- Home：删掉 `Home.css` 里 ~222 行**手搓骨架几何**与 `index.css` 的 ≥1024 覆盖，
  改渲染**真实组件**（`TMDBMovieRow isLoading` / `CategoryHeatRow variant="rail"` /
  `SkeletonCards`），并补上漏掉的「继续观看」行 —— 骨架与真实共用同一套几何，
  不可能再漂移。`SkeletonCards` 由局部函数改为具名导出。
- Android 深色启动图：`sharp` 合成 → `res/drawable-night*/splash.png` 11 张。

## 四、骨架 E2E 修复（本轮最大块时间）

`playwright test scripts/skeleton.spec.ts` 在本机**必卡死 / 十几分钟**，拆出两个独立病因：

### 病因 A：僵尸 :3001 → 每条 goto 白耗 45s 超时（与代码无关）

Vite dev server 会进入「TCP 仍 LISTENING、HTTP 永不响应」状态。此时
`webServer.reuseExistingServer` 判不出可复用、又起不来新的（端口被占 / npm shim 失效），
`use.baseURL` 指向死端口 → **18 条 × 45s ≈ 13.5 分钟**，且 reporter 只在进程结束吐日志
→ 体感「卡死」。首条 `globalSetup` 的 `page.goto` 就挂住，所以连一条日志都没有。

对策（新增 `scripts/e2e-skeleton.mjs`，已入 .gitignore 白名单）：

- 强杀 :3001 持有者 + 遗留 chrome；
- 默认改用 **`vite preview` 跑 dist**：页面加载由「秒级模块图」降到百毫秒；
  生产包把全部页面 CSS 打进单一 bundle → **契约 B 的注入探针不再依赖路由 chunk**；
- **HTTP 健康轮询到 200 才开跑**（杜绝「TCP 通但 HTTP 不通」的假就绪）；
- `--timeout=30000 --global-timeout=420000` 双封顶，最坏也必然退出；
- 无论成败收尾：杀 server 进程树 + 清 `.pw-out-skel`（该目录未被 .gitignore 覆盖）+ 清 chrome。

`playwright.config.ts` 的 `webServer.command` 由 `npm run dev` 改为
`"${process.execPath}" node_modules/vite/bin/vite.js`，`timeout` 30s→60s：
绕开 npm shim，且不再出现「静默换端口 → baseURL 指死端口」。

### 病因 B：spec 自身的四个硬伤（逐条实测定位）

| # | 症状 | 真因 | 修法 |
| --- | --- | --- | --- |
| 1 | History 骨架列数读成 `-1` | History.css 规则是 `.history-content .history-group-body .history-grid`，探针只注入了 `.history-grid` → grid 未生效 | 探针骨架侧补全祖先链（骨架根本身也叫 `history-content`，容易漏一层） |
| 2 | Detail 骨架永远不存在 | id 格式实为 `tmdb-<mediaType>-<tmdbId>`。写 `/detail/550` → `暂仅支持 TMDB 影片`；写 `/detail/tmdb-550` → `parseInt('')`=NaN → `无效的 TMDB ID`。两种都不请求 TMDB = 永无 loading 窗口 | 用 `/detail/tmdb-movie-550` |
| 3 | History/Collections 骨架不存在，页面反而显示「读取失败」 | `holdIndexedDB` 挂 `indexedDB.open`：idb 的 `wrap()` **只对 `instanceof IDBRequest` 走 promisify，其它值原样返回**，紧接着调用方 `.then()` → `TypeError: d.then is not a function` 从 idb 内部抛出，`_loadFromDB` 立刻落 catch → 错误态 | 替身补 `then/catch/finally`；并改为**让 open 正常成功、只挂「读」**（`IDBObjectStore/IDBIndex` 的 getAll/get/count/...）→ 出口不再是 `DB_OPEN_TIMEOUT=6000`，**窗口无限长** |
| 4 | `/player` 启动骨架读成 `shape=home` | `waitUntil:'commit'` 只保证响应开始，body 末尾那段写 `data-shape` 的经典内联脚本可能尚未执行，读到的是 HTML 静态默认值；`/play` 只是碰巧先跑完 | goto 后加 `waitForFunction(() => document.readyState !== 'loading')` |

另外把 `holdTmdb` 默认延迟 6000→10000ms（12s for SKEL-015）：延迟发生在后台 route handler，
不占测试时长，但 6s 对「多条结构断言」偏紧。

## 验证

- `node scripts/e2e-skeleton.mjs` → **18 passed / 19s**（此前：卡死 10min+ / 0 输出）。
- `tsc -b` 0 err；`vite build` 过；`stylelint src/**/*.css` 0 问题；eslint 改动文件 0 新增。
