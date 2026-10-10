---
date: 2026-09-30 02:00
module: Detail 页（去卡片化 · 死代码清理）+ 测试侧（detail.spec DETAIL-062 纠偏）
type: refactor
build: pass
files:
  - src/pages/Detail/Detail.css
  - src/pages/Settings/Settings.css
  - scripts/detail.spec.ts
  - docs/agents/testing.md
---

# Detail 页去卡片化（第二批）+ Detail.css 死代码清理 + DETAIL-062 选择器纠偏

## 需求

用户三连反馈：①「detail 页元素去卡片化不彻底」；②「detail-source-group 仍要保留卡片化」；
③ 承接「清理 Detail.css 的死代码」；④「一并修这个 spec」→「跑一次确认下」→「实施沉淀」。

## 修法

**① 去卡片化（第二批）** — 2026-09-28 那轮只处理了 `.detail-hero-side`（≥1024 块内），页面主体仍留四件套。

- 覆盖块（追加在 `Detail.css` 末尾，判据同 Chart / SourceChecker）：
  `@media (width >= 768px) { html:not([data-device="app"]):not([data-device="tv"]) … }`
  作用于 `.detail-content`（三 tab 共用容器，L483 原四件套齐全）+ `.detail-recommend`
  （相关推荐 / 你可能还喜欢，L1547）。
- **用户二次修正**：`.detail-source-group`（匹配结果内每个 CMS 源一张）**仍保留卡片** → 已从覆盖块移除。
  理由（用户给）：去容器卡后，源卡是该区块唯一视觉容器。
- 保留项（用户「都不动」）：hero 大图圆角、hero 右侧海报卡、类型标签 chip、弹窗内行卡；
  封面 / 剧照 / 骨架 / 控件按 2026-09-28 惯例本就豁免。`.detail-season-card`（季信息）不在范围。
- 连带：`.detail-content` 是三个 tab 的**共用容器**，去卡后季信息 tab 也一起失去外层容器卡
  （内部季卡保留）—— 已向用户说明，无法只对概览 / 播放列表去。

**② 死代码清理** — 方法：脚本抽取 `Detail.css` 全部 `.class` token（105 个），在 src + scripts +
index.html（391 个非 CSS 文件）做**整词匹配**（负向回溯 `(?![-\\w])` 防 `base--modifier` 误判），
零命中即死类 → 出清单复核后删。

删除 9 组 / 25 条规则 / 约 −338 行（2120 → 1757 行）：

| 删除对象 | 原用途 / 被谁取代 |
| --- | --- |
| `.detail-back-bar` / `.detail-back` / `.detail-not-found .detail-back` | 旧独立返回栏；现只有 hero 内 `.detail-hero-back` |
| `.detail-info-block`（4 条） | 旧「基础信息」块；现为 `.detail-info-card` 网格 |
| `.detail-info-item`（5 条，含 hover / svg / span / strong） | 旧 KV 卡；同上 |
| `.detail-sources-filter` / `.detail-sources-sort` | 旧筛选 / 排序控件；toolbar 现只剩 `.detail-sources-keyword` |
| `.detail-source-group-title` | 分组头现直接用 `.detail-source-name` + `--status` |
| **`.source-all-modal*` 全段**（23 条 + `≤767` 弹窗 media 块 + app 副本 = 216 行） | 已被 `PlaylistModal` 取代（`playlist-modal playlist-modal--<center\|sheet\|drawer>` + `modal-content-animate`，`PlaylistModal.tsx:750-754`） |
| `html:not([data-device="app"]) .detail-tab-content` | ≥1024 块内孤条 |
| `[data-device="tv"] .detail-chip` | TV 块内孤条 |

**③ DETAIL-062 纠偏** — 死码清理后 spec 仍引用已不存在的选择器，且原断言本身恒真。

- 核对方法（可复用）：抽取 spec 中 `locator()/waitForSelector()/filter()` 字符串里的 `.class` token，
  逐个在 src 全量文本 + 全部 `.css` 做包含匹配，零命中即死选择器。
- 替换映射（以真实 DOM 为准）：

  | 旧（已不存在） | 新 | 依据 |
  | --- | --- | --- |
  | `.source-all-modal` | `.playlist-modal` | `PlaylistModal.tsx:750` baseClass |
  | `.source-all-modal__row` | `.playlist-cell` | 弹窗条目基类（电影 `--line` / 剧集 `--ep`），`PlaylistModal.tsx:545-547` |
  | `.source-all-modal__play-btn` | `.playlist-cell`（`.first().click()`） | 点击走 Link / `handleCellClick` → `onPlayLine`/`onPlayEpisode` → `navigate('/play/')`，与原断言语义一致 |
  | `.detail-source-status--err` | 删除恒真断言，改「有源卡时不得出现非 `--ok` 状态类」+「无源卡时必须落到 `.detail-sources-empty`」 | 实现只产出 `--ok`（`Detail/index.tsx:1217` / `Detail.css:1000`），原 `count` 恒 0 = 永真假绿 |

- 另把「无全部按钮」分支里必然抛错的 `throw`（有源卡时又要求统一提示可见，逻辑互斥）改成源区终态断言
  `srcGroupCount > 0 || unifiedMsgVisible`，并给播放页断言加 `.first()`（`[class*="player"]` 会匹配多个元素）。

**④ 补真覆盖** — 首次实跑发现改后的用例虽绿、弹窗路径**一行未执行**（详见「验证」的探针证据）。
在 3.6 用例内追加一层 CMS route（不动 fixture、不影响其它 7 条用例）：

```ts
await page.route(/ac(?:=|%3D)videolist/i, (route) => route.fulfill({ …双线路电影条目… }));
// vod_play_url: '线路1$第1集$<url>$$$线路2$第1集$<url>' → parsePlaySources 产出 2 条 sources
```

- **顺序是命门**：Playwright 路由**后注册优先** → CMS route 必须在 abort route **之后**注册，否则被 abort 吃掉。
- 双线路是必须的 —— `.detail-source-all-btn` 渲染条件是 `isSeries || lineCount>1 || episodeCount>1`
  （`Detail/index.tsx:1244`），单线路不渲染「全部」按钮。
- `vod_id` / `vod_name` 对齐 `tmdb-movie-550`（Fight Club）保证关键词匹配通过。

## 验证

- **探针实证**（临时 `console.log`，跑完已撤，`PROBE` 残留 = 0）：
  `[PROBE-062] {"srcGroupCount":5,"unifiedMsgVisible":false,"hasAllBtn":true}` / `[PROBE-062-popup] 2`
  → 5 个源卡、「全部」按钮渲染、弹窗内 **2 个 `.playlist-cell`**、点击后 URL 落 `/play/`。
  **弹窗路径确实执行了，不再是空态绿。**
- 跑批（`e2e-skeleton.mjs`，preview）：detail.spec 全 8 条 `--budget 240` → **8 passed / 23.2s**；
  去探针后单条复跑 → **1 passed (2.7s) = 交付版本**。
- `playwright test scripts/detail.spec.ts --list` = 8 条，与映射一致；`test-count-report --check` ✓ 全一致。
- 死类扫描 105 → **0**；stylelint（Detail.css / Settings.css）exit 0；`tsc -b` exit 0；
  `vite build --emptyOutDir false` 通过；入口产物确认死类残留「无」、在用类仍在。
- 已知遗留（未动，改动区外）：`eslint --no-ignore scripts/detail.spec.ts` 4 个既有错误
  （L133/140/156/158，未使用变量 / prefer-const），`scripts/` 默认在 eslint ignore 内（CI 不查）。
- 连带：`Settings.css:1098` 注释原写「复用详情页 source-all-modal 的滚动隔离策略」→
  更新为 PlaylistModal（`flex:1 1 auto` + `min-height:0` + `overflow-y:auto`）。

## 沉淀（用户「实施沉淀」指令）

| 层 | 落点 | 内容 |
| --- | --- | --- |
| 团队共享 | `docs/agents/testing.md` | 新增两条：**「用例绿」≠「断言跑了」**（判据：被断言元素存在才算覆盖；带降级分支的用例必须探针实证）；**mock 要命中 = 注册顺序 + 数据前提**（后注册优先 + mock 数据须满足渲染前置条件） |
| 个人细则 | `.workbuddy/memory/ref-code-runtime.md` →「E2E 断言与写法」 | 同两条的浓缩版 + 三条叠加根因 + 对策 |
| 不变量 | `.workbuddy/memory/MEMORY.md` →「运行时 / 工程：不变量」 | 一行：E2E「绿」必须实证落在目标分支；选择器存在 ≠ 覆盖成立 |

## 无 Demo

非观感类改动（去卡沿用 2026-09-28 已交付的 `demo/card-removal-demo.html` 判据，本次仅扩选择器范围）。
