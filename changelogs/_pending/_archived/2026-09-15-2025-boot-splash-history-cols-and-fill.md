---
date: 2026-09-15
module: index.html
type: fix
build: npm run build 通过（tsc -b 0 错 + vite build 26.87s；早前 LazyImage TS2322 已由并行会话修掉）
files: ['index.html']
demo:
---

## 启动骨架：历史页列数改对齐 .history-grid 真源 + 骨架底色与页面骨架统一

承接同日 `2026-09-15-1620-boot-splash-route-aware`（启动骨架按路由变形）。

- 反馈：「收藏 / 历史页骨架的 card 变宽了、颜色偏深，是固定 30/49 张吗？」
- 定位结论：
  1. **偏深**是真缺陷 —— 启动骨架的骨架填充用 `#e8e8e8`，而页面骨架（`Skeleton.css` → `--color-placeholder-shimmer-a/b`）是 `#f0f0f0 ↔ #e6e6e6` 扫光，启动骨架比其亮端深 8 级灰，交接时有一次「由深变浅」的跳变。
  2. **变宽**只在历史页成立 —— 启动骨架 `history` 形态复用了 `--iptv-cols` 档（4/5/5），而真实 `.history-grid` 是独立阶梯，`≥1920` 少一列（卡宽多约 20%）、`<480` 多一列（2 vs 真实 1）。收藏页无此问题（两分区分别同源 `--card-cols` / `--iptv-cols`）。
  3. **张数是硬编码**，与真实条数无关（各 `*Skeleton.tsx` 与启动骨架各形态均为固定数：collections 8+6、browse 16、iptv 12+9、history 8、detail/person 各 4 行）。30/49 是用户真实数据量，代码中不存在这两个数。

### 旧 → 新

| 项 | 旧 | 新 |
| --- | --- | --- |
| 骨架填充色（浅色） | `#e8e8e8`（= `--color-border-light`，与描边共用） | `#f0f0f0`（对齐 `--color-placeholder-shimmer-a`），描边保持 `#e8e8e8` |
| 骨架填充色（深色） | `#2a2a2a` | 不变（≈ 深色 shimmer `#1f1f1f ↔ #303030` 中值，已基本对齐） |
| 记录网格档 | 复用 `--iptv-cols`：`2 →3(768) →4(1024) →5(1440)` | 独立阶梯对齐 `.history-grid`：`1 →2(480) →3(768) →4(1024) →5(1440) →6(1920)`；TV 恒 5；App 无门控 → 同阶梯 |
| 海报档选择器 | `.bs-row`（通用） | `.bs-row--poster`（专属；静态首页行与 `grid('poster')` 均带此类） |
| 设备档 | `#boot-splash[data-cols] .bs-row` 通用 + `.bs-row--channel/--record/--iptvpage` | 每种网格各自一条（`--poster` / `--channel` / `--iptvpage` / `--record`），不再写通用 `.bs-row` |

### 顺带修掉的一个真 bug（本轮新发现）

原 `[data-cols="app"]` 通用档写成 `.bs-row:not(.bs-row--record)`：`:not()` 计入特异性 → (1,3,0)，反而压过 `.bs-row--channel` 的专属档 (1,2,0)，**App 档下频道 / IPTV 页网格被强制成海报的 3 列**（应为 2）。改为「每种网格各自持有完整阶梯」后消失。

### 验证

- 自写最小 CSS 层叠求值器（选择器列表 / `@media` 嵌套 / 特异性 / 后写覆盖）逐档核对：4 类网格 × 3 设备档（web/tv/app）× 9 视口（360→2560）= **108 项全通过**；记录网格另与 `History.css` 真源交叉核对 18 项全通过；浅色填充 10 处全为 `#f0f0f0`，`#e8e8e8` 仅剩 3 处描边。
- `npm run build`（`tsc -b` + `vite build`）通过；产物 `dist/index.html` 已含 `bs-row--poster`、480 档记录阶梯、`#f0f0f0`，`#e8e8e8` 仅 3 处（顶栏 / 筛选条 / 左栏描边）。
