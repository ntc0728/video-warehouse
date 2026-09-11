---
date: 2026-09-12 05:00
module: Browse 逻辑分页组装层（smart 模式数据流）
type: feat
build: tsc -b 通过；vite build 通过；vitest 389 全过；browse+regression 38 条全过
files:
  - src/pages/Browse/useLogicalPage.ts（新增，替换 useCompleteRows.ts）
  - src/pages/Browse/index.tsx
  - src/pages/Browse/useBrowseData.ts（goToPage 返回 Promise）
demo: 无
---

## 背景（用户需求）

「card 列数是动态的，TMDB 每次返回 40 条数据，最后一行占不满，能否根据 card 列数动态传入值
获取信息，确保最后一行显示完整」+「点击筛选条件 card 显示行数不一样」+「页数要对得上」。
TMDB/MacCMS 均不支持自定义每页条数；上一轮的跨页结转能保证行行完整，但每页条数随余量波动
（35/42 交替，行数 5/6 不恒定）。

## 实现：逻辑分页组装层（useLogicalPage）

- 逻辑页 L 覆盖全局条目 `[(L-1)·P, L·P)`，**P = 当前列数 × 5（恒定行数）**，列数 3~8 → P=15~40；
- TMDB 合并页 M：discover/top = 40（电影 20+剧集 20）、search = 20；
- 定位算术：`tStart = floor(start/M)+1`，`offset = start − (tStart−1)·M`，`offset+P > M` 时多取
  一页 → **每个逻辑页至多 2 个 TMDB 请求**，无跨页累积状态，跳页/回退/随机跳全支持；
- TMDB 页结果按 (context, t) 缓存：翻回上一页零请求；上下文（换词/换筛选/切分类）变化清缓存回页 1；
- 总页数 = ceil(钉定总数 / P)，并钳到 TMDB 可达范围 `ceil(500·M / P)`（discover/search 硬顶
  500 个 TMDB 页，超出只会返回空）——实测 84,922 条 / 7 列 = 末页 572；
- 列数跨档（P 变）：命中缓存重切当前页，无新请求；
- goToPage（useBrowseData）改为返回 Promise（loading 收尾后 resolve），供组装层串行取页；
- fetchPage 前 10s 内轮询等待 store 既有 discover 请求落地（上下文切换自带 page=1 拉取，
  避免 goToPage 的 loading.discover 守卫静默 no-op 拿到别页数据）。

## 实测（1440 / 7 列 / mock 总数 84,922）

P1=P2=P100=**35 张恒定**（7×5）；跳 9999 → 钳到末页 **572**；回页 1 缓存命中；
翻页前后右上角总数恒定。CMS 模式（来源聚合、总页数不可知）维持 simple 分页原样，未收整。

## 已知取舍

- 上下文切换（挂载/换词/换筛选）时 store 自带的 page=1 拉取与组装层 goto(1) 并存 →
  一次冗余请求（fetchPage 以轮询等待落地后再自己拉取，正确性不受影响）；
- 逻辑页序号 ≠ TMDB 页序号（1 逻辑页 ≈ 0.875 个 TMDB 合并页），分页器展示的是逻辑页；
- 目录尽头（TMDB 第 500 页附近）个别源提前枯竭时，贪心取页自动向后补齐，末页可能短于 P。
