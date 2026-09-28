# 方案C 收口：cqa chip 面板回滚 / FAB 恒显 / 继续观看单行 / 删 data-badge / 移动端 banner 重排

- date: 2026-09-29 04:10
- module: demos/home-style-e-typographic.html
- type: fix
- build: lint:all 7 门全绿 + smoke SMOKE OK + check-demo ALL OK + playwright 临时 spec 截图实证（1 passed / 0 pageerror，spec 跑完已删）
- files: demos/home-style-e-typographic.html (+96/−196，净 −100 行)

## 旧 ↔ 新

1. **分类 chip 面板回滚（用户：「cqa 怎么没改回去」——「采用方案C」= 面板回静态链接）**：顶栏恢复 7 静态链接（首页/剧集/电影/综艺/动漫/榜单/IPTV，首页 .on 高亮，IPTV 归回左侧），IPTV 从 nav-fn 左移归位；删 `.cqa/.cqa-chip/.cqa-panel/.cqa-sub` CSS 23 行、`cqa-panel` div、`CAT_SUBS/catSubs/catList/initCat` JS 整段（~120 行）与 `initCat()` 调用、booting 数组 8 chip id、头注释①方案 B 描述。`showPanel/runSearch` 拆分保留（无害重构，smoke 仍用）。
2. **FAB 恒显 + 贴角（用户两轮：「直接看不到」→「查看下位置」——发截图显示 FAB 压住卡片标题）**：
   - 可见性：删「>280 + 滚动中淡出 + 停 800ms 淡入」延迟链，CSS 默认态 `opacity:1` 恒显，JS 只留回顶/刷新点击（截图实证旧逻辑顶部 opacity=0 即抱怨点）。
   - 位置：上轮 `right/bottom 外扩(24-48/28-52)` 方向反了（数值越大越深入内容区）→ 按项目 `fab-stack` 口径（用户曾拍板贴视口右缘 8–9.5px）收回 `right:clamp(8,1vw,14) / bottom:clamp(10,1.6vh,22)`、按钮 38-46→36-42、767 档 8/12（44px 触屏区保留）。
   - 观感：实色纸底+硬阴影 → `color-mix(paper 80%, transparent)` + `blur(8px) saturate(160%)` 玻璃半透 + 柔投影（覆盖内容时透出底图，弱化压卡），hover 同步半透 band。截图实证（644 窗）：贴角后仅盖卡右下无信息区、标题不遮。
3. **继续观看恒一行（用户：「只允许显示一行」）**：`renderContinue` 固定 6 条（原读 `--cont-n` 4/5/6 浮动 → 1440 档 5 列出现 5+1 换行）；`.cont-grid` grid 改 **flex 单行横滚**（scroll-snap + 隐藏滚动条），`.cont-cell` 可视 6 张（≤1023 4 张 / ≤767 3 张）；`--cont-n` 变量 8 处定义全删（已无消费者）。截图：桌面 6 卡整行 ✓ 手机 3 卡横滚 ✓。
4. **删 data-badge**：顶栏「真实接口拉取中…」徽章 HTML span、`.data-badge` CSS 2 条、booting selector `#data-badge`、`renderMasthead` 赋值 3 行、头注释「数据徽章」字样全清。
5. **移动端 banner 重排（截图诊断：文上图下 + 眉批「每日趋势」折行孤字 + deck 3 行过满）**：≤1023 块 `.hl-pic{order:-1}` 图上文下、`.hl-text` 图下留白、眉批 nowrap+ellipsis 防折行、deck 收 2 行。
6. **诊断留痕**：临时 spec `scripts/tmp-demo-snap.spec.ts` 经 `e2e-skeleton.mjs` 调试档（120s/0 重试/preview）截桌面顶部+滚动后、手机首屏+banner+继续观看 5 图，用完即删不入映射；期间误触 `--help`（skeleton 无此参数直接跑批）已确认进程/端口零残留（PID 7328 退、53784 无 LISTEN）。

6. **移动端 banner 紧凑 + mast-nav 分组（用户：「hl-text 占大幅 + 标题巨大 + mast-nav 互相挤压」，834×1194 截图诊断）**：
   - h1 原 `clamp(26px,4.6vh,54px)` 是 **vh 驱动**，高视口（1194）冲满 54px 两行巨标 → ≤1023 改 `clamp(25px,5vw,34px)`（vw 驱动封顶 34）。
   - hl-text 间距原全 `2vh` 档（高视口取满 max）→ padding 10/6、kick 6、h1 8、deck 10 + 行高 1.65 + 2 行、meta 12/gap10 固定小值：**实测 hl-text 190px（原 ~400）**，banner 总 667，首屏 1194 内已见 01 区。
   - masthead 收紧：`.masthead` pt 12、`.mast-nav` `gap:10px 14px / padding:6px 0`（行距分组清晰）——834 下 links+fn **单行放下**（navH 35，原两行换行挤压），更窄时换行行距 10 不贴死。
7. **lint:test-map 修复**：生成块过期（与本次改码无关的计数漂移）→ `npm run test:count -- --write` 同步 `docs/agents/testing.md`（+3/−4 行）。

## 验证

- check-demo ALL OK（ids=31 refs=24 缺失 0）；smoke 全过（chip 12 断言已删，cont 断言改 `=== 6`）。
- `npm run lint:all` 7 门全绿（含 lint:test-map，`--write` 后复跑通过）。
- 截图实证三轮：FAB 贴角 right=8/bottom=12 玻璃半透盖卡角不盖标题；继续观看桌面 6 卡单行/手机 3 卡横滚；834×1194 banner 紧凑（h1 34px / hl-text 190 / nav 单行）。临时 spec 三个跑完即删（skeleton 调试档 120s/0 重试，0 pageerror）。
