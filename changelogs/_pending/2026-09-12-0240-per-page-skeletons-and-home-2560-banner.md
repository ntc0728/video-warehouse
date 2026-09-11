---
date: 2026-09-12 02:40
module: 全站页面骨架占位（Browse/Collections/Person/IPTV/Detail）+ 首页 ≥2560 banner 尺寸
type: fix
build: tsc -b 通过；vite build 通过；stylelint 新增文件零违规；vitest 389 全过；受影响 e2e（browse/regression/collections/person/detail/iptv 六 spec）全过
files:
  - src/components/common/Skeleton.tsx
  - src/components/common/Skeleton.css
  - src/pages/Browse/BrowseSkeleton.tsx
  - src/pages/Browse/BrowseSkeleton.css
  - src/pages/Browse/index.tsx
  - src/pages/Collections/CollectionsSkeleton.tsx
  - src/pages/Collections/CollectionsSkeleton.css
  - src/pages/Collections/index.tsx
  - src/pages/Person/PersonSkeleton.tsx
  - src/pages/Person/PersonSkeleton.css
  - src/pages/Person/index.tsx
  - src/pages/IPTV/IPTVSkeleton.tsx
  - src/pages/IPTV/IPTVSkeleton.css
  - src/pages/IPTV/index.tsx
  - src/pages/Detail/DetailSkeleton.tsx
  - src/pages/Detail/DetailSkeleton.css
  - src/pages/Detail/index.tsx
  - src/pages/Home/Home.css
  - src/components/VideoCard/SkeletonCard.tsx（删）
  - src/components/VideoCard/SkeletonCard.css（删）
  - src/components/IPTVChannelCard/SkeletonIPTVCard.tsx（删）
  - src/components/IPTVChannelCard/SkeletonIPTVCard.css（删）
  - scripts/browse.spec.ts
  - scripts/regression.spec.ts
  - scripts/iptv.spec.ts
demo: 无（骨架为加载瞬态，量测数据见下）
---

## 背景

用户反馈：骨架占位整改方向被前次会话识别错了——需求是「每个页面按视口显示**该页独有**的骨架」，
实际却被统一退化成全站同一个 `AppLoading` 菊花。本次恢复各页专属骨架，并落实
「骨架占位与真实元素尺寸差不多大」约束。

## 旧 → 新

| 页面 | 旧（统一菊花） | 新（页面专属骨架） |
| --- | --- | --- |
| Browse 结果区 | `<AppLoading tip="搜索中…">` | `BrowseSkeleton`：类型/排序行 + 2:3 卡片网格，列数吃 `--card-cols` |
| Collections | `<AppLoading tip="加载中…">` | `CollectionsSkeleton`：影视分区头 + 竖版网格（`--card-cols`）→ IPTV 分区头 + 频道网格（`--iptv-cols`） |
| Person | `<AppLoading>` | `PersonSkeleton`：hero（返回签 + 2:3 头像 clamp 曲线 + 信息行）+ tab 行 + 作品网格；≤767/App 恒 3 列 |
| IPTV 首载/刷新 | 整页/局部 `AppLoading` | `IPTVSkeleton`（rail={isDesktopRail} 两套）+ `IPTVChannelGridSkeleton` 局部刷新；频道网格吃 `--iptv-cols` |
| Detail | `<AppLoading>` | `DetailSkeleton`：≥1024 与真实 `.detail-top` 同款 1.4fr/1fr 网格（align-items:start 防 aspect-ratio 反算），窄屏堆叠 |

- 新共享原语 `components/common/Skeleton`（单块 shimmer），页面骨架由各页自行组合；
  注释明确「禁止再造跨页整套通用骨架」。
- 删除零引用孤儿组件：`SkeletonCard/SkeletonGrid`（VideoCard）、`SkeletonIPTVCard`（初提交遗存，
  其「列数对齐 --iptv-cols」设计由新 IPTV 骨架继承）。
- Home 骨架（宽屏两套分支 + 复用真实类名）本就达标，未改结构；≥2560 档新 token 自动流入骨架。

## 骨架 ↔ 真实尺寸实测（Playwright，骨架态 vs 加载态同视口对比）

| 视口 | 元素 | 骨架 | 真实 |
| --- | --- | --- | --- |
| 390 | Home banner | 364×205 | 364×205 |
| 768 | Home banner | 723×407 | 723×407 |
| 1440 | Home banner / 行卡 | 434×255 / 141×238 | 434×255 / 139×234 |
| 2560 | Home banner / 行卡 / 右侧卡 | 795×454 / 227×371 / 337×190 | 795×454 / 225×365 / 334×188 |
| 1440 | Detail hero / 右栏 | 765×431 / 547×431 | 765×431 / 547×431（基线一致） |
| 1440 | Browse 卡 | 146×235 | 146×245 |
| 390 | Browse 卡 | 113×185 | 113×194 |
| 1440/390 | Collections 网格列 | 与 `.video-card-grid`/`.iptv-channel-grid` computed 列宽逐像素相同 | — |

## 附带修复

- **首页 ≥2560 banner 过宽**（用户反馈）：封顶档 banner 实测 959×393（≈2.4:1，1920 档为 1.7:1）。
  Home.css 新增 `@media (width ≥ 2560px)` 双 token 联动：`--hero-side-w` 0.56→0.66（banner 收窄）、
  `--hero-banner-h` 系数 0.24→0.277（按齐平条件反推：右栏两行卡跨度 454px / 分母 1640.7px）。
  定稿实测 banner 795×454（≈1.75:1），底边与右栏两行卡齐平（582=582 逐像素核验）。
  ⚠️ 两个系数必须同改，单改一个会破坏「banner 底边 = 右栏两行卡底边」契约。
- Detail 骨架两处适配：宿主 `.detail-page--loading` 是 `align-items:center` flex 列 → 骨架显式
  `width:100%`（否则整块收缩、hero 塌 0 宽）；两栏档照抄真实 grid 公式而非 flex 拉伸（避坑
  aspect-ratio 反算，见 Detail.css 1936 注释）。
- e2e 同步：BROWSE-077 断言改 `.browse-skeleton`；REG-015 改 `.iptv-skeleton`；
  IPTV-062 等网格选择器收紧为 `.iptv-channel-grid`（放宽的 `[class*="channel"]` 会被
  骨架类名 `.iptv-skeleton__channel-grid` 误命中，骨架态提前放行导致滚动断言挂）。

## 留痕说明

`src/pages/Browse/index.tsx`、`src/pages/Home/Home.css`、`scripts/browse.spec.ts` 三文件工作区
另有并行会话未提交 WIP；本次提交对这三文件采用「HEAD + 仅本次编辑」合成暂存，WIP 保留在工作区。
