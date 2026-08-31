# 点播播放器（/play）现状调研与整改计划

> 范围：仅点播（VOD）播放器 `UniversalPlayer` 组件群 + `Player` 页面。**IPTV 播放器不在本次范围。**  
> 调研方式：通读播放器源码（带 `file:line` 证据）+ 对照 B站 / YouTube / Netflix 桌面与移动端交互规范。  
> 配套 Demo：`/player-lab`（源码 `src/pages/PlayerLab/`），用于验收交互方向后再铺回真实播放器。

---

## 0. 先说结论

播放器"功能壳"基本齐全（倍速、画质、PiP、外挂字幕、自动切代理、续播 toast 都在），**真正的问题是"交互层"**：  
手势半残、进度条不可键盘访问、高频状态走全局 store 导致整页重渲染、错误/续播提示过于简陋、快捷键覆盖度低且语义偏离主流。

按"影响用户体感"排序，**最该先改的是移动端滑动 seek 手势（目前干脆没有）和进度条无障碍/性能**。

---

## 1. 行业基线（B站 / YouTube 实测要点）

### 桌面端

- **控制栏自动隐藏**：鼠标静止 ~3s 隐藏；移到底部进度条区域（约 120px）立即显示；Hover 进度条出时间气泡。
- **快捷键**（YouTube / B站通用）：`Space/K` 播放暂停、`J/L` 后退/前进 10s、`←/→` ±5s、`Shift+←/→` ±10s、`↑/↓` 音量、`M` 静音、`F` 全屏、`Home/End` 头尾、`0–9` 跳 0–90%、`,/.` 逐帧、`C` 字幕、`P` 画中画、`Esc` 退出、`Shift+?` 快捷键面板。
- **进度条**：缓冲条 + 拖拽 scrub（拖拽时出大号时间预览）+ hover 缩略图 + 章节分割；键盘 `role=slider` 全可达。
- **B站特有细节**：宽屏(T)/网页全屏(W)、进度条热点标记、退出全屏恢复滚动位置、长按倍速、双击全屏。

### 移动端（B站 App / YouTube）

- **左右半屏分工**：左半屏上下滑 = 亮度，右半屏上下滑 = 音量；**左右滑动 = seek**（增量累加，非绝对映射）。
- **手势阈值**：方向锁定 slop ≈ 8–16px；双击 = 播放/暂停；**长按（≈1.5s）= 进入倍速（2x/3x）**，松手恢复；单击 = 显隐控制栏。
- **反馈 UI**：seek 时居中大号「«/» 时间」气泡；音量/亮度竖向条；倍速徽章。
- **锁定按钮**：防误触；安全区 `env(safe-area-inset-*)` 适配；触摸目标 ≥ 44px。

---

## 2. 现有实现问题清单（带证据）

### A. 架构与状态

- **【高频状态走全局 store，整页重渲染】** — `usePlayerCore.ts:250-264`：`handleTimeUpdate` 每次 `timeupdate`（≈4Hz）调用 `usePlayerStore.setProgress`。进度条、时间文本、任何订阅该 slice 的组件每帧 reconcile。整改见 Demo 的 `MediaEngine.onFrame` 直写 CSS 变量方案。
- **【进度条拖拽每帧多 setState】** — `ProgressBar.tsx:49-52, 109-111`：拖拽中 `setPendingTime/setPendingPosition` 每帧触发控制栏重渲染。

### B. 桌面交互

- **【快捷键覆盖度低 + 语义偏离】** — `useKeyboardShortcuts.ts:101-160`：缺 `K/J/L(前跳)/0–9/,.帧/Home/End/PgUp/PgDn/C字幕/P画中画/W网页全屏/T宽屏/Shift+?面板`；且 `L` 被复用为"循环模式"而非"前进 10s"（与 B站/YouTube 冲突）。
- **【输入框排除不全】** — `useKeyboardShortcuts.ts:59-60`：只排除 `input/textarea/select`，未排除 `contentEditable` 与聚焦的 slider/button，存在误触发风险。
- **【单击播放延迟 250ms】** — `usePlayerClickHandler.ts:56-63`：为区分双击全屏，单击 togglePlay 被 `setTimeout(250ms)` 推迟，手感发钝。移动端单次点击播放尤其明显。

### C. 进度条

- **【零 ARIA / 零键盘可达】** — `ProgressBar.tsx:173-205`：根节点无任何 `role/tabIndex/aria-*`/键盘事件，屏幕阅读器与键盘用户完全无法操作进度。
- **【hover tooltip 无边界钳制】** — `ProgressBar.tsx:194`：`left: ${hoverPosition}%` 未对气泡宽度做钳制，进度条两端 tooltip 溢出裁切。
- **【触摸目标过小】** — 进度条视觉高度 + 热区未扩展到 44px（CSS `.up-progress-bar` 区域），移动端点不准。

### D. 移动端手势（最严重）

- **【横向滑动 seek 被整段丢弃】** — `useTouchGesture.ts:118-122`：检测到横向主导直接 `gestureRef.current = null; return;`，**完全没有滑动 seek 手势**，等于移动端无法手势快进。
- **【音量初值硬编码 0】** — `useTouchGesture.ts:32,37`：`useState(0)` 与 `useRef(0)`，滑动调节前音量显示恒为 0，与实际音量脱节。
- **【纵向手势无条件 preventDefault 锁死页面滚动】** — `useTouchGesture.ts:129`：非全屏嵌入场景下纵向滑动也阻止默认行为，页面无法滚动。
- **【手势监听不排除控制栏/头部】** — `useTouchGesture.ts:85-152`：touch 监听挂在容器上，触摸控制栏/头部也会触发亮度/音量手势，与控件操作冲突。
- **【无长按倍速、无双击反馈、无手势 HUD】** — 整个移动端缺 B站式手势反馈体系（见 Demo `GestureHUD`/`RateBadge`）。

### E. 无障碍与语义

- **【控制栏按钮缺 aria-label/title】** — 多处图标按钮仅靠图标，无文本替代（影响读屏与悬停提示）。
- **【进度条无语义角色】** — 见 C 节。

### F. 功能缺口（已核实"已有 vs 缺失"）

> 核实结论：**PiP、倍速、画质切换、外挂字幕 URL、自动切代理、续播 toast 均已存在**，不要重复造。真正缺失的是下面这些"体验层"能力：

- **【字幕仅有外挂 URL，无样式/多轨】** — `SubtitleControl.tsx:16,34`：只有单一 `subtitleUrl`，无字号/颜色/背景/位置设置，无内嵌多轨切换。
- **【无快捷键面板】** — 没有 `Shift+?` 调出的快捷键说明（B站/YouTube 标配）。
- **【无章节标记 / 进度热点】** — 进度条无分段。
- **【无右键菜单】** — 桌面无 `复制时间 / 倍速 / 画中画` 等快捷菜单。
- **【无自动连播下一集倒计时】** — 剧集播放结束无"X 秒后播放下一集"UI。
- **【无长按倍速（移动）】** — 见 D。
- **【倍速/画质缺"记忆上次选择"】** — 刷新后回到默认档，未持久化用户偏好。

### G. 错误处理与恢复

- **【错误提示过简、无 actionable 重试】** — `PlayerCore.tsx:81` 仅 `<p>播放失败，请检查网络连接</p>`（单一文案，无错误码区分）；`usePlayerCore.ts:419` 用 toast 提示"点击屏幕重试"，但无显式「重试 / 换源」按钮，用户常不知道点哪。
- **【续播提示过于简陋 + 回归】** — `useProgressRestore.ts:90,103` 仅有 toast「已自动跳转到上次观看的位置」，无「从头播放」选项；`UniversalPlayer.tsx:865` 注释明确指出"手动续播无提示（历史回归点）"。

### H. CSS / 样式

- **【控制栏浅色主题对比度】** — 浅色主题下控制栏渐变遮罩与文字对比不足（需按主题切换遮罩强度）。
- **【z-index 与硬编码尺寸】** — 播放器内多层浮层 z-index 依赖魔法数字，新增浮层易层级错乱。
- **【移动端适配靠 max-width 猜测】** — 部分断点未对齐项目既有 token（`useIsMobile() = max-width:1023px`，非 768），存在桌面/移动判定漂移。

### I. 代码坏味道

- **【定时器/监听泄漏风险】** — `useLongPress`、`usePlayerCore` 等存在未在卸载/依赖变化时清理的 `setTimeout`（对比 Demo `useGestures` 的卸载清理）。
- **【闭包陷阱】** — 快捷键 `handleKeyDown` 依赖项含 `playerCore` 对象，重渲染即重绑监听，存在旧闭包捕获过期状态风险（`useKeyboardShortcuts.ts:163-171`）。

---

## 3. 整改计划（分阶段）

### P0 — 体感硬伤，必须改（建议第 1 阶段）

| #    | 问题               | 方案                                                                                          | 涉及文件                                    | Demo 对应                          |
| ---- | ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------- |
| P0-1 | 移动端无滑动 seek      | 重写手势：横向增量 seek + «/» 反馈；左右半屏亮度/音量；长按倍速                                                      | `useTouchGesture.ts` + 新增 `useGestures` | `engine/useGestures.ts`          |
| P0-2 | 进度条不可键盘访问        | 加 `role=slider`+`aria-value*`+ 方向键/Home/End                                                 | `ProgressBar.tsx`                       | `components/DemoProgressBar.tsx` |
| P0-3 | 高频状态走 store 重渲染  | 进度条改 rAF 直写 CSS 变量，低频文本走 100ms 节流                                                           | `usePlayerCore.ts` + `ProgressBar.tsx`  | `engine/MediaEngine.ts`          |
| P0-4 | 音量初值硬编码 0        | 手势开始时从真实音量同步一次                                                                              | `useTouchGesture.ts:32,37`              | `useGestures.ts`                 |
| P0-5 | 纵向手势锁死页面滚动       | 非全屏只拦横向，全屏才吃下全部                                                                             | `useTouchGesture.ts:129`                | `useGestures.ts`                 |
| P0-6 | 手势误触控制栏          | `closest('.no-gesture')` 排除 UI 区                                                            | `useTouchGesture.ts`                    | `useGestures.ts`                 |
| P0-7 | 缓冲中无法暂停（暂停入口被自锁） | 移除 `togglePlay` 暂停分支 `if (isBuffering) return;`，依赖 `handlePause` 的 `setBuffering(false)` 解锁 | `usePlayerCore.ts:450-451`              | —                                |


### P1 — 体验补齐（第 2 阶段）

| #     | 问题                 | 方案                                                                                            | 涉及文件                                                            | Demo 对应                      |
| ----- | ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| P1-1  | 快捷键缺口 + L 语义冲突     | 补齐 K/J/L(前跳)/0–9/,.帧/Home/End/C/P/W/T/Shift+?；L 改回前跳 10s，循环改用别的键                              | `useKeyboardShortcuts.ts`                                       | `index.tsx` 键盘区              |
| P1-2  | 单击延迟 250ms         | 移动端单击=显隐控制栏立即响应；双击=全屏；播放/暂停放到双击或独立按钮                                                          | `usePlayerClickHandler.ts`                                      | `useGestures.ts` onSingleTap |
| P1-3  | 错误提示简陋             | 媒体错误码翻译 + 「重试 / 换源」按钮                                                                         | `PlayerCore.tsx:81`、`usePlayerCore.ts:419`                      | `DemoOverlays` 错误态           |
| P1-4  | 续播无「从头播放」+ 回归      | 续播卡片带「从头播放」；修复手动续播无提示                                                                         | `useProgressRestore.ts`、`UniversalPlayer.tsx:865`               | `DemoOverlays ResumeToast`   |
| P1-5  | 无快捷键面板             | `Shift+?` 调出快捷键表                                                                              | 新增 `ShortcutHelp`                                               | `DemoOverlays ShortcutHelp`  |
| P1-6  | 无右键菜单              | 桌面右键菜单（复制时间/倍速/画中画）                                                                           | 新增 `ContextMenu`                                                | `DemoOverlays ContextMenu`   |
| P1-7  | 字幕无样式/多轨           | 字幕样式设置 + 多轨切换                                                                                 | `SubtitleControl.tsx`                                           | —                            |
| P1-8  | 倍速/画质无记忆           | 持久化上次选择到 localStorage                                                                         | `usePlayerCore.ts`                                              | `index.tsx` 设置面板             |
| P1-9  | 无障碍按钮标签            | 控制栏按钮补 `aria-label`/`title`                                                                   | `ControlBar/*`                                                  | —                            |
| P1-10 | 慢网下续播进度/播放按钮长时间不出现 | 恢复"数值展示"与"实际 seek"解耦：IndexedDB 命中先写 store 展示（pendingTime），canplay 后再 seek                     | `usePlayerCore.ts:179,206-210` / `useProgressRestore.ts:82-107` | `MediaEngine` pendingTime    |
| P1-11 | 缓冲中可拖拽进度条（产品决策）    | 当前有意允许缓冲中 seek（审查报告 1.4）；若需禁止，给 ProgressBar 传 `isBuffering` 并在 `beginDrag` 加守卫（折中：仅允许拖到已缓冲区间） | `ProgressBar.tsx:55-58`                                         | —                            |

### P2 — 打磨（第 3 阶段）

- P2-1 章节标记 / 进度热点（`ProgressBar` 章节分段）。
- P2-2 自动连播下一集倒计时 UI。
- P2-3 浅色主题控制栏对比度 + z-index token 化 + 断点对齐 `useIsMobile`。
- P2-4 触摸目标统一 ≥ 44px。
- P2-5 定时器/监听清理 + 快捷键闭包陷阱修复。
- P2-6 移动端更多设置弹窗缺 `env(safe-area-inset-bottom)`（iOS 贴 Home 条）— `BottomSheet.tsx:95`
- P2-7 移动端"格式不支持"toast 屏幕居中（50%）可能与中间播放按钮/缓冲 mascot 重叠 — `index.css:1035-1037`

---

## 4. 落地清单（Checklist）

### P0

- [ ] 重写移动端手势引擎（增量 seek / 半屏亮度音量 / 长按倍速 / 双击）— `useTouchGesture.ts` → 参考 `PlayerLab/engine/useGestures.ts`
- [ ] 进度条加 ARIA + 键盘操作 — `ProgressBar.tsx`
- [ ] 进度条 rAF 直写 CSS 变量，去 store 重渲染 — `usePlayerCore.ts` + `ProgressBar.tsx`
- [ ] 修正音量初值、纵向手势 preventDefault 分级、UI 区排除
- [ ] 缓冲中可暂停：移除 togglePlay 暂停分支 isBuffering 拦截 — `usePlayerCore.ts:450-451`

### P1

- [ ] 快捷键补齐 + L 语义修正 — `useKeyboardShortcuts.ts`
- [ ] 单击即时响应 — `usePlayerClickHandler.ts`
- [ ] 错误态：错误码翻译 + 重试/换源按钮 — `PlayerCore.tsx` / `usePlayerCore.ts`
- [ ] 续播卡片 + 修复手动续播回归 — `useProgressRestore.ts` / `UniversalPlayer.tsx`
- [ ] 快捷键面板 `Shift+?`、右键菜单 — 新增组件
- [ ] 字幕样式设置 + 多轨切换 — `SubtitleControl.tsx`
- [ ] 倍速/画质记忆 — `usePlayerCore.ts`
- [ ] 控制栏按钮 aria-label — `ControlBar/*`
- [ ] 续播进度展示与 seek 解耦（pendingTime 先展示）— `useProgressRestore.ts` / `usePlayerCore.ts`
- [ ] 缓冲中进度条拖拽策略决策（禁拖 / 限已缓冲区）— `ProgressBar.tsx`

### P2

- [ ] 章节标记 / 进度热点
- [ ] 自动连播倒计时
- [ ] 浅色主题对比度 / z-index token / 断点对齐
- [ ] 触摸目标 ≥ 44px
- [ ] 更多设置弹窗 safe-area-inset-bottom — `BottomSheet.tsx:95`
- [ ] 移动端格式不支持 toast 定位优化 — `index.css:1035-1037`
- [ ] 定时器清理 + 快捷键闭包修复

---

## 5. Demo 说明（/player-lab）

源码：`src/pages/PlayerLab/`

- `engine/MediaEngine.ts` — 媒体引擎抽象：`onFrame`（每帧直写 DOM，零重渲染）+ `subscribe`（100ms 节流驱动 React 低频 UI）。对照 P0-3。
- `engine/useGestures.ts` — 完整手势引擎（seek/亮度/音量/长按倍速/双击/单击），阈值对齐 B站/YouTube。对照 P0-1/4/5/6。
- `components/DemoProgressBar.tsx` — 带 ARIA + 键盘 + 章节 + 边界钳制 tooltip。对照 P0-2/C。
- `components/DemoOverlays.tsx` — 手势 HUD、倍速徽章、快捷键面板、续播提示、右键菜单、错误态。对照 P1-3/4/5/6。
- `index.tsx` + `PlayerLab.css` — 拼装 + 桌面/移动对比侧栏。

**如何验收**：`npm run dev` → 访问 `/player-lab`。

- 桌面：键盘全快捷键（`Shift+?` 看面板）、双击全屏、右键菜单、点"演示错误态"看重试、点"演示续播提示"看卡片。
- 移动：DevTools 触摸模拟 / 真机 —— 左右滑 seek（居中时间气泡）、半屏上下滑调亮度/音量（竖向条）、长按倍速（徽章）、单击显隐控制栏、🔒 锁定。

确认方向后，按第 4 节清单逐项替换真实 `UniversalPlayer` 实现。

---

## 6. 最严重 Top 10（按用户体感）

1. **移动端完全不能滑动快进**（横向手势被丢弃）— `useTouchGesture.ts:118-122`
2. **进度条键盘/读屏不可用** — `ProgressBar.tsx:173-205`
3. **播放中整页每帧重渲染** — `usePlayerCore.ts:250-264`
4. **音量初值恒为 0** — `useTouchGesture.ts:32,37`
5. **纵向手势锁死页面滚动** — `useTouchGesture.ts:129`
6. **单击播放延迟 250ms** — `usePlayerClickHandler.ts:56-63`
7. **快捷键缺一半且 L 语义错** — `useKeyboardShortcuts.ts:101-160`
8. **错误提示只有一句、无重试按钮** — `PlayerCore.tsx:81`
9. **续播无「从头播放」+ 手动续播回归** — `useProgressRestore.ts:90` / `UniversalPlayer.tsx:865`
10. **手势误触控制栏** — `useTouchGesture.ts:85-152`

---


## 7. 用户补充问题核实（2026-08-31 第二轮）

> 用户使用过程中新发现 8 个问题。逐条用代码核实，结论分四档：**确认 bug / 部分成立 / 误报 / 待确认**。下表为核实结果，详细证据见各条。

| #  | 用户反馈               | 判定             | 关键证据                                                                                                                                                | 处置            |
| -- | ------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1  | 格式不支持提示在播放器居中      | **部分成立**       | 桌面端定位合理（播放器内顶部居中 `index.css:1022-1028`）；移动端 sonner 屏幕垂直居中 `50%`（`index.css:1035-1037`），可能与中间播放按钮/缓冲 mascot 重叠                                       | P2-7          |
| 2  | 缓冲中 hover 进度条不应可拖动 | **部分成立（代码有意）** | `ProgressBar.tsx:55-58` 仅守卫 `isLive \|\| duration<=0`，注释 L56-57 明确"缓冲中允许 seek"（审查报告 1.4），`isBuffering` 根本没传给组件                                      | P1-11（产品决策）   |
| 3a | 缓冲中应能点击暂停          | **确认 bug**     | `usePlayerCore.ts:450-451` `togglePlay` 暂停分支 `if (isBuffering) return;` 拦截所有暂停入口，且导致 `handlePause` 的 `setBuffering(false)` 解锁逻辑（L246-247）永远走不到 → 自锁 | P0-7          |
| 3b | 电影也显示上下集按钮         | **误报**         | `ControlBar.tsx:147,159` + `Player/index.tsx:903-904` 用 `episodes.length` 判断，电影 `length===0` 传 `undefined` 不渲染                                      | 无需改           |
| 4a | 视频未就绪即可点播放         | **误报**         | `ControlBar.tsx:123,158` `disabled={isPlayerLoading && !isReadyToPlay}` + `usePlayerCore.ts:441-442` 双重门控，canplay 前播放按钮禁用                           | 无需改           |
| 4b | 续播进度点播放才显示         | **部分成立**       | 进度恢复绑定 `canplay`（`usePlayerCore.ts:206-210` → `useProgressRestore.ts:93`）；慢网下 canplay 迟迟不触发 → 进度 0 + 无播放按钮，观感即"点了才显示"                               | P1-10         |
| 5  | 切后台/最小化后画面冻结但音频继续  | **待确认**        | 全项目播放器内无 `visibilitychange`/视频渲染 rAF；`<video>` 原生渲染。代码层无根因，疑为 WebView/浏览器合成器或 App 壳层生命周期                                                            | 待复现环境         |
| 6  | 移动端手势与系统音量/亮度条重叠   | **误报（代码已防护）**  | `useTouchGesture.ts:128-129,149-151` + `ProgressBar.tsx:90,121,136` 均 `preventDefault`；自定义亮度走 CSS `filter`、音量走 `video.volume`，不唤起系统 UI              | 若真机复现属系统层热区冲突 |
| 7  | 缓存/预加载没实现          | **误报**         | `PlayerCore.tsx:74` `preload="auto"` + `HLSAdapter` 完整预加载（待播放 `startLoad`、暂停 `startPreload` maxBufferLength=600、下一集 `useNextEpisodePreload.ts`）     | 无需改           |
| 8  | 更多设置弹窗超出页面边缘       | **部分成立**       | `BottomSheet.tsx:95` 内联 padding 覆盖 CSS 且无 `env(safe-area-inset-bottom)`，iOS 全面屏弹窗底贴 Home 条；max-height/overflow 齐全，不溢出右/顶缘                           | P2-6          |

### 重要更正（避免浪费整改精力）

- **#3b 上下集按钮、#4a 播放按钮门控、#6 系统柱重叠、#7 预加载** 经代码核实**均非 bug**，原清单不列它们是对的，不要回头去"修"。
- **#5 切后台画面冻结** 代码层找不到根因，需你提供复现环境（Chrome 切 Tab？App 内最小化？哪个平台？）后再定位——很可能是 App WebView 的 `onPause` 只停渲染不停音频（系统/壳层行为，非播放器 JS 可改）。
- **#2 缓冲中拖拽** 是当前**有意设计**（审查报告 1.4 为防"缓冲锁死"放开），与你的预期冲突，属于产品决策：是否改为"缓冲中仅允许拖到已缓冲区间"。已在 P1-11 立项待你拍板。
- **#3a 缓冲中无法暂停** 是本轮最该先修的 P0 真 bug——它源于一个自相矛盾的实现：为避免"缓冲中暂停锁死"而在 `togglePlay` 拦截暂停，结果反而让"暂停即清缓冲态"的解锁逻辑永远走不到，形成死锁。修法简单：移除该拦截即可。

### 本轮新增 / 调整清单项

- **P0-7**｜缓冲中可暂停（确认 bug，`usePlayerCore.ts:450-451`）
- **P1-10**｜续播进度展示与 seek 解耦（pendingTime 先展示，`useProgressRestore.ts`）
- **P1-11**｜缓冲中进度条拖拽策略（产品决策，`ProgressBar.tsx:55-58`）
- **P2-6**｜更多设置弹窗 safe-area-inset-bottom（`BottomSheet.tsx:95`）
- **P2-7**｜移动端格式不支持 toast 定位优化（`index.css:1035-1037`）

