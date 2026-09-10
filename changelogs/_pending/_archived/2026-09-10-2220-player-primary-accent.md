---
date: 2026-09-10 22:20
module: UniversalPlayer（播放器强调色）
type: fix
build: 通过（npm run build）
files:
  - src/components/UniversalPlayer/UniversalPlayer.css
  - scripts/iptv-player.spec.ts
  - docs/KNOWN-ISSUES.md
  - docs/agents/patterns.md
  - docs/agents/testing.md
---

## 播放器强调色：作用域内覆写 primary 家族（KNOWN-ISSUES #14 已修）

承接同日「IPTV 播放页 chrome」批次里登记为**单独立项**的遗留项，本轮用户指示「开工」后落地。

### 问题

播放器 chrome 恒为深色底（视频 + `rgba(0,0,0,.6)` 半透明面板），而 `--color-primary` 是
**主题相关**的 —— 浅色主题 `#000`、暗色主题 `#fff`。两种情况都会让「用 primary 做强调」的规则与面板同色：

| 主题 | 坏在哪 |
| --- | --- |
| 浅色 | 频道列表一级活跃左竖条 `rgb(0,0,0)`、二级活跃左边框 `3px rgb(0,0,0)`、二级活跃序号 `color(srgb 0 0 0/.65)`、一级活跃计数药丸 `color-mix(primary 12%)`（比未选中态的白 6% **更暗** —— 选中反而更弱）、TV 焦点描边（3 处）、手势指示条填充、时移滑块 `accent-color`、时移按钮描边与文字 |
| 暗色 | 「primary 作填充 + `color:#fff`」那类变白底白字：`.up-error-actions-btn-primary`（错误态主按钮，文字继承 `--player-text: #fff`）、`.up-settings-preset.is-active`、`.up-fs-drawer .up-ms-chip--on`、`.up-cast-core` |

唯一生效的活跃线索只剩行底色 12% 白 + 字重加粗。

### 修法

`.up-universal-player` 作用域内覆写 primary 家族（写在既有规则内，避免 duplicate-selector）：

```css
.up-universal-player {
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-primary-rgb: 59, 130, 246;
  --color-primary-light: rgba(59, 130, 246, 0.16);
  --color-primary-bg: rgba(59, 130, 246, 0.22);
  --color-primary-shadow: rgba(59, 130, 246, 0.35);
  /* …原 position/width/height… 不变 */
}
```

**选 #3b82f6 不是拍脑袋**，依据是仓里已有的三处线索：

1. `.up-fs-drawer .up-ms-chip--on { background: var(--color-primary, #3b82f6) }` 的**兜底就是 #3b82f6**
   —— 作者本来就期望这类「深色底上的填充 chip」是蓝的，只是 token 被定义成 `#000/#fff`
   让兜底永不生效；
2. `.up-gesture-indicator__fill { background: var(--color-primary, #fff) }` 同款写法（同一病灶的另一处）；
3. `.video-card-status.status--unwatched` 已用 `rgba(59,130,246,.85)`。

顺带补齐 `--color-primary-rgb`：IPTVOSDBar 的时移按钮写作
`rgba(var(--color-primary-rgb, 22, 119, 255), .15/.25)`，而该 token **全仓从未定义** →
一直在走 `#1677ff` 兜底；补齐后与 primary 同源（视觉几乎无变化，但不再是「碰巧像」）。

### 两个必须知道的边界

**① 刻意不按主题分叉**（没有写成 `html:not([data-theme="dark"]) .up-universal-player`）。
播放器底恒深色，强调色也应恒定；分叉只会让暗色主题下「填充 + `#fff` 文字」那四类继续白底白字。
代价是一个行为变化：**暗色主题下播放器的强调色由白转蓝** —— 两类问题（浅色黑压黑 / 暗色白底白字）
由此一起消失。

**② 作用域用 `.up-universal-player`，不能用 `body:has(.up-universal-player)`**。
后者的变量会漏到 AppLayout 外壳 —— `/play/:id` 的播放器是**覆盖在应用之上的一层**（不是像
`/iptv/play` 那样的独立顶层路由），外壳上所有 body 级元素都会被染蓝。
作用域内的完整性已核对：播放器内**所有 live 的 primary 消费点都在该子树内** ——
唯二 portaled 到 `document.body` 的菜单（MoreMenu / ContextMenu）不消费 primary，
`.up-popover-item-check` 全仓无 tsx 引用（死规则）。
`/iptv` 浏览页 + `GroupPicker` 的 primary 保持 `#000`（浅色页面，本来就是对的）—— 实测确认未受影响。

### 落地实测（两主题）

| 观测量 | 修前（浅色） | 修后（浅色 = 暗色） |
| --- | --- | --- |
| `.up-universal-player` 上的 `--color-primary` | `#000` | `#3b82f6` |
| 同上 `--color-primary-rgb` | 未定义（时移按钮走 #1677ff 兜底） | `59,130,246` |
| 一级活跃左竖条 `::before` | 不可见（黑） | `rgb(59, 130, 246)` |
| 一级活跃计数药丸底 | 比未选中更暗 | `color(srgb 0.231 0.510 0.965 / 0.12)` |
| 二级活跃左边框 | 不可见（黑） | `rgb(59, 130, 246)` |
| 二级活跃序号 | 不可见 | `color(srgb 0.231 0.510 0.965 / 0.65)` |
| 播放器子树外的 `--color-primary` | `#000`（浅）/ `#fff`（暗） | **不变** ✓ |

### 已知轻微代价（可接受，未处理）

`.up-player-error-retry:hover` 的 `color: var(--color-primary)` 变成蓝字压白底
（`#3b82f6` 对白 ≈3.68:1，略低于小字号 AA 的 4.5:1）。它是白底药丸按钮的**瞬时 hover 态**；
要收紧就把该规则 hover 的 `color` 改回 `--color-text`、只保留 `border-color` 染蓝即可。

### 测试

新增 **IPTVP-024**（`scripts/iptv-player.spec.ts` 11.4 段，spec 10 → 11 条，全量 122 → 123 条）：
断言播放器根上的 `--color-primary` / `--color-primary-rgb` 非空且**不是 #000 / #fff**，
一级活跃左竖条的 `::before` 背景 alpha > 0.9 且不是黑/白 —— 浅色 + 暗色两主题各跑一遍。
断言**刻意不锁死具体色值**（日后调色不会误红），只排除「与面板同色」这个缺陷本身。
已用「临时摘掉那段覆写块」验证：以 `Expected: not "#000"` 变红，装回即绿。

### 验证

- `npm run build` 通过（exit 0）。
- 全量 e2e：**122 passed / 1 skipped**（123 条 / 18 spec），exit 0。
- stylelint `UniversalPlayer.css`：**67 problems，与 stash 基线逐项一致（0 新增）**。
  （第一版把覆写写成第二条 `.up-universal-player` 规则会触发 `no-duplicate-selectors`，
  已改为并入既有规则、把自定义属性放在声明之前。）
- ⚠️ 中途一次全量跑出现 3 条 `smoke-player-fs-mobile.spec.ts` 失败，报错均为
  `waitForSelector('.up-universal-player') 超时`（播放器未挂载）—— 与 CSS 无关：
  单独跑同一 spec 一次挂 2 条（**失败用例集合与全量那次不同**）、再跑 6/6 全绿。
  判定为环境 flake（该 spec 依赖 cms-mock + 本地 HLS 冒充流，对时序敏感），非回归。
  另记一条经验：临时 `scripts/_tmp-*.spec.ts` 会被 playwright 收进全量（`testDir: ./scripts`），
  跑全量前必须先删，否则计数与结论都不可信。
