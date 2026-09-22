---
date: 2026-09-22
module: Detail / Browse / Collections（骨架）
type: 一致性统一（骨架静态标签）
build: ✅ npm run build + lint:all 全绿
files:
  - src/pages/Detail/DetailSkeleton.tsx
  - src/pages/Detail/DetailSkeleton.css
  - src/pages/Browse/BrowseSkeleton.tsx
  - src/pages/Browse/BrowseSkeleton.css
  - src/pages/Collections/CollectionsSkeleton.tsx
  - src/pages/Collections/CollectionsSkeleton.css
  - changelogs/demos/demo-skeleton-static-text-2026-09-22.html
demo: changelogs/demos/demo-skeleton-static-text-2026-09-22.html
---

# 全站骨架静态标签统一真实文字（方向 A）

## 背景 / 根因

用户批评「其他页面静态数据没显示，各页面不一致，就这么下结论」。全仓审计 9 个
Skeleton 组件后确认漂移：Home / IPTV 骨架已渲染真实文字，但 Detail / Browse /
Collections 明明持有静态常量（tab 名、分区头标题、推荐标题），却仍渲染灰条。
根因是 09-18「已知常量不当未知」只收敛了**数量 / 几何**，未拍板**文字**。

2026-09-22 用户拍板方向 A：**静态配置渲染真实文字 + 真实类，灰条只留给动态数据**。

## 改动（旧 ↔ 新）

- **DetailSkeleton.tsx**
  - tabs：灰条 → `<span className="tab-underline detail-tab">` + 真实 Icon + 「概览 / 播放列表」
  - 侧栏标题：灰条 → `<h2 className="detail-section-title">基础信息</h2>`
  - 区块标题：灰条 → `<h3 className="detail-section-subtitle">演员 / 简介 / 剧照</h3>`
  - 推荐标题：灰条 → `<h2 className="detail-recommend-title">相关推荐 / 你可能还喜欢</h2>`
  - 侧栏外壳加真实类 `detail-hero-side`；内壳改真实 `.detail-content > .detail-info`
- **DetailSkeleton.css**：删死规则（__tab / __body / __section-title / __recommend-title 等）；
  `.detail-skeleton__side` 基规则减为 `display:none`；≥1024 scoped 用复合选择器
  `.detail-hero-side.detail-skeleton__side`（特异性 0,4,1 > 真实 0,3,1）压过真实定高
  `height: var(--detail-hero-h)` → `align-self:stretch; height:auto`（骨架无 JS 量测）。
- **BrowseSkeleton.tsx/.css**：**删除镜像排序条**（整块 JSX + TYPE_COUNT/SORT_COUNT
  常量 + SORT_OPTIONS/CATEGORY_CONFIG imports + 全部 `__bar/__types/__sorts/...` CSS）。
  依据：真实 `.browse-sort-bar` 在 smart 模式加载期恒在渲染（Browse/index.tsx L706-754），
  镜像条属**重复渲染 bug**（桌面加载期两条叠现；移动端真实条刻意隐藏却被镜像）。
  → Browse 修法是删重复，不是加文字。
- **CollectionsSkeleton.tsx**：分区头标题灰条 → `<span className="collection-section-head__title">影视 / 直播</span>`
  （计数为动态数据，保持灰条 `collections-skeleton__head-count`）。
- **CollectionsSkeleton.css**：删死规则 `.collections-skeleton__head-title`，更新头注释。

## 取舍

- boot-splash（index.html）维持轮廓级灰条不动 —— 首屏极短、无 React 上下文。
- History / Chart / Person 覆盖区无静态标签，无需改。

## 验证

- `npm run build` ✓、`npm run lint:all` ✓（含 stylelint 属性顺序修正一处）
- grep `head-title` 全仓 0 命中，死规则无残留引用。
- 受影响 spec 断言（collections head 数 / detail side·chip 数 / browse 真实 pills 点击）
  均不受本次改动影响；镜像条删除后 browse.spec 点击真实 pills 更安全（无 strict-mode 冲突）。
- demo：`changelogs/demos/demo-skeleton-static-text-2026-09-22.html`（before/after 可切换）。
