---
date: 2026-10-09 17:55
---

# 2026-10-09 17:55 — Browse 去 token 提示 + Chart 失败态对齐 Empty（去重试）

## ① Browse：未配置 TMDB token 不再显示提示元素（用户截图需求）
- 删 `Browse/index.tsx` 中 `{searchMode==='smart' && !hasToken && <div class="browse-results-body__token"><TokenRequired/></div>}` 块及 `TokenRequired` import；
- 删 `Browse.css` 的 `.browse-results-body__token` 死样式。
- 未配置 token 时 smart 检索自然失败 → 统一走既有「加载失败 / 网络或影视库暂时不可用」Empty 失败态。
- `hasToken` 保留（仍用于 genre 拉取门控 354-360 行）。TokenRequired 组件保留（Detail/Person/Player 仍用）。

## ② Chart：失败态对齐 Browse Empty 样式 + 删重试逻辑（用户需求）
- `Chart/index.tsx` 错误分支由 `.chart-error`（p + 重试按钮）改为 `<Empty status="error" title="加载失败" description={error} />`（error 文案保留「榜单数据加载失败，请检查网络后重试」作为描述）；
- 删 `retry` 回调（feedCache.delete + loadFeed 重入）—— 页内不再提供恢复入口，与 Browse 2026-09-24 拍板同口径；
- 删 `Chart.css` 的 `.chart-error / .chart-error__retry / :hover` 死样式；
- 补 `import Empty from '@/components/common/Empty'`。
- loadMore 失败的「加载更多失败，请重试」为行内追加失败提示，非本次范围，未动。

## 验证
- stylelint（Chart.css + Browse.css）✓ / tsc -b ✓ / vite build ✓（9.9s）
- 产物断言（17:48 代次）：Browse chunk `index-C-jbVmQd.css` 含 align-items:stretch、无 token 样式；
  Chart chunk `index-Cq-yG7YK.css` 无 chart-error__retry；Chart JS `index-mFAQn626.js`（8374B，较旧代次 8494B 缩小 = 重试逻辑已删）。
- 未 commit / 未跑 E2E（等用户验收）。
