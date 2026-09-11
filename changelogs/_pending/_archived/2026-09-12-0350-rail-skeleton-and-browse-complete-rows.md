---
date: 2026-09-12 03:50
module: 首页左栏骨架 / 各页刷新态 / Browse 整行收整
type: fix
build: tsc -b 通过；vite build 通过；vitest 389 全过；browse.spec 8 条全过
files:
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx（并行 WIP 文件上追加）
  - src/pages/Browse/useCompleteRows.ts（新增）
  - src/pages/Browse/index.tsx（并行 WIP 文件上追加接线）
demo: 无
---

## ① 首页左栏「一直不显示骨架」——根因 = 修复代码从未提交

用户反馈「其他 agent 称已修复」。排查结论：左栏骨架的两层实现**都只存在于工作区未提交 WIP**
（`CategoryTrendSkeleton` 组件 + `CategoryHeatRow` rail 分支 + 首页两套视口骨架的 Home/index.tsx
改造，均为 2026-09-11 并行会话产物），已提交的 master 上没有——用户跑已提交代码自然永远看不到。

本次在其上追加一个收敛：trending **加载结束仍为空（失败/无数据）也保持骨架占位**，不再返回
null——原「失败 → 不渲染」在请求快速失败时表现为整列空白（右列有内容、左栏洞穿）。
数据由 fetchAllHomeData 的 I1 失败冷却（10min）自动重试补齐。

## ② 「每个页面原地刷新显示首页骨架」——四种口径均不复现

F5 /browse、/detail、/collections、/history ×（无缓存 / 有缓存二次加载），从 commit 起以
40~150ms 轮询渲染序列：**没有任何页面闪现 `.home-skeleton`**。/browse = AppLoading →
BrowseSkeleton；/detail = AppLoading → DetailSkeleton；首页二次加载（有缓存）直达真实内容
（449ms 出 hero），无骨架无覆盖层。若用户仍复现：疑似 KNOWN-ISSUES #18（dev server 静默
serve 旧代码）或观察的是首页自身的首屏骨架（冷缓存 + 慢网络下属预期），需截图定位。

## ③ Browse「最后一行占不满」——跨页余量结转（依赖分页制 WIP）

背景：并行会话 2026-09-12 已把右栏由无限滚动改为**替换式分页**（BrowsePagination +
useBrowseData.goToPage + useCMSSearch.goToPage，均为未提交 WIP）。TMDB 每页固定
20 条（电影+TV 合并 40）、CMS 为各源 pg=n 聚合，**均不支持自定义每页条数**——
「按列数动态传参取数」对这两个接口都做不出来。

等价实现 = 跨页余量结转（`useCompleteRows.ts`）：第 N 页展示「carry(N-1) + 本页」的
cols 整数倍前缀，余量结转下一页前置（顺序不变、不重复），末页全量。实测（1440 / 7 列 /
页=40 条）：页 1 = 35、页 2 = 42（5+40 取 42）、回退页 1 = 35——行行完整。
三个时序坑（都已处理）：翻页 reset 的空数组间隙不清结转；「新页码+旧数据」过渡帧不推进
页序；结算后同页重渲染复用 appliedRef（否则 isRefreshing 收起时 carry 误丢）+ Rules of Hooks
（不能提前 return 跳过 effect）。

## 提交策略（重要）

三个修复全部落在**工作区**、与并行会话未提交 WIP（分页制 / 左栏骨架集群）同批：
- ①依赖 WIP 里的 CategoryTrendSkeleton 组件；
- ③的结转语义只在替换式分页下正确——若单独提交到 master（无限滚动、结果累积），
  carry 会与累积列表重复渲染。
建议：待并行会话提交其分页/骨架集群时一并落库；或授权本会话代为整批入库。
