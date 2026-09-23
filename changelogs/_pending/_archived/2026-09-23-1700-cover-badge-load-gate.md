---
date: 2026-09-23
module: VideoCard / HeroBili / IPTVChannelCard / RecordCard / VideoCard.tsx
type: 交互门控 + 缺陷修复
build: ✅ npm run build + lint:all 全绿
tests: home + iptv + history 25 passed / 30.5s（preview dist，budget 120s，retries 0）
files:
  - src/components/VideoCard/VideoCard.css
  - src/components/VideoCard/VideoCard.tsx
  - src/components/HeroBanner/HeroBili.css
  - src/components/IPTVChannelCard/IPTVChannelCard.css
  - src/components/RecordCard/RecordCard.css
demo: （无独立 demo，真实页看封面加载/失败态）
---

# 四卡封面角标/收藏/进度按 LazyImage 加载态 CSS 门控

## 范围（用户拍板）

- 做：VideoCard / HeroBili 右卡 / IPTV 频道卡 / RecordCard 的封面角标、hover 收藏钮、进度条。
- 不做：批量勾选框 `record-card__check`。
- 失败态必须显示角标（与加载成功同等待遇）。

## 门控真源

- 以封面容器内是否存在 `.lazy-image-placeholder`（LazyImage.tsx:430 扫光占位）为唯一信号：
  - 扫光中 → 隐藏 `opacity:0; pointer-events:none`（fav 另加 `scale(0.8)`）；
  - `.loaded` / `.error`（exhausted）/ 空源（无 placeholder）→ 显示。
- 比 `:not(.loaded):not(.error)` 准：空源不挂 error class，会永久误隐。

## 旧逻辑 → 新逻辑

1. **VideoCard 收藏钮 JS 门控缺陷**
   - 旧：`VideoCard.tsx` `imageLoaded` 仅 `onLoad` 置真（:333/:354），加载失败永不置真 → 失败卡红心永不渲染（IPTV 侧同坑已在 IPTV-090 修过）。
   - 新：删 `imageLoaded` state + `isImageLoaded` import + `onLoad`；渲染条件去掉 `imageLoaded &&`；显隐全部交给 CSS。
2. **四卡角标/进度扫光期可见**
   - 旧：角标与封面骨架同框，扫光时叠在 shimmer 上。
   - 新：各 CSS 尾部 `cover:has(.lazy-image-placeholder)` 门控——VideoCard 四角标+status+横版进度/源标；HeroBili corner+fav；IPTV badges/group/source/fav（fav 在 wrap 上用 `wrap:has`）；RecordCard live+progress。
3. **特异性**
   - 门控选择器放各文件末尾并加 `:hover/:focus-within/[data-device=tv]` 等前缀，压过既有显形规则（fav hover 0,4,0 / TV focus 0,5,0 / touch 常显）。

## 验证

- `npm run build` ✓；`npm run lint:all` ✓（design/css/json/version-sync/eslint 全绿；eslint 需 `test-results/` 存在——e2e skeleton 清理该目录会导致 ENOENT，补空目录后过）。
- E2E：`node scripts/e2e-skeleton.mjs scripts/home.spec.ts scripts/iptv.spec.ts scripts/history.spec.ts --budget 120 --retries 0` → 25 passed / 30.5s（含 HOME-088/089、IPTV-090）。
- 全量 E2E 未跑（未放行）。
