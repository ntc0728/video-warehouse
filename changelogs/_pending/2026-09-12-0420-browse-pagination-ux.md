---
date: 2026-09-12 04:20
module: Browse 分页 UX（总数/加载态/页数钳制/跳页）
type: fix
build: tsc -b 通过；vite build 通过；vitest 389 全过；browse.spec 8 条全过
files:
  - src/pages/Browse/index.tsx（并行 WIP 文件上追加）
  - src/pages/Browse/BrowsePagination.tsx（并行 WIP 文件上追加）
  - src/pages/Browse/Browse.css（并行 WIP 文件上追加）
  - src/pages/Browse/useCompleteRows.ts（上一片段的结转 hook，本轮修竞态+重构）
demo: 无
---

## 用户反馈 → 修复对照

| 反馈 | 处理 |
| --- | --- |
| 点下一页/上一页/跳页后右上角总数会变 | **总数钉定**：TMDB `total_results` 是逐页波动的估计值；同一「模式+关键词+筛选」上下文内以第一次请求落地的非零总数为准（`pinnedTotal`，请求落地后才结算），换词/换筛选/切模式时重钉 |
| 搜索时右上角变 0 | 新搜索落位前该位置显示 `Loader2` 转圈 +「搜索中…」，响应结束后再显示真实总数（`.browse-count-spin`，复用全局 spin keyframes） |
| 点最后一页显示「没有搜索结果」且分页组件消失 | TMDB discover/search **硬顶 500 页**：total_pages 报 2124 但 >500 页一律空结果。`effectiveTotalPages = min(totalPages, 500)` 钳制页码条/hasNext/跳转；分页器可见性放宽为「有页可翻 ‖ 有结果」，空结果页也能翻回去 |
| 分页缺手动跳页 | BrowsePagination 数字形态追加「页码输入 + 跳转」：Enter/按钮提交，输入钳制 [1, 500]（输 9999 跳 500），非法输入忽略 |

## 结转 hook（上片段）两个补充修复

- **竞态**：goToPage 置新页码到数据落地之间存在「新页码+旧数据」过渡帧，effect 在该帧把页序
  提前结算 → 新数据落地时「连续下一页」判定失效、结转被误清。加 `lastItemsRef` 身份守卫
  （items 未变不结算）。
- **Rules of Hooks**：appliedRef 命中分支曾提前 return 跳过 effect → hook 顺序崩
  （BrowsePage 整页白屏）。改为全 hook 无条件调用、标记分流。

## 实测（Playwright + mock，1440/7 列）

- 页 1 = 35 张（40 取 35，余 5 结转）；页 2 = 42（5+40 取 42）；回退页 1 = 35 —— 行行完整。
- 页码条末页 = 500（无 2124）；跳 3 → 激活 3；跳 9999 → 钳到 500；翻页前后总数恒 84,922；
  新搜索 600ms 内总数位 = 「搜索中…」转圈。

## 遗留（待用户拍板）：每页固定行数

结转方案保证「行行完整」但**每页条数随余量波动**（35/42/42…，行数 5/6 交替）。
要「每页恒定 cols×5 行」需做逻辑分页组装层：按全局条目序号算术定位所需 TMDB 页
（P=cols×5 ≤ 40=合并页大小，每页至多 2 个请求 + offset 切片，无跨页状态），总页数改为
ceil(totalResults/P)。这是对 smart 模式数据流的重建，与并行会话今天的分页 WIP 强耦合，
待拍板后实施。
