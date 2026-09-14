---
date: 2026-09-14 01:00
module: Browse 慢网互斥渲染 + 不足一页隐藏分页器
type: fix
build: npm run build 通过；browse.spec 11 条全过；Playwright 三场景（单页数据/慢网/失败）实测通过
files:
  - src/pages/Browse/index.tsx（showPagination 条件重写 + 骨架/空态/分页器互斥门控）
demo: 无（临时 Playwright 脚本验证后即删）
---

## 用户反馈 → 根因 → 修复

### 1. 慢网下空态「暂无结果」+ 分页器 + 卡片同屏叠字（截图）

三个渲染分支各自独立判定、互不知晓，慢网/异常时序下会同帧渲染：

- **空态**是 `position:fixed` 全屏视口居中（empty-state-wrapper），任何同帧元素都会被它压上；
- **分页器**旧条件 `effectiveTotalPages>1 || discoverResults.length>0`：后半句在有任意结果时
  恒真（单页数据也渲染），前半句会消费**陈旧 totalPages**（搜索 reset 清了 results 但
  分页/失败路径不清 pagination）；
- **骨架**是文档流块非遮罩，翻页飞行中旧 items 保留 → 骨架叠在旧网格之上。

修复（互斥门控，以「逻辑层 items 是否有内容」为准绳）：
- `showPagination = smart && logical.items.length > 0 && logical.totalPages > 1`（移到 logical 声明之后）；
- 骨架仅在 `items.length === 0` 时渲染（翻页飞行中旧页原地保留 + 分页器 disabled）；
- 两个 Empty（错误/空态）都加 `logical.items.length === 0` 门控。

### 2. 搜索结果不足一页时不应显示分页器

旧条件的 `|| discoverResults.length > 0` 让单页数据也渲染分页器。
新条件 `logical.totalPages > 1`：不足一页（总页数 = 1）不渲染。
500 页硬顶原由 `effectiveTotalPages = min(totalPages, 500)` 承担，现由
useLogicalPage 的 `TMDB_PAGE_CAP` 统一钳制，`effectiveTotalPages` 随之删除。

### 验证

Playwright 三场景：单页数据（1 卡片 + 无分页器 + 无空态）；慢网 3s（飞行中骨架
显示、分页器/空态不出现，落地后分页器出现）；搜索失败 500（空态出现、分页器不出现）。
注意：直接 `goto('/browse?q=x')` 是 POP 导航、按设计忽略搜索词，测试须走首页
搜索框 PUSH 进入。

### 顺带发现（未修）

`index.tsx:48` `useIsMobileLayout() || useIsMobile()` 短路调用违反 rules-of-hooks，
stash 比对确认 HEAD 基线已有，与本次改动无关。
