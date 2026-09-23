---
date: 2026-09-23
module: components/IPTVChannelCard, components/RecordCard
type: style
build: ✅ npm run build + lint:all 全绿
files:
  - src/components/IPTVChannelCard/IPTVChannelCard.css
  - src/components/RecordCard/RecordCard.css
---

# IPTV/收藏/历史 台标卡封面改 object-fit: cover 占满容器

## 问题

台标卡封面用 `object-fit: contain` + padding，台标缩在容器中央、四周大面积底色留白，观感松散（用户反馈「没有占满容器」）。

## 旧逻辑

- `IPTVChannelCard.css` `.iptv-card-cover img`：`object-fit: contain` + `padding: var(--space-2xs)`（IPTV 页 + 收藏·直播分区共用）。
- `RecordCard.css` `.history-page .record-card__media--logo`：`object-fit: contain` + `padding`（历史·直播记录）。
- 收藏·影视 / 历史·视频封面本就 `cover`，未动。

## 新逻辑（2026-09-23 用户定稿：直接用 cover，免 Demo）

- 两处台标封面改 `object-fit: cover` 并去掉 padding → 图铺满容器，异形台标宁裁边不四周留白。
- 影视海报卡维持 `cover`；`fill`（变形）不采用。

## 旧↔新对照

| 页 | 卡 | 旧 | 新 |
| --- | --- | --- | --- |
| IPTV + 收藏·直播 | IPTVChannelCard | contain + padding | cover |
| 历史·直播记录 | RecordCard --logo | contain + padding | cover |
| 收藏·影视 / 历史·视频 | VideoCard / RecordCard --video | cover | 不变 |

## 验证

- `npm run build` + `npm run lint:all` 全绿。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/iptv.spec.ts scripts/history.spec.ts scripts/collections.spec.ts --budget 120 --retries 0` → **15 passed (7.8s)**。
- E2E 无 object-fit 断言，纯样式回归由 build/lint + 页面 spec 兜底。
