---
date: 2026-09-24
module: Browse
type: UI 调整（首屏骨架尺寸 + 失败态）
build: ✅ npm run build 通过
files:
  - src/pages/Browse/BrowseChromeSkeleton.css
  - src/pages/Browse/index.tsx
demo: 无（尺寸对齐与去按钮，非视觉方案分叉）
---

# Browse 左栏骨架 chip 尺寸对齐真实 tab + 加载失败态去掉重试按钮

## 问题

1. 首屏 chrome 骨架左栏 chip 比真实筛选 chip 大一圈（高度 36 vs ≈20、全宽胶囊 vs 贴文字宽），数据到达时形态跳变。
2. 加载失败 Empty 带「重试」按钮，与收藏/历史空态结构不一致（用户拍板：对齐空态样式、仅保留 error 红叉、去掉重试）。

## 旧逻辑 → 新逻辑

### 1. 骨架 chip 尺寸

- **旧**：`BrowseChromeSkeleton.css` `.browse-chrome-skeleton__chip` 只有基础档
  `width:100% + height:var(--comp-tab-height) + radius-full`；未带 `filter-bar__chip` 类，
  吃不到 `Browse.css` ≥1024 桌面 rail 覆盖（高 ≈ text-sm+space-xs×2、radius-md、贴文字宽 + justify-self:start）。
- **新**：补 `@media (width >= 1024px)` + `html:not([data-device=app]):not([data-device=tv])`
  同守卫覆盖块——`width: 3.2em`（nth-child(2n) 2.6em 模拟 2 字 chip 参差）、
  `height: calc(var(--text-sm) + var(--space-xs) * 2)`、`radius-md`、`justify-self: start`、`font-size: var(--text-sm)`。
  基础档（<1024）仍为全宽胶囊（左栏仅桌面出现，该档主要防窄容器形态错）。

### 2. 加载失败态

- **旧**：`Browse/index.tsx` 失败 Empty 传 `onRetry / retryText / isRetrying`（含 `retryCmsSearch` 死代码入口）。
- **新**：三 prop 删除，仅保留 `status="error"` + title/description；注释改为
  「2026-09-24 拍板：结构对齐收藏/历史空态——保留 error 红叉，去掉重试按钮」。
  同步删除仅被该按钮引用的 `retryCmsSearch`（`searchCMS`/`lastCmsSearchedRef` 仍有其它调用方，未动）。

## 验证

- `npm run build` ✅（tsc -b && vite build 33s）
- 受影响 spec：`skeleton.spec.ts`（chip count 断言 6+8+8 不变）、`browse.spec.ts`（无 retry-btn 断言）
- 全量 lint:all / 增量 E2E 在五项改动收尾统一跑
