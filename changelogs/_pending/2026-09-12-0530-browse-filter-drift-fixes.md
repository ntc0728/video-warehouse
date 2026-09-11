---
date: 2026-09-12 05:30
module: Browse 逻辑分页（切筛选空页/重复 key）+ 转圈同行 + 直链搜索去分页
type: fix
build: tsc -b 通过；vite build 通过；browse.spec 8 条全过
files:
  - src/pages/Browse/useLogicalPage.ts（组装消费改逐条去重）
  - src/pages/Browse/index.tsx（fetchPage 三段等待；M 按媒体类型；转圈后置；CMS 哨兵）
  - src/pages/Browse/BrowsePagination.tsx（无改动复核）
  - src/pages/Browse/useCMSSearch.ts（新增 loadMore 追加式）
  - src/pages/Browse/Browse.css（count 内联排布）
demo: 无
---

## 用户反馈 → 根因 → 修复

### 1. 切筛选后 card 不显示（只剩分页组件）
两个叠加根因：
- **合并页大小 M 写死 40**：切到「电影/剧集」分类后 store 只拉单路 20 条，偏移算术按 40
  定位 → 错位空页。修复：M = 搜索/单类型 20、all 40（与真实拉取条数一致）。
- **筛选参数陈旧**：点筛选后 store 的 filterOptions 要等 filterSig 防抖（300ms）才更新，
  组装层立即取页会带旧筛选参数拉回上一轮数据。修复：fetchPage 三段等待——
  ① `toStoreFilter(filterValue)` 与 store filterOptions 对齐（等防抖）；② 等 store 既有
  请求落地（防 goToPage 守卫静默 no-op）；③ 落地页号 ≠ 请求页号（其它触发器经 store
  seq 丢弃本页响应）时等对方落地后重试一次。

### 2. 控制台大量 duplicate key 警告（tmdb-movie-424 等）
真实 TMDB 按流行度排序，相邻页请求之间序漂移，两个缓冲区会出现相同条目；mock 静态数据
测不出。修复：组装消费改**逐条按 id 去重**（seen Set），漂移重叠条目只保留首个。
实测：跨页漂移 mock（页 N 尾=页 N+1 头）+ 连续切电影/剧集/全部 → 每页恒 35 张、
零 duplicate key 警告。

### 3. 「搜索中」与转圈不在同一行
`.browse-sort-bar__count` 改 inline-flex + align-items:center + gap；转圈图标移到文字
**右侧**（搜索中…⟳）。几何实测 spin 与容器同行（sameRow=true）。

### 4. 直链搜索（CMS）不需要分页
- `useCMSSearch` 新增 **loadMore**（append 语义）：不清空已有结果，本页各源 pg=n 落位
  结果拼在进入本页前的快照之后（flush 幂等），hasMore 沿用探测式。
- Browse 侧：CMS 摘掉分页器（showPagination 仅 smart），接回无限滚动哨兵
  （useInfiniteScroll，smart 模式 hasMore 恒 false 闲置）——恢复「滚动触底自动追加」。

## 实测
漂移 mock：P1/P2/P3 恒 35（7×5）；切电影/剧集/全部均 35、回页 1；dup 警告 0。
转圈几何 sameRow=true。browse.spec 8 条全过。
