---
date: 2026-09-21
module: src/pages/Browse（智能检索取页 / 缓存回显）
type: fix
build: npm run build ✓；lint:all ✓；受影响 spec scripts/browse.spec.ts 全 13 条 ✓（ad-hoc 档，未跑全量）
files:
  - src/pages/Browse/index.tsx
demo: 顶部搜索框在默认浏览态下输入任意关键词回车 → 之前展示的是缓存的默认浏览结果（搜索根本没发），现已真实检索
---

# 修复：搜索态误命中 discover 缓存回显，导致 store.search 从不触发

## 根因

`fetchTmdbPage(t, force)` 的「缓存回显」分支（index.tsx:418）判定条件只看
`!force && t === 1` + filter 相等 + TTL（10 分钟）未过 + `discoverResults` 非空，
**完全没看 `query`**。

而 `discoverFetchedFilter` 仅由 `store.search` 置 null、由 `fetchDiscover/fetchTopRated`
写成当前 filter。于是从默认浏览态（query=''，已缓存 ~30 条 discover 结果）切到任意搜索词时：

- logicalContext 变 → `runGoto(1)`（**不带 force**）→ `fetchTmdbPage(1, false)`
- 缓存判定全中（filter 没变、30 条还在、TTL 没过、`discoverFetchedFilter` 非 null）
- → 直接 `return s0.discoverResults`（旧浏览结果），`store.search` **从不被调用**

表现：在默认浏览页搜索任何词，结果区始终是那一屏默认浏览内容；搜不存在的词也不会出空态。

## 旧 ↔ 新

| | 旧 | 新 |
| --- | --- | --- |
| 缓存回显条件 | `!force && t === 1` + filter 命中 | 追加 `&& !query`：搜索态一律跳过缓存、强制走 `store.search` |
| 搜索结果 | 被上一屏浏览缓存顶替（搜索不发请求） | 真实检索；空结果正确渲染「暂无结果」空态 |
| 浏览态（query='') | 不变（详情返回 / 切回同筛选仍命中缓存零请求） | 不变 |

`query` 为空时行为完全不变；缓存回显本就只服务「与 query 无关的 discover/top 浏览态」，
搜索态命中它纯属逻辑漏洞。

## 为什么 E2E 此前没抓住

`BROWSE-010/012` 只断言 `resultsBody` 可见——30 条陈旧浏览结果同样满足，属掏空断言，
把 bug 放过去了。真正抓住的是 `BROWSE-013`（搜 `zzzxxxnotexist12345` 断言空态出现）：
缓存命中 → 30 条常驻 → 空态永不渲染 → 10s poll 超时失败。连带 `BROWSE-094`（应 1 条却 35 条）
`BROWSE-095`（骨架不出现）同根因失败。一处产品修复后三条全绿，2.2 组耗时由 10.6s（超时）降到 2.1s。

## 验证范围说明

属行为类改动，按分级门禁本应全量 E2E；但「未经用户允许禁止跑全量」，故只跑受影响 spec
（browse.spec.ts 全文件 13 条 ✓）。全量待用户放行。
