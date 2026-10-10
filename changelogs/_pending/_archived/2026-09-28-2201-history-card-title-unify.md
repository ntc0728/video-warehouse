---
date: 2026-09-28 22:01
module: History
type: fix
build: pass
files:
  - src/components/RecordCard/RecordCard.css
  - src/pages/History/HistorySkeleton.css
demo: 无
---

# 历史页卡片标题比其他页大一号（组件分叉致字号/字重不一致）

## 问题

历史页卡片标题视觉上明显比首页/列表/收藏等页的卡片标题大且重。

## 根因

- 历史页用独立组件 `RecordCard`（`History/index.tsx`），其余页统一用 `VideoCard`——两套标题类 `.record-card__title` / `.video-card-title` 无任何共享规则。
- 字号 token 不同：`RecordCard.css` 写 `--text-base`(14px) + `font-weight:600` + `line-height:1.3`；`VideoCard.css` 是 `--text-sm`(13px) + `500` + `1.5`。仅差 1px，但加粗 + 紧行高让观感差被放大。

## 修法

历史页标题对齐全站通用口径（`--text-sm` / 500 / 1.5），TV 端与 `[data-device="tv"] .video-card-title` 同口径保持抬到 `--text-base`：

```diff
 .history-page .record-card__title {
-  font-size: var(--text-base);
-  font-weight: 600;
-  line-height: 1.3;
+  font-size: var(--text-sm);
+  font-weight: 500;
+  line-height: 1.5;
 }
+[data-device="tv"] .history-page .record-card__title {
+  font-size: var(--text-base);
+}
```

- 骨架 `.history-skeleton__title` 行盒同步 `1.5em` + `--text-sm`（含 TV 抬号副本），保证骨架↔真实卡等高、交接无跳动。

## 验证

- `npm run lint:all` 7 门全过（design/css/json/version-sync/test-map/eslint/build）
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/history.spec.ts scripts/skeleton.spec.ts` → 24 passed（HIS-062 首两轮 `.app-shell` 超时为环境抖动，同 dist 复跑两次均 pass）
