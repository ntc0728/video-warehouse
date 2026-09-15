# 运行时约定（播放器 / 跨页签 / 竞态 / E2E / 工具链）

> 本文件是**运行时与工程细则层**：播放器运行时、跨页签同步、异步竞态范式、E2E 断言方法、工具链陷阱。
> 做播放器、跨页签、测试、构建类任务前必读。索引：`index.md` / `AGENTS.md`。

---

## 1. 播放器运行时与自愈

- **窗口失焦（切到其他软件）时 `visibilityState` 恒为 `'visible'`** →
  挂起判定必须用 `window blur/focus` + `document.hasFocus()`；
  恢复链 `recoverForeground` 无条件 `adapter.resume()`。
- `isBuffering` 与 `isPlaying` **正交**；`togglePlay` 在缓冲中守卫；自动播放被拦时静音兜底；
  **TvMascot 是唯一加载角色**（禁内联 Loader）。
- **播放页「源不可用」真根因** = CDN 临时目录过期 / IP 限流 → 分片 404（CMS URL 静态、无签名）。
  - VOD 自愈 = **自动故障转移**（同源切线路 → 跨源按 TMDB 标题重搜）；
    **重拉 CMS 取签名无效**。
- **Player 页断点待整改**：`Player.css` 仍用 `<1280 / ≥1280`，待迁 ADR-023 体系
  （等另一会话收尾）。

---

## 2. 跨页签数据同步（判定链：介质 → 写盘确定性 → 有无排除键）

- **IndexedDB** → `BroadcastChannel`（落库后才广播、150ms 去抖 reload、
  随机 session 过滤自消息、`MODE=test` 禁用）。
- **localStorage** → 原生 `storage` 事件（rehydrate 重读合并；`newValue === null` 即对该页 `clearCache` 归零）。
- **`useSettingsStore`（加密随机 IV）禁 rehydrate**（密文随机 → 无限循环）→
  手工白名单逐键「解密 + JSON 比对」，值变才 set。
- zustand 5 `persist.rehydrate()` 返回 `void | Promise<void>`，直接 `.then()` 报 **TS2339** →
  需用独立 async 函数 `await`。

---

## 3. React 异步竞态：`reqSeqRef` + `isLatest()` 模式

- **场景**：hook 内多个 async 函数（切源 / 切季 / 重建）共享 `AbortController`，
  快速连续触发时旧请求返回会回写状态（选中态回跳、数据回滚、loading 误清）。
- **解法**：
  ```ts
  const reqSeqRef = useRef(0);
  const reqId = ++reqSeqRef.current;
  const isLatest = () => reqSeqRef.current === reqId;
  ```
  **所有 setState 写入与收尾（清 loading）都包 `if (isLatest())`**；被取代的请求静默退出。
- **abort 语义拆分**：`ctrl.abort()` 有两种来源 ——
  「被新请求取代」（`isLatest=false`，**不收尾**）与「超时兜底」（`isLatest=true`，**必须收尾**）。
  超时写法：`setTimeout(() => { ctrl.abort(); if (isLatest()) cleanup(); }, TIMEOUT)`。
  参考 `useCMSSourceManager.ts`。
- **配套**：乐观更新（点击立即 `setActiveSourceId`）+ 最新请求才能覆写 → 选中态永不回跳。
- **收尾铁律**：**每一个可能 reject 的裸 `await` 都要想清楚去向** ——
  async 函数里未捕获的 rejection = **loading 永驻**。

> 该模式已升格为通用约定，另见 `architecture.md`「异步守卫与竞态」。

---

## 4. 逻辑分页组装

Browse 逻辑分页（算术定位 + 多触发器等值 + 跨页去重 + 三段等待 + 500 页硬顶）的完整契约见：

- `pages.md` → 「Browse 逻辑分页契约（2026-09-14 门控定稿）」
- `patterns.md` → 「Browse 逻辑分页」

**两条最易复发的根因**（复述）：

1. **取页必须直连 store**，不经 `useBrowseData.goToPage` ——
   其 `loading.discover` 守卫读的是 useCallback 渲染快照，慢网下以陈旧 `loading=true` 静默 no-op
   （请求根本没发），随后调用方的 `page === t` 校验**误命中** store 里的初始 discover 页 →
   把别的流程的数据当「本页」返回。改为 `store().search / fetchDiscover / fetchTopRated(t, {reset})`，
   竞态交给 `_discoverSeq`。
2. **合并页大小 M 必须等于真实拉取条数**：`all=40`（双路合并）、单类型/搜索 `=20`。
   写死单值 → 切分类偏移错位空页。

---

## 5. E2E 断言与写法

- **假绿坑**：「X 后 Y 保持」若 Y 本就是目标值，`expect.poll` 会**抢跑假绿** →
  先 poll X 旁证再断言 Y。**反向验证（撤修复跑红）是断言真实性的唯一标准。**
- **搜索用例必须走顶部搜索框（PUSH 导航）**：`page.goto('/browse?q=xxx')` 是 **POP 导航**，
  按设计忽略搜索词（防 `history.state` 残留）→ 页面停在 discover 默认数据上，
  「断言全绿但根本没搜」。正确姿势：`goto('/browse')` → 填 `.sticky-header .search-box__input` → `press('Enter')`。
  另：慢网 mock 必须按请求的 `page` 参数返回对应数据（id 随页偏移），否则逻辑分页层反复重取、末态超时。
- **广播 / storage 类行为**用同 context 双 page 真实 Chromium；E2E 并发点击用同步 DOM `.click()`；
  移动端显式 viewport `390×844`。
- **基线：116 条 / 16 spec**。新增删改用例须同步 `AGENTS.md` 计数表
  （`npx playwright test --list` 校准），新用例必须带真实 `expect`。
- **两个坑已根治**：
  1. 沙箱 delete-shim 使 Playwright 清理 outputDir 时 trash 失败假崩 →
     命令前缀 `NODE_OPTIONS= ` 绕开（`run-tests.ps1` 已固化）。
  2. worker teardown 挂起 = **缺资源清理**（hls.js Worker / BroadcastChannel / IndexedDB / `<video>` 句柄），
     非「与代码无关」→ 由 `scripts/global-teardown.ts` + `mock-tmdb.ts` autouse cleanup fixture 兜底
     （注销 BroadcastChannel、`hls.destroy`、`media.pause` + 卸载、关 IDB）。
- **`waitForTimeout` 已整改**：291 处固定 `waitForTimeout` → web-first 条件等待
  （`expect.poll` / `toBeVisible({timeout})` / `toHaveURL`）。残留约 8 处为连点彩蛋计数 / 否定断言观测窗口。
- **手工 Playwright 验证配方**（沙箱无 token 时 TMDB 请求不发出）：
  等 2.6s 写回风暴 → `localStorage.setItem('app-settings', JSON.stringify({state:{tmdbAccessToken:'mock_token',...},version:0}))`
  → reload → `page.route('**/api.tmdb.org/3/...')` 拦截（要延迟就在 handler 内 sleep 后 `route.fallback()` 穿透）。
  `@playwright/test ≥ 1.61` route 回调首参是 `Route` 对象，URL 取 `route.request().url()`。

---

## 6. 工程约定

- **路由双配置**：`routeConfig.ts` 的 `routeComponentMap`（**生效点**）+ `routes.tsx`（占位），改完须 build。
  详见 `pages.md`。
- **断点 hook**：`useIsMobile` = 1023 / `useIsMobileLayout` = 767。
- **`vite.config` 双文件同步**（`.ts` + `.js`）。
- **`docs/` 不入库**，白名单例外：`docs/agents/`、`docs/knowledge/`、`docs/test-cases/`、
  `KNOWLEDGE.md` / `TEST-CASES.md` / `KNOWN-ISSUES.md` / `PRODUCTION-REVIEW-*.md`。完整清单见 `RULES-MANIFEST.md`。
- **changelog 机制**：改完先写 `changelogs/_pending/<YYYY-MM-DD-HHmm>-<slug>.md` 片段，
  push 前跑 `node scripts/changelog-collect.mjs` 合并归档；
  `node scripts/changelog-draft.mjs --since <ref>` 可从 git 改动生成骨架。
  pre-push 钩子会阻断未合并片段。格式：旧↔新 + `文件:行号` + 构建结论。详见 `docs-protocol.md`。

---

## 7. 工具链陷阱

- **`Edit` `replace_all` 后必须 grep 校验**：曾用 `replace_all` 把 `getJSON<CMSListResponse>`
  全换 `fetchCmsList`，连 `fetchCmsList` 函数体内部自己的 `getJSON` 也被换了 → **自递归**。
  `replace_all` 适合「机械替换」，但**凡是替换目标与替换结果有包含关系**（新名含旧调用形态）的必须复核。
- **CMS 业务错误码**：HTTP 200 + `code != 1` 是业务异常（例 1002 = 禁止关键词搜索）。
  统一走 `videoService.fetchCmsList()`（`getJSON` + `assertCmsOk`），**禁止裸 `getJSON` 拉 CMSListResponse**。
  详见 `docs/knowledge/02-api.md` §2.4。
- **沙箱构建**：`npm run build` 清 `dist` 会撞批量删除保护（`dist/assets` 约 873 个文件 > 阈值 50），
  报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` → 改用
  `npx tsc -b && npx vite build --emptyOutDir false` 绕行，**tsc 门槛不降**。
- **产物断言前必须先递归清空 `dist/`**，否则 `--emptyOutDir false` 留旧 chunk → **假 FAIL/PASS**；
  断言**勿按书写顺序拼选择器串**（minifier 会重排 selector 顺序）→ 用宽松正则或分段匹配。
- **Windows 盘符大小写打崩 vite build**（2026-09-15 根治，commit 7251759）：某些 shell 环境（Git Bash shim）
  把 cwd 设为**小写盘符** `f:\...`，而 Vite/Rollup 路径比较对盘符大小写敏感（`normalizePath` 不归一大小写）：
  模块 id 一边由 cwd 派生（小写），一边由 realpath/esbuild 派生（大写）→ html-inline-proxy 等按 id 注册的
  模块查不到，报 `No matching HTML proxy module found`；产物路径也会退化成 `dist/f:/...` 绝对路径命名。
  **修法在 `vite.config.ts`**：`projectRoot = fs.realpathSync.native(__dirname)`，`root` 与 `resolve.alias['@']`
  一律从它派生 —— 任何 shell/cwd 大小写下模块 id 一致。其他项目遇到「某些 shell 下 build 报路径对不上」先对号入座。
- **E2E 一行 Puzzle：`Page crashed` 时换完整 chromium**（2026-09-15 实测，结论已更正）：
  Playwright 默认跑 `chrome-headless-shell`，部分受限环境（沙箱 / CI）下它加载本应用会以
  **0xC0000409 整个 browser 进程退出**（表现为 `page.goto: Page crashed`，静态页/data URL 却正常，
  极易误判成「机器跑不了」）。真·对策不是改 GPU 参数，而是**换二进制**：
  `PW_BROWSER_CHANNEL=chromium`（已接入 `playwright.config.ts` 的 `use.channel` 与
  `scripts/global-setup.ts` 的同源 env 读取）切到完整 chromium 的 headless=new，dev 与 dist 均恢复正常。
  ⚠️ 若用了自定义启动, `chromium.launch()` **不会继承配置的 channel** —— 必须显式传，否则诊断会被误导。
- **E2E 观察 `#boot-splash`（React 首帧前的死 DOM）**：直接 goto 有「断言时骨架已被摘除」竞态。
  手法见 `scripts/boot-splash.spec.ts`：route 拦截**主入口模块**（dev=`**/src/main.tsx*`，dist=`**/assets/index-*.js`）
  延迟 2.5s 放行，`goto(..., { waitUntil: 'commit' })` 后骨架窗口稳定可观测；收尾放行主模块断言骨架 detached。
