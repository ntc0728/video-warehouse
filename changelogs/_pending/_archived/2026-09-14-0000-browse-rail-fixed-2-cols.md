---
date: 2026-09-14 00:00
module: Browse 左栏 rail chips 列数
type: fix
build: npm run build 通过；Playwright 1440/1920/2560 三档视口实测均为 2 列
files:
  - src/pages/Browse/Browse.css（chips 网格 auto-fill → 固定 2 列）
demo: 无（Playwright 脚本实测后即删）
---

## 用户反馈 → 根因 → 修复

### 左栏筛选条件在大视口下显示 3~4 列，应恒为两列

- **根因**：2026-09-10 拍板 B+C 把左栏 chips 网格改成
  `repeat(auto-fill, minmax(56px, 1fr))` 自适应列数；左栏宽度
  `--rail-w = clamp(148px, 10vw, 248px)` 随视口增宽，auto-fill 跟着多排列——
  1440 档 2 列、1920 档 3 列、2560 档 4 列。列数不受控。
- **修复**：`grid-template-columns: repeat(2, minmax(0, 1fr))` 固定两列，
  任何视口恒 2 列；长词 `--full` 独占整行机制不变。
  等价于「auto-fill 封顶 2 列」（rail 最窄 148px 也容得下 2×56px，无需保留自适应）。
- **验证**：Playwright 读 `getComputedStyle().gridTemplateColumns` 列数，
  1440/1920/2560 三档均 = 2。
