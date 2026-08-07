# 构建 Warning 审阅报告（4 项）

> 状态：**仅分析，未改代码**。逐项列出：warning 来源 / 处理方法 / 处理后的潜在问题 / 处理能解决什么。待审阅后决定是否动手。

构建命令：`npm run build`。以下 4 个 warning 均为 **Rollup/Vite 打包阶段**输出，**不影响运行正确性**（`npm run build` 已通过、产物可正常加载）。

---

## ① Export "useIPTVStore" reexport 循环告警

**来源（构建原文）**
```
Export "useIPTVStore" of module "src/stores/useIPTVStore.ts" was reexported
through module "src/stores/index.ts" while both modules are dependencies of
each other and will end up in different chunks by current Rollup settings.
→ 建议：Either change the import in "src/pages/SourceChecker/index.tsx" to
  point directly to the exporting module ...
```

**根因**
- `src/pages/SourceChecker/index.tsx` 第 10 行：`import { useSettingsStore, useIPTVStore } from '@/stores'`（barrel 导入）
- `@/stores/index.ts` reexport `useIPTVStore`
- 而 `useIPTVStore` 内部（`useSourceManagerStore` 等）又直接导入 `useSettingsStore` / `useIPTVStore`，构成模块级相互依赖
- `manualChunks` 把 `zustand` + `/src/stores/` 全部归入 `state-vendor`；SourceChecker 本身是 **lazy 独立 chunk**，两者分属不同 chunk → reexport 形成跨 chunk 循环

**处理方法（2 选 1）**
1. **推荐**：`SourceChecker/index.tsx` 改直接导入 `useIPTVStore`：
   ```ts
   import { useSettingsStore } from '@/stores';
   import { useIPTVStore } from '@/stores/useIPTVStore';
   ```
2. 在 `manualChunks` 里把 SourceChecker 涉及的 store 强制并入 `state-vendor`（但 lazy 页不该并进公共 chunk，不推荐）

**处理能解决什么**
- 消除 1 条构建告警，构建输出更干净
- 消除潜在「chunk 间执行顺序」理论风险（Rollup 提示词）

**处理后的潜在问题 / 风险**
- **极低**。仅改一个 import 来源（语义完全等价，功能零影响）
- 需回归：源检测页（/source-checker）IPTV 维度仍能读到 `iptvSettings`，不报错

**结论**：收益低、风险极低，属于「顺手清洁」。**建议做**（一行改动）。

---

## ② Circular chunk: state-vendor -> react-vendor -> state-vendor

**来源（构建原文）**
```
Circular chunk: state-vendor -> react-vendor -> state-vendor.
Please adjust the manual chunk logic for these chunks.
```

**根因**
- `manualChunks` 强拆：`zustand`（state-vendor）依赖 `react`（react-vendor），react-vendor 里含 react-dom/路由等，某些路径又引用回 zustand → 两个 vendor chunk 互相引用成环
- 这是 **manualChunks 强拆固有副作用**，Vite 能处理、只是提示

**处理方法**
1. 把 `zustand` 从 `state-vendor` 挪到 `react-vendor`（zustand 本来跟 react 关系最紧）
2. 或调整 manualChunks 顺序/归并，让两 chunk 不再互相 import（如把 router 与 zustand 同 chunk）
3. 或对该 warning 用 `output.interop` / chunk 归并规避

**处理能解决什么**
- 消除 1 条告警
- 使 vendor chunk 依赖图无环，理论上缓存/加载顺序更干净

**处理后的潜在问题 / 风险**
- **中等**：manualChunks 是打包优化核心，改动可能改变 chunk 划分 → 影响浏览器缓存命中、首屏加载 chunk 数、个别页面多下载一个 chunk
- **必须回归**：全站导航（首页/浏览/详情/播放/IPTV/设置/源检测）逐一验证无 chunk 加载错误、无白屏、Keep-Alive 二次进入正常
- 若处理不当可能引发**新的循环**或 chunk 体积失衡

**结论**：纯告警，无功能风险。改动收益（仅整洁）与回归成本（全站验证）不成正比。**建议不动**。

---

## ③ epgService 动态 / 静态导入混用

**来源（构建原文）**
```
epgService.ts is dynamically imported by UniversalPlayer.tsx, hooks/useEPGData.ts
but also statically imported by EPGProgramList.tsx, pages/IPTV/index.tsx,
dynamic import will not move module into another chunk.
```

**根因**
- 静态导入：`EPGProgramList.tsx`（`import { formatTimeHHmm }`）、`IPTV/index.tsx`（`import { getEPGCacheTime, fetchAndParseEPG }`）
- 动态导入：`UniversalPlayer.tsx`、`useEPGData.ts`（`await import('@/services/epgService')`）
- 同一模块既被静态引用又被动态引用 → 动态导入「分不出独立 chunk」，警告

**处理方法（3 选 1）**
1. **全静态**：UniversalPlayer/useEPGData 也改静态 `import`（epgService 很小，无碍）
2. **全动态**：把静态导入处也改 `await import`（IPTV 首页首屏会变异步）
3. 维持现状

**处理能解决什么**
- 消除 1 条告警
- 若改「全静态」：epgService 并入主 bundle，少一次异步加载等待

**处理后的潜在问题 / 风险**
- **低～中**：
  - 改全静态：IPTV 首页/EPG 列表模块变大一点（epgService 体积很小），但**首屏可能提前加载 EPG 解析代码**（原本 EPG 在进入 IPTV/播放时才需要）
  - 改全动态：IPTV 首页首屏 EPG 数据请求变异步 → 首次进 IPTV 页可能「EPG 稍晚出现」，需防闪烁
- 两处改动都涉及播放器 + IPTV 首页，需回归播放页 EPG 栏与 IPTV 页 EPG 匹配

**结论**：纯告警，无功能风险。epgService 很小，收益有限。**建议不动**（或仅在后续重构播放器时顺手统一为全静态）。

---

## ④ dash-vendor 804.05 kB 超过 800kB 阈值

**来源（构建原文）**
```
(!) Some chunks are larger than 800 kB after minification.
dash-vendor ... 804.05 kB │ gzip: 235.93 kB
```

**根因**
- `dashjs` 库体积大（~804KB 未压缩 / 236KB gzip / 187KB brotli），被打进独立 `dash-vendor` chunk
- 超过 `chunkSizeWarningLimit: 800` 阈值 4KB

**处理方法（3 选 1）**
1. `chunkSizeWarningLimit` 从 800 提到如 900（**零代码改动**，纯配置）
2. 对 dashjs 做**按需子集化**引入（`dashjs` 支持只引播放器核心，省体积，但改动大、易坏）
3. 维持现状

**处理能解决什么**
- 仅消除 1 条**视觉告警**（构建日志不再刷黄字）
- 方法 2 若成功可实打实减小首屏/播放页体积

**处理后的潜在问题 / 风险**
- 方法 1（调阈值）：**零风险**，不影响产物任何字节
- 方法 2（子集化）：**高**，dashjs 特性裁剪可能破坏某些 DASH 流播放（`assets/*.mpd` 兼容性），需回归所有 DASH 源
- 注意：**dash-vendor 是 lazy 的**（播放到 DASH 流才拉取），并不阻塞首屏，所以「体积大」实际对用户体验影响很小

**结论**：调阈值是最优解（零风险、消除告警）；子集化收益小、风险高不划算。**建议：`chunkSizeWarningLimit: 900`（纯配置，一行）**，其余不动。

---

## 汇总

| # | Warning | 是否功能 bug | 处理方案 | 处理风险 | 我的建议 |
|---|---------|:---:|----------|---------|---------|
| ① | useIPTVStore reexport | 否 | SourceChecker 改直接导入 | 极低 | **做**（一行，顺手清洁） |
| ② | state-vendor→react-vendor 循环 | 否 | 调整 manualChunks | 中（需全站回归） | **不做** |
| ③ | epgService 动态/静态混用 | 否 | 统一为全静态/全动态 | 低～中（需回归播放+IPTV） | **不做** |
| ④ | dash-vendor 804KB | 否 | `chunkSizeWarningLimit: 900` | 零 | **做**（纯配置） |

**整体结论**：4 个 warning **均非功能 bug**，`npm run build` 通过、产物正常。建议只做 ①（一行改 import）与 ④（配置调阈值），②③ 保持不动以避免无谓的回归风险。

> 备注：本次会话同时已修复 **GroupPicker 折叠逻辑**（改用 `getBoundingClientRect` 相对容器偏移计算行高，彻底规避 `offsetTop` 依赖 offsetParent 导致折叠失效的问题），构建已验证通过。
