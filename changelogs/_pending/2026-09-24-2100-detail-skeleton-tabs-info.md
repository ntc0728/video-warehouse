# 2026-09-24 2100 Detail 骨架：tab 改骨架方框 + info-card 对齐真实行高

---
date: 2026-09-24
module: detail
type: fix
build: pass
files:
  - src/pages/Detail/DetailSkeleton.tsx
  - src/pages/Detail/DetailSkeleton.css
demo: none
---

## 改动

- Detail 骨架 tab「概览/播放列表」不再渲染真实文字，改为图标槽 + 标签槽两块 Skeleton 方框
- 外壳仍复用真实 `.detail-tab` / `.tab-underline`（padding-sm/lg + 2px 下划线几何与真实一致）
- 右栏 `.detail-skeleton__info-card` 高度 `3.25em` → `calc(var(--text-sm) * 1.5)`，对齐真实 `.detail-info-card` 单行高

## 旧↔新

| 位置 | 旧 | 新 |
| --- | --- | --- |
| tab 内容 | Icon + 真实文字「概览/播放列表」 | `__tab-icon` + `__tab-label` 骨架方框（wide 档区分 2/4 字） |
| `__info-card` height | 3.25em | calc(--text-sm * 1.5) |

## 验证

- `npm run lint:all` 7/7
- SKEL-013 断言 `.detail-skeleton .tab-underline.detail-tab` count=2 不受影响
