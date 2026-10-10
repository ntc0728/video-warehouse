---
date: 2026-10-10 14:36
module: E2E / skeleton 契约
type: fix
build: pass
files:
  - scripts/skeleton.spec.ts
demo: 无
---

# SKEL-014 期望值补同步：chrome 骨架 chip 22 → 73（ff5930f 漏同步）

## 问题

`skeleton.spec.ts` SKEL-014 断言 `.browse-chrome-skeleton__chip` 数 `6 + 8 + 8 = 22`，实测 73 稳定失败。

## 根因

- `ff5930f`（2026-10-09）为「≥1024 桌面 chips 撑满不露底」给 `BrowseChromeSkeleton.tsx` 加了 `FILL_CHIPS = 14`（每组 3 组都追加），且地区/年份组在 ≥1024 复活全部真实标签数——组件单向变更，spec 期望值仍停在 `3240ea4`（2026-09-23）的旧结构 `6+8+8`。
- 新构成（与实测 73 吻合，单份渲染无重复挂载）：
  - 分类 = GENRE_CHIPS 6 + FILL 14 = 20
  - 地区 = REGION_OPTIONS 12 + FILL 14 = 26
  - 年份 = YEAR_OPTIONS 12 + 其他 1 + FILL 14 = 27

## 修法

期望改为构成展开式 `20 + 26 + 27`，附每个数字的常量来源注释与 ff5930f 漏同步留痕。保持 spec 零 src import 惯例（项目 36 处 spec import 全是 fixtures/type，不为单点真源化打破惯例引入 CSS import 链风险——漂移由 spec 红灯 fail-fast 兜底）。

## 验证

- `node scripts/e2e-skeleton.mjs scripts/skeleton.spec.ts` 18 passed（含 SKEL-014）
- `npm run lint:all` 七门全绿
- 判界留痕：该失败早于 early-HTML 改动存在（与 `2026-10-10-1427-vite-dev-early-html.md` 同日，判界互证）
