# 播放器整改执行计划（P0/P1/P2 逐批次落地）

> **✅ 执行状态（2026-08-31 全部完成）**：批次 1-6 已全部实施并通过 `npm run build`，共 7 个 commit：
> `d6371e1`(批次1) `3d880fd`(批次2) `9fdb579`(批次3) `4d93c2d`(批次4) `bc35506`(批次5) `0fe34dd`(批次6)。
> 批次 4 顺带修复「外挂字幕从未渲染」（subtitleUrl 无 `<track>` 消费方）重大遗漏 bug。
> 暂缓项：P2-1 章节标记（N/A）、P1-7 字幕完整多轨/样式（下一轮）、#5 切后台冻结（待复现环境）。

> 本文是 `player-remediation-plan.md` 的**执行版**：每项给出改动文件、具体做法、验证方式，按批次推进。
> 每批次完成后 `npm run build` 验证 + 独立 commit。IPTV 播放器不参与。
> 实施过程发现的偏差修正（相对整改报告）：
> - **P2-2 自动连播倒计时已实现**（`src/pages/Player/index.tsx:918-923` + `useAutoPlay.ts`），从清单移除。
> - **P1-8 倍速/画质记忆大部分已实现**（`usePlayerStore` 用 zustand `persist` 持久化 `playbackRate`/`currentLevel`），仅剩「热切换集数时 `setCurrentLevel(-1)` 覆盖持久化记忆」一处漏洞。
> - **P2-1 章节标记无数据源**（CMS API 不提供章节），标记 N/A 暂缓。
> - **#5 切后台画面冻结**代码层无根因，维持「待复现环境」，不在本计划内。

---

## 批次 1 — P0 止血（4 个小修复）

| # | 改动 | 文件 | 做法 | 验证 |
|---|------|------|------|------|
| P0-7 | 缓冲中可暂停 | `usePlayerCore.ts` togglePlay | 删除暂停分支 `if (isBuffering) return;`（约 :450-451）。`handlePause` 里的 `setBuffering(false)` 解锁逻辑随之可达，死锁消除 | 缓冲中点暂停按钮 → 立即暂停 + 缓冲遮罩消失 |
| P0-4 | 手势音量初值恒 0 | `useTouchGesture.ts` | options 增 `getInitialVolume: () => number`；`onTouchStart` 时同步 `volumeRef`/`state`/`gesture.baseVolume` | 调节音量手势气泡从真实音量起算 |
| P0-5 | 纵向手势锁死页面滚动 | `useTouchGesture.ts` | `onTouchStart` 计算容器高度覆盖视口比例；**<85%**（嵌入/可滚动页）时纵向主导 → 放弃手势交还滚动，不 preventDefault；**≥85%**（全屏/App 全屏布局）保持现状 | 移动端 web /play 页非全屏时页面可滚动；App 全屏布局手势正常 |
| P0-6 | 手势误触控制栏/弹层 | `useTouchGesture.ts` | `onTouchStart` 用 `closest()` 排除 UI 区（与 `useLongPress` 同名单 + 移动弹窗 sheet/字幕/投屏/错误按钮/中央播放按钮） | 触摸控制栏/弹窗不再触发亮度音量手势 |

> P0-5 实现说明：不依赖 `document.fullscreenElement`（App 端是 CSS 全屏、不触发该 API），用「容器几何覆盖视口」判定，天然覆盖三种形态。

## 批次 2 — P0-1 移动端横向滑动 seek

- `useTouchGesture.ts` 增加 `seek` 轴：横向主导锁定后增量累加（`lastX` 位移 → 秒，灵敏度 15% 宽度 ≈ 全片长），`getDuration()` 换算、`getInitialSeekTime()` 捕获起点，目标时间 = 起点 + 累计，**移动中节流 100ms 回调 `onSeekTarget(t)`，松手最终回调一次**。
- 返回 `seekHud: { active, deltaSeconds }`；`UniversalPlayer` 渲染居中大号气泡（`«/» + 目标时间`，样式对齐现有 `.up-seek-indicator`）。
- 守卫：`hasError` / `duration<=0` / 直播不启用 seek 轴；锁定方向后 `preventDefault`。
- `UniversalPlayer` 接线：`onSeekTarget → playerCore.seek`（统一 seeked 提示策略不适用于拖动中，HUD 直接显示目标时间）。
- **长按语义保持现有「边缘长按 ±6s seek」不变**（useLongPress 是既有功能，改成长按倍速属产品决策，另行拍板）。

## 批次 3 — P0-2 / P0-3 / P1-11 进度条

| # | 改动 | 做法 |
|---|------|------|
| P0-2 | ARIA + 键盘 | `.up-progress-bar` 根节点加 `role="slider"` `tabIndex={0}` `aria-label="播放进度"` `aria-valuemin/max/now` `aria-valuetext`；onKeyDown：←→ ±5s、Home/End 头尾、PageUp/Down ±60s；焦点样式；handle 后 preventDefault |
| P0-3 | 高频重渲染治理 | ① `usePlayerCore.handleTimeUpdate`：`setProgress`/`onProgress` 节流 200ms（跳变 >1s 立即写）；② `UniversalPlayer` 移除 `progress/duration` 订阅，移动端底部进度线抽成独立小组件 `MobileProgressEdge`（订阅隔离在自身）；③ ControlBar 保留 4Hz 订阅（成本可接受） |
| P1-11 | 缓冲中拖拽钳制 | ProgressBar 增 `isBuffering` prop；拖拽目标时间 **钳制到 [0, buffered]**（向后随时可拖，向前不超出已缓冲区），兼顾「缓冲中不可乱拖」与「防缓冲锁死」 |
| 附带 | tooltip 溢出钳制 | `.up-progress-tooltip` left 用 clamp 钳到两端内（宽度 ~8rem） |

## 批次 4 — P1 快速项（快捷键 / 单击 / 记忆 / 无障碍 / 清理）

| # | 改动 | 做法 |
|---|------|------|
| P1-1 | 快捷键补齐 + L 语义修正 | `useKeyboardShortcuts.ts`：`K` 播放暂停、`J/L` ∓/±10s、`←→` 改 ±5s（对齐 B站/YouTube）、`0-9` 跳 0-90%、`Home/End`、`,/.` 逐帧 ±1/30s（先暂停）、`C` 字幕开关、`P` 画中画、`R` 循环（从 `L` 迁移）、`Shift+?` 快捷键面板；输入框排除补 `contentEditable` 与聚焦 button 的 Space/Enter |
| P1-5 | 快捷键面板 | 新增 `ControlBar/ShortcutHelp.tsx`（两列键位表 + Esc 关闭），MoreMenu 加入口，`Shift+?` 调出 |
| P1-2 | 单击延迟 250ms | `usePlayerClickHandler` 增 `isMobileLayout`：移动端单击=立即显/隐控制栏（首拍即响应），双击窗内第二拍=全屏；桌面保持 250ms togglePlay |
| P1-8 | 画质记忆不被清 | `switchLevel` 写 `localStorage['kinotv-remembered-level']`；`UniversalPlayer` 冷挂载 effect 恢复到 store（热切换仍防御性重置 -1，但持久化记忆不再被覆盖） |
| P1-9 | aria-label 补齐 | 排查 `ControlBar/*` 图标按钮，缺 `aria-label`/`title` 的补齐 |
| P2-5 | 定时器清理 | `useLongPress` 卸载清 timer/interval；`usePlayerCore` 卸载清 `seekToastRef`/`togglePlayTimerRef` |

## 批次 5 — P1 中项（错误态 / 续播 / P2 快速项）

| # | 改动 | 做法 |
|---|------|------|
| P1-3 | 错误态增强 | `UniversalPlayer` 存 `errorMessage`；`PlayerCore` 错误遮罩显示具体文案（覆盖固定「播放失败…」）；错误码翻译已有（`handleNativeError`）。「换源」按钮需 Player 页接线，本期先留 prop `onSwitchSource?`（传了才渲染） |
| P1-4 | 续播「从头播放」 | `useProgressRestore` 增 `onRestore?: (target:number)=>void` 回调；`UniversalPlayer` 渲染续播卡片（目标时间 + 「从头播放」按钮，8s 自动消失）；替换原 toast，**同时修复手动续播无提示回归**（卡片与播放触发来源无关） |
| P1-10 | 续播展示与 seek 解耦 | `useProgressRestore` 拆 `findProgress()`（查库）+ `applyProgress()`（seek）；`usePlayerCore` 在源 effect 启动时立即 `findProgress` → 新 store 字段 `pendingResumeTime`（ ProgressBar 优先展示）→ canplay 后 seek 并清除 |
| P2-6 | 弹窗安全区 | `ui/BottomSheet.tsx:95` 内联 padding 底部改 `calc(var(--space-lg) + env(safe-area-inset-bottom))` |
| P2-7 | 移动端 toast 遮挡 | `index.css` 移动端播放器 toast 从垂直居中 50% 改上部（safe-area + 64px），不再与中央播放按钮/缓冲 mascot 重叠 |

## 批次 6 — P1-6 右键菜单 / P2 打磨

- **P1-6** 新增 `ContextMenu.tsx`（仅桌面 video 模式 onContextMenu）：复制当前时间、倍速档位、画中画、循环切换、刷新、快捷键面板；点击/Esc/滚动关闭。
- **P2-3** 浅色主题控制栏遮罩对比度增强（`[data-theme="light"]` 渐变加深）；z-index 魔法数字归纳为 `--up-z-*` token（仅播放器 CSS 范围）。
- **P2-4** 移动端控制栏触摸目标 ≥44px（CSS min-height/width + 热区扩展）。

## 暂缓 / N/A（不实施，防白费劲）

- **P2-1 章节标记**：无章节数据源（CMS 不提供），N/A。
- **P1-7 字幕多轨/桌面样式**：移动端样式面板已有（SubtitleSettingsModal）；内嵌 textTracks 多轨切换放下一轮单独批次（涉及 adapter 层）。
- **#5 切后台画面冻结**：待用户提供复现环境（浏览器/平台/是否 App 内）。
- **长按倍速替换边缘长按 seek**：产品决策，维持现状。

## 验证基线

- 每批次：`npm run build` 通过 → `git add <改动文件>` → commit（**禁止 `git rm` / `git stash`**）。
- 手工验收路径：`/play/:id` 桌面（快捷键/进度条键盘/右键）+ 移动模拟（手势/弹窗/触摸目标）。

---

## 自测修复轮（Issue1-4，2026-08-31）

用户自测发现 4 个问题，独立实施两批（仅 VOD，IPTV 不参与）：

### Issue1/2/3 → commit `95c36a1`
| # | 问题 | 改动 | 文件 |
|---|------|------|------|
| 1 | 桌面端出现音量/亮度调节柱状图（右侧音量弹窗 + 移动端手势指示器） | 引入 `isDesktopWeb = platform==='desktop' && !isMobileDevice`；`useTouchGesture`/`VolumePopup`/`BrightnessVolumeIndicator` 在桌面 Web 全部禁用 | `UniversalPlayer.tsx` |
| 2 | 切后台视频画面冻结（进度/音频正常） | 新增 `visibilitychange` 监听：回前台且视频本在播放时强制 `video.play()` + 触发 reflow（读 `offsetWidth` 并复原 transform）唤醒合成层 | `usePlayerCore.ts` |
| 3 | 缓冲中点击进度条圆点立即复位 / hover 跟随 | 放开缓冲中 seek 钳制（点击即更新到最后点击位）；`!isDragging && isBuffering` 时 hover 不移动圆点/tooltip | `ProgressBar.tsx` |

### Issue4 → commit `0d8390f`
| # | 改动 | 文件 |
|---|------|------|
| 4a | 右键菜单改为 4 项：播放/暂停、视频色彩调整、视频音效调节、快捷键说明（删除原循环/画中画项） | `ContextMenu.tsx` / `UniversalPlayer.tsx` |
| 4b | 色彩调整弹窗：亮度/饱和度/对比度 + 重置，经 `store.colorFilter` 由 `PlayerCore` 统一应用 CSS `filter` | `ColorAdjustPanel.tsx` / `PlayerCore.tsx` |
| 4c | 音效调节弹窗：8 EQ 预设（关闭/流行/摇滚/古典/重低音/人声/高音增强/3D 环绕）+ 声道平衡 + 音量增强 + 重置 | `AudioEffectsPanel.tsx` |
| 4d | `useAudioEffects`：Web Audio 图谱（source→3段EQ→声道拆分→右声道 Haas 延迟→合并→增益→声道平衡→输出）；**默认态（off+balance0+gain1）不构建图谱**（零风险），首次非默认才建图，3D 预设加 ~20ms 延迟；卸载关闭 AudioContext | `useAudioEffects.ts` |
| 4e | `usePlayerStore` 新增 `colorFilter`/`audioEffect` 状态与 setter（含类型修正：`audioEffect` 字面量加 `as AudioEffectState` 避免 string 推断） | `usePlayerStore.ts` |

> 色彩调整：移动端纵向滑动手势也写 `store.colorFilter.brightness`，与弹窗共用同一字段，由 `PlayerCore` 统一应用。
> 音效图谱采用「默认不建图」策略规避 `createMediaElementSource` 只能建一次 + 截断原生音频路径的风险。
