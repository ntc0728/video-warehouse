# 无障碍与设计规范 · 提交前自查清单

> **配套**：[BASELINE.md](./BASELINE.md)（规范真源）·《[审查报告](../DESIGN-REVIEW-2026-09-15.md)》·《[实施方案](../DESIGN-PLAN-2026-09-15.md)》
> **适用**：任何改动颜色 / 字号 / 间距 / 控件尺寸 / 焦点 / 浮层的 PR。
> **口径**：本清单按「能被机器拦下的」和「必须人眼复核的」分开。机器项已接入 `pnpm run lint:all`（见 §B7.2 护栏）。

---

## A. 机器项（改完直接跑，必须全绿）

| # | 检查 | 命令 | 失败含义 |
| --- | --- | --- | --- |
| A1 | 生产构建通过 | `npm run build` | 类型/未用变量/构建错误。沙箱清 dist 撞批量删除保护时用 `npx tsc -b && npx vite build --emptyOutDir false` |
| A2 | CSS 规范 | `pnpm run lint:css` | 裸 px、`100vw/100vh`、属性顺序等 |
| A3 | 硬编码颜色 | `pnpm run lint` | `className` / `style={{}}` / TS 颜色常量里出现裸 hex 或 Tailwind 默认调色板 |
| A4 | 设计基线审计 | `pnpm run lint:design` | 新增裸 hex、越档字号、未知状态色、裸 z-index |
| A5 | 单元测试 | `npm run test` | 行为回归 |
| A6 | E2E（涉布局/交互时） | `npx playwright test` | 端上真实渲染回归 |

---

## B. 人眼项（逐条过，改到哪条查哪条）

### B1. 对比度（WCAG 2.2 AA）

- [ ] **正文 ≥4.5:1**。用 `--color-text` / `--color-text-secondary` / `--color-text-tertiary`，不要自造灰。
- [ ] **大字（≥18.66px 常规 或 ≥24px）≥3:1**。
- [ ] **UI 组件 / 图形边界 ≥3:1**（输入框边框、开关轨道、进度条）。
- [ ] **低于 4.5:1 只允许**：禁用态、占位符、纯装饰图标 —— 且必须用 `--color-text-disabled`。
- [ ] **状态色不得直接当文字色**：`--color-success` / `--color-warning` / `--color-error` / `--color-info` 只是**填充档**（白底 2.27–4.10:1）；承载信息的文字/图标一律用 `--color-success-text` / `--color-warning-text` / `--color-error-text` / `--color-info-text`。
- [ ] **红只表示危险 / LIVE**。年份、类型、分类等中性信息不得用红色。
- [ ] **封面角标**用 `.badge-chip`（中性深玻璃底 + 白字）。不得「彩色半透明底 + 白字」承担语义（浅色封面上可低至 2.04:1）。

核算脚本见 BASELINE.md §八；新颜色进 token 前必须算一遍并把数值写进注释。

### B2. 焦点可见（WCAG 2.4.7 AA）

- [ ] 键盘 Tab 能到达所有可交互元素。
- [ ] 焦点环可见：非 TV 端 `outline: 2px solid var(--color-primary)` + `offset: 2px`；TV 端 3px。
- [ ] **没有** `outline: none` 而无替代焦点样式。
- [ ] 焦点环不被 `overflow: hidden` 裁掉（必要时加内嵌方框，如分段控件）。

### B3. 缩放与视口（WCAG 1.4.4 AA）

- [ ] `index.html` 的 viewport **不含** `user-scalable=no` / `maximum-scale=1`（本仓已移除，勿回退）。
- [ ] `viewport-fit=cover` 保留，安全区用 `env(safe-area-inset-*)`。
- [ ] 200% 缩放下关键内容不重叠、不截断。

### B4. 触摸目标（HIG 44pt / WCAG 2.5.8 AA ≥24px）

- [ ] 移动端按钮高度 ≥ `--comp-btn-min-height`（移动端 = 44px）。
- [ ] 移动端 Tab 高度 ≥ `--comp-tab-height`（移动端 = 36px）。
- [ ] 图标按钮命中区 ≥ `--tap-target`（44px），视觉图标可小但命中区不可小。
- [ ] 相邻可点元素间距 ≥8px。

### B5. 端差异（移动 / 桌面 / TV）

- [ ] 字号只用 `--text-*`，**不写裸 px**。
- [ ] 大屏字号**不小于**小屏（段2 只增不减）。
- [ ] 相邻字号档差 ≥1px（含 `--ui-scale` 放大后）。
- [ ] TV（`[data-device="tv"]`）走 10-foot 基线：正文 20sp@1080p / 40@4K。
- [ ] 新增桌面样式放进 `@media (width >= 1024px)`；TV 覆盖集中在 `[data-device="tv"]` 块。

### B6. 浮层层级

- [ ] z-index 用 `--z-*` token（见 BASELINE.md §五），不写裸数字。
- [ ] 局部浮层（Popover/Tooltip）在 `--z-popover`(200) 档：高于吸顶导航、低于 Modal。
- [ ] 全屏播放器压在 `--z-fullscreen`(9999)，启动骨架 `--z-splash`(10000) 必须压住一切。

### B7. 动效（WCAG 2.3.3 / 2.2.2）

- [ ] `prefers-reduced-motion: reduce` 下关闭/减弱非必要动画。
- [ ] 减动效分支的注释与实现一致（**已知历史坑**：`animations.css` 注释与实现曾不符）。
- [ ] 自动播放的动效 >5s 时可暂停。

---

## C. 收尾项

- [ ] 改完当天在本机跑 A1–A4；涉布局再跑 A6。
- [ ] 观感类改动附可双击打开的对照 demo（`changelogs/demos/`）。
- [ ] 写 `changelogs/_pending/<YYYY-MM-DD-HHmm>-<slug>.md` 片段。
- [ ] push 前把「跨会话仍成立」的结论提炼进 `docs/`（本目录）/ `.workbuddy/memory/ref-*.md`。

---

**维护**：本清单随 BASELINE.md 同步；新增机器可查项时，同时加脚本并挂进 `lint:all`。
