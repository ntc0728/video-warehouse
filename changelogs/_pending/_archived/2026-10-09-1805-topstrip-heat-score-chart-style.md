---
date: 2026-10-09 18:05
---

# 2026-10-09 18:05 公告条数据元素样式对齐 chart 页

## 用户需求
首页公告轮播内：热度、评分参考 chart 页 card 内样式；年份、类型改胶囊样式。

## 改动
- `src/pages/Home/HomeTopStrip.tsx`：
  - 热度 = Flame 图标 + 暖橙加粗数字（chart `.chart-row__heat .n` 口径，去掉「热度 」前缀文字与 `<b>`）；
  - 评分 = Star 图标 + 次级色数字（chart `.v` 口径，去掉「 分」后缀）；
  - 年份/类型 = `home-topstrip__meta` 胶囊（镜像 `chart-row__badge`）；
  - 新增 lucide-react Flame/Star + `@/components/ui/Icon` import。
- `src/pages/Home/Home.css`：
  - `__heat`：inline-flex + `--color-warning-text` + 700 + tabular-nums，svg 压到 `--text-xs`（chart 12px 同档，token 化）；
  - `__score`：inline-flex + `--color-text-secondary` + tabular-nums，svg 同上；
  - `__meta`：`--color-tag-bg` 底 + `--radius-sm` + `--text-xs × --lh-base`（与 chart badge 逐项同款，条内 1.6em 单行高恰好容纳）；
  - 删旧 `__heat b`（主色加粗）规则。

## 验证
stylelint（--fix 修 flex-shrink 顺序）✓ / tsc ✓ / vite build ✓ / eslint ✓ / 产物断言 ✓（18:04 代次 HomeRoute-CiOnIzT0.css 三条规则齐、旧 b 规则 0；HomeRoute-D1adVUvR.js 含 Icon 接线并 import icons-vendor 共享 chunk——Flame/Star 路径数据在 icons-vendor-D7Rz3IzU.js，Chart 同源）。未 commit、未 E2E。
