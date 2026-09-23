---
date: 2026-09-23
module: Browse
type: UI 调整（首屏 chrome 骨架）
build: ✅ npm run build + lint:all 全绿
tests: 受影响 spec：scripts/skeleton.spec.ts + scripts/browse.spec.ts
files:
  - src/pages/Browse/BrowseChromeSkeleton.tsx
  - src/pages/Browse/BrowseChromeSkeleton.css
  - src/pages/Browse/index.tsx
  - src/pages/Browse/BrowseSkeleton.tsx
  - src/pages/Browse/BrowseSkeleton.css
  - scripts/skeleton.spec.ts
demo: 无（行为类：首屏加载态，非视觉方案分叉）
---

# Browse 首屏：接口未响应前左栏/顶栏渲染 chrome 骨架

## 范围（用户 2026-09-23）

首次进入 Browse，在接口未响应结束之前，左栏与顶栏不显示筛选项（智能检索/直链搜索模式 tab 除外），应显示骨架。

## 旧逻辑 → 新逻辑

1. **左栏 FilterBar / 顶栏 browse-sort-bar**
   - 旧：加载期真实筛选项（chips / type·tab 按钮 / 计数）恒在渲染；BrowseSkeleton 注释明确「排序条不由骨架镜像」（2026-09-22 方向 A）。
   - 新：本次挂载首拍终态（有数据 / 首轮 loading 结束 / 错误 / 直链模式）之前，左栏与顶栏渲染 `BrowseChromeSkeleton`（结构镜像真实 `.filter-bar` / `.browse-sort-bar`，根类复用以继承 grid-area）；模式 tab 始终真实。`chromeSettled` 一次锁死，后续筛选/翻页不回骨架；有数据/错误时当帧换真（不等 effect）。
2. **结果网格骨架**
   - 仍由 `BrowseSkeleton` 负责，与 chrome 骨架同帧并存（不同 grid-area），不叠现。
3. **E2E SKEL-014**
   - 旧：断言加载期真实 sort-bar 恒 7/3/1、骨架不得镜像排序条。
   - 新：断言 chrome 骨架可见、真实筛选项 count=0、模式 tab=2、chrome pill 数=7/3、左栏 chip 占位=22、网格骨架结构不变。

## 验证

- `npm run build` + `npm run lint:all` 全绿。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/skeleton.spec.ts scripts/browse.spec.ts --budget 120 --retries 0` → **31 passed (22.0s)**，含重写后的 SKEL-014 与 BROWSE-020/023/025。
