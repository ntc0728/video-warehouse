# Known Issues / 已知问题清单

> 集中登记项目已知问题、规避策略与历史教训。新发现问题请在此追加，避免散落各处。
> 约定：每个条目含「状态」「现象」「根因」「规避/修复」；已修复条目保留作历史教训。

---

## 1. [已修复 · 2026-08-05] H1：TMDB Token 保存后内存值被密文覆盖 → 同一会话 401

**状态**：✅ 已修复（`src/stores/useSettingsStore.ts` 改为「内存明文 + 持久化层加密」自定义异步 storage），单元测试 `useSettingsStore.test.ts` 防回归。

**现象**：用户在设置页保存 TMDB Token 后**不刷新页面**，首页/搜索/详情等所有 TMDB 功能返回 401；刷新后才恢复。再次打开配置弹窗显示的是密文而非明文。

**根因**：旧 `setTMDBToken` 先 `set(明文)`，随后异步 `encryptText().then(setState(密文))` **用密文覆盖内存**；而 `tmdbService.getAccessToken()` 同步读 store 值当 Bearer Token，运行时无人再解密。

**规避/修复**：内存恒为明文，AES-GCM 加密收敛到 persist 自定义 storage 的 setItem（写盘前加密），rehydrate 读入时解密。

**教训**：加密的"存储层"与"运行时内存层"必须分离；setter 内异步覆盖内存是隐性 401 根源。

---

## 2. [策略 · 生效中] scripts/backup-specs/ 旧测试不参与 E2E

**状态**：✅ 已配置规避。

**现象**：全量 `npx playwright test` 曾因递归执行 `scripts/backup-specs/`（gitignore 忽略的旧版测试备份）产生 20 个稳定失败，掩盖真实回归信号。

**根因**：`playwright.config.ts` 的 `testDir: './scripts'` 扫描文件系统时不读 `.gitignore`，把废弃测试也纳入执行。

**规避/修复**：`playwright.config.ts` 配置 `testIgnore: '**/backup-specs/**'`；真实 spec 181 用例应零失败。

**注意**：不要在 backup-specs 里改旧断言"修绿"——这些是历史快照，重构后的行为以主目录 spec 为准。

---

## 3. [已知 · 未修] HeroBanner 二次进入"上一张图闪现"

**状态**：⚠️ 已知（低影响，Keep-Alive 场景）。

**现象**：Keep-Alive 二次进入首页时，HeroBanner 偶发闪现上一张背景图。

**根因**：缩略图层是 GPU 合成层，祖先 transform 动画触发重绘；首页 `.page-transition-enter` 已刻意落在 `.home-page__content`（HeroBanner 兄弟节点）规避。

**规避**：勿在 `.home-page` 根容器加 transform 动画；slide 动画结束后不重置 `slideDir`（详见 AGENTS.md「HeroBanner 组件」）。

---

## 4. [雷区 · 已文档化] Keep-Alive 隐藏页异步加载导致布局测量失效

**状态**：⚠️ 已知雷区（已在 AGENTS.md 文档化）。

**现象**：隐藏页（`display:none`，`clientWidth=0`）期间完成的异步加载（剧照/推荐/CMS 源）会让依赖容器尺寸的逻辑（分页/虚拟滚动/自适应列数）永久失效，且 `ResizeObserver` 对 `display:none` 元素不触发。

**规避**：测量逻辑在容器不可见时改用视口宽度估算兜底；页面显示后由 ResizeObserver 用真实列数纠正。详见 AGENTS.md「异步数据 + 布局测量的隐形雷区」。

---

## 5. [历史教训] 骨架屏一致性（已修复，防回归）

**状态**：✅ 已修复（2026-07-28），见记忆库「首页骨架与真实/HeroBanner 内部骨架不一致」。

**教训**：修骨架一致性要逐层核对【宽度几何】【扫光底色/速度】【hero 外框 border/surface】【缩略图列背景】四维度，且每维度对照真实组件逐项比（真实列透明 ≠ 骨架列 surface）。

---

## 6. [设计约束] 禁止在源码硬编码视觉像素

**状态**：✅ 约定生效（ADR-006）。

**说明**：组件视觉尺寸一律走 Design Token（`--icon-*`/`--space-*`/`--text-*`/`--layout-*`）；`--icon-*` 必须 `calc(var(--text-<档>) * 系数)` 派生自文字 token。例外：`useMediaQuery` 断点值、`IntersectionObserver` 的 `rootMargin`、`<img sizes>`、`BottomSheet` 1px sr-only、`window.innerWidth` 列数兜底。

---

## 7. [安全提醒] 客户端加密的边界

**状态**：⚠️ 认知确认。

**说明**：AES-GCM 加密 key 硬编码在前端代码中（`src/lib/crypto.ts`），本地存储加密仅防"明文直读"，**不防逆向**。TMDB Token 本属公开可申请资源，此加密是轻量混淆，不可用于高敏凭据。

---

## 8. [待整改 · 2026-08-06] 测试回归精粒度：文件级 → 多层映射

**状态**：⚠️ 部分完成（4 个高频改动区已精粒度化，其余为文件级粗粒度）。

**现象**：修改单个文件的某处（如 `TMDBMovieRow/index.tsx` 的箭头逻辑），旧 `run-tests.ps1 -AutoDetect` 按**文件级**匹配整个 spec（如 home.spec.ts 33 个测试），回归成本高（"每次测试脚本 50 个起步"）。

**根因**：`uiTestMap` 为「文件 → 整个 spec 文件」的粗粒度映射，无按功能点（测试编号前缀）过滤。

**已整改**：
- `run-tests.ps1` 新增 `-Grep <编号前缀>` 参数：透传 `npx playwright test --grep`，手动精准回归（如 `-Grep "HOME-054"` 只跑 1 个测试，`-Grep "HOME-05"` 跑 9 个）。
- 新增 `uiPrecisionMap`（精粒度映射）：文件 → 测试编号前缀正则。当前覆盖 4 个高频改动区：
  - `src/pages/Home/index.tsx` / `Home.css` / `continueItems.ts`
  - `src/components/TMDBMovieRow/**`
  - `src/components/UniversalPlayer/**`（含 ControlBar/ToastTrigger/usePlayerCore）
  - `src/pages/Browse/**`（index/useBrowseData/BrowseMobileBar/FilterBar/SortBar）
- 精粒度优先，未命中才走文件级粗粒度兜底；`-Grep` 手动模式跳过 AutoDetect。

**待整改（后续）**：
- 将 `uiPrecisionMap` 扩展为**文件级 → 多层映射**：为每个 spec 的每个测试编号段维护「精确到测试编号」的映射（如 `src/pages/Detail/**` 拆到 DETAIL-001/002/…），使改任意文件都只跑最相关测试。
- 各 spec 测试编号段与功能点的对应关系需维护一份索引（可放 `scripts/README` 或 `TEST-CASES.md`）。

**规避/验证**：改高频区文件时 `.\scripts\run-tests.ps1 -AutoDetect` 或 `-Grep "<编号前缀>"` 即可精准回归；全量回归仍用 `npx playwright test`。

---

*维护约定：新增问题按上述模板追加；已修复条目标记日期后保留作教训。此文件与 KNOWLEDGE.md 的 ADR、AGENTS.md 约定互为补充。*
