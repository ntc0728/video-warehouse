---
date: 2026-09-22 23:10
module: browse
type: fix
build: true
files:
  - src/pages/Browse/index.tsx
  - scripts/fixtures/tmdb-mock-data.ts
  - scripts/home.spec.ts
  - scripts/skeleton.spec.ts
---

# Browse 搜索空态不渲染（清空后再搜无结果词）

- 日期：2026-09-22
- 问题：清空搜索后再搜 `zzzxxxnotexist12345`，空态/骨架/网格全不渲染，计数卡「共 100 条」。
- 旧逻辑：
  1. `fetchTmdbPage` 在 context 已切走后仍可能调 `fetchDiscover` 把 `discoverResults` 盖写成非空；
  2. `isEmpty` 把全局 `discoverResults` 当前置条件（与 `logical.items` 不同步）——`discoverResults` 非空时 `isEmpty` 恒假，空态永远压不住。
  3. mock 路由 `makePage([])` 默认 `total_results=100`，空态旁显示「共 100 条」。
- 新逻辑：
  1. 新增 `logicalContext` 提前定义 + `liveCtxRef` 上下文代际，`fetchTmdbPage` 各等待/发请求/落地点加 `isStale()` 弃权返回 `[]`；
  2. `isEmpty` smart 模式仅看 `logical.items.length === 0`（CMS 分支保留 `!isCmsLoading`），错误态 Empty 同步改 `logical.items.length === 0`；
  3. 删除未用 `isSmartLoading`；deps 补 `logicalContext`；
  4. mock：`makePage([], 0)` → 空态显示「共 0 条」。
- 验证：BROWSE-010 单跑 1 passed；skeleton 串行 81 passed；`test:e2e` 全量 exit 0；`npm run build` ✓；`npm run lint:all` ✓；单测 435 passed。
- 涉及文件：src/pages/Browse/index.tsx / scripts/fixtures/tmdb-mock-data.ts
- 构建：npm run build 通过

## E2E 断言修正（home / skeleton）

- 日期：2026-09-22
- 问题：home.spec 1.2 用 `[class*="hero"]` 提前放行到 `home-skeleton-hero`；SKEL-014 断言旧镜像排序条 `.browse-skeleton__type/__sort/__count`，方向 A 后真实排序条恒在、骨架不再渲染镜像。
- 旧逻辑：
  - home: `page.locator('.home-hero, [class*="hero"]')` → skeleton 也含 "hero" 子串，没等到真实 Hero。
  - skeleton: 断言 `.browse-skeleton__type=7/__sort=3/__count=1`，方向 A 改后这些节点不存在 → 假红。
- 新逻辑：
  - home: 等真实 `.hero-bili__banner, .hero-banner__main`；
  - skeleton: 改断言 `.browse-sort-bar__type=7/__tab=3/__count=1`，并断言旧镜像 0 个（防双条叠现回归）。
- 验证：home 1.2 单跑 1 passed；skeleton 串行 81 passed。
- 涉及文件：scripts/home.spec.ts / scripts/skeleton.spec.ts
- 构建：npm run build 通过
