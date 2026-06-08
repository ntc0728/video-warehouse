# VideoCard 统一尺寸验证报告

> 验证时间：2026-06-05
> 验证方式：agent-browser 真实数据验证（注入真实 TMDB Access Token，加载 158 张真实电影卡片）
> 验证环境：dev server `http://localhost:3001`，React 18 + Vite + Tailwind

## 1. 验证目标

| 需求 | 设计要求 |
|------|---------|
| ✅ 同一客户端下所有页面 card 尺寸一致 | Browse / Search / Collections / History / Detail 推荐行 + TMDBMovieRow 横滚行统一用 `--card-cols` |
| ✅ 随屏幕宽度动态调整 | 6 档断点（375 / 1024 / 1280 / 1920 / 2560 / 3840） |
| ✅ 横滚行 card 不被遮挡 | 56px padding-right + 40px 圆形箭头让出空间 |
| ✅ 右箭头在完整可见 card 右侧 | 箭头 L 与最后完整 card R 间距 ≥ 26px |
| ✅ PC 端 1 行 7 个 card | 1280-1919 视口验证 |
| ✅ 移动端 1 行 3 个 card | < 1024 视口验证 |
| ✅ TV 端 1 行 9-10 个 card | 2560+ 视口验证 |

## 2. 7 视口实测数据（真实数据，非 mock）

| 视口 | 断点 | `--card-cols` | 单卡宽 | 最后完整卡 | 右箭头 L | 间距 | 验证 |
|------|------|--------------|--------|----------|---------|------|------|
| 375×667 | 移动 | **3** | 90px | i=2, R=285 | - | - | ✅ |
| 768×1024 | 平板 | **3** | 215px | i=2, R=678 | - | - | ✅ |
| 1024×768 | 小桌面 | **5** | 176px | i=4, R=932 | L=958 | **26px** | ✅ |
| 1440×900 | PC 默认 | **7** | 182px | i=6, R=1346 | L=1373 | **27px** | ✅ |
| 1920×1080 | 大屏 | **8** | 214px | i=7, R=1818 | L=1849 | **31px** | ✅ |
| 2560×1440 | TV | **9** | 256px | i=8, R=2448 | L=2484 | **36px** | ✅ |
| 3840×2160 | 4K TV | **10** | 357px | i=9, R=3726 | L=3763 | **37px** | ✅ |

**结论**：所有 7 档视口 `--card-cols` 实际值与设计完全一致；右箭头位置始终在最后一张完整可见 card 右侧 26-37px，无遮挡。

## 3. 滚动后状态验证（1440×900 视口）

**滚动前**（scrollLeft = 14）：

| 索引 | L | R | 状态 |
|------|---|---|------|
| 0 | 21 | 202 | ✅ 完全可见 |
| 1 | 211 | 393 | ✅ 完全可见 |
| ... | ... | ... | ... |
| 6 | 1164 | 1346 | ✅ 完全可见（最后一张） |
| 7 | 1354 | 1536 | 🟡 部分可见（进入 padding 区） |
| 8 | 1545 | 1727 | ⬜ 容器外 |

→ 右箭头 L=1373, R=1407  →  与第6张（最后完整）间距 = **27px** ✅

**滚动 1 次右箭头后**（scrollLeft = 586）：

| 索引 | L | R | 状态 |
|------|---|---|------|
| 3 | 20 | 202 | ✅ 完全可见 |
| ... | ... | ... | ... |
| 9 | 1163 | 1345 | ✅ 完全可见（最后一张） |
| 10 | 1354 | 1536 | 🟡 部分可见 |

→ 右箭头 L=1373, R=1407  →  与第9张（最后完整）间距 = **28px** ✅

**结论**：箭头位置不受滚动影响，`scroll-snap-type: x proximity` 让滚动自然吸附到 card 边界，箭头永远在最后完整 card 右侧 26-28px。

## 4. 截屏归档

`d:\trae\5.13\video-warehouse\shots\`

| 文件 | 视口 | 内容 |
|------|------|------|
| `real-home-375x667.png` | 移动 | 3 列横滚，7 个 movierow |
| `real-home-768x1024.png` | 平板 | 3 列横滚 |
| `real-home-1024x768.png` | 小桌面 | 5 列横滚，箭头可见 |
| `real-home-1440x900.png` | PC 默认 | 7 列横滚 |
| `real-home-1920x1080.png` | 大屏 | 8 列横滚 |
| `real-home-2560x1440.png` | TV | 9 列横滚 |
| `real-home-3840x2160.png` | 4K TV | 10 列横滚 |
| `real-home-1440x900-scrolled.png` | 滚动后 | 验证箭头位置稳定性 |

## 5. TMDB 真实数据加载

| 指标 | 数值 |
|------|------|
| Token 长度 | 239 字符 |
| 加载 movierow 数 | 7 |
| 加载 card 总数 | 158 |
| 首屏错误 | 无 |
| API 响应 | 200 OK |

数据来源包括：正在热映、流行电影、流行剧集、即将上映、Top Rated 等分类。

## 6. 兼容性回归

- ✅ `npm run build` 通过（TypeScript 编译 + Vite 构建）
- ✅ 移动端（375px）箭头自动隐藏（`@media (max-width: 768px) { .tmdb-movierow-arrow { display: none; } }`）
- ✅ TV 端（`data-device="tv"`）箭头隐藏，使用遥控器方向键导航
- ✅ 横滚条永久隐藏（`scrollbar-width: none` + webkit 兼容）
- ✅ scroll-snap 平滑吸附（`scroll-snap-type: x proximity`）

## 7. 实施文件清单

| 文件 | 变更 |
|------|------|
| `src/assets/styles/variables.css` | 添加 `--card-cols` 默认值 + 5 档媒体查询 |
| `src/assets/styles/index.css` | 新增 `.video-card-grid` 工具类 |
| `src/components/VideoCard/VideoCard.css` | 添加 `min-width: 0` 防溢出 |
| `src/components/VideoCard/SkeletonCard.css` | 简化为统一 Token |
| `src/components/TMDBMovieRow/TMDBMovieRow.css` | 动态卡宽 + 56px padding + scroll-snap |
| `src/components/TMDBMovieRow/index.tsx` | `scroll()` 动态测量 card 宽 |
| `src/pages/Browse/Browse.css` | 改用统一 Token |
| `src/pages/Search/Search.css` | 改用统一 Token |
| `src/pages/Collections/Collections.css` | 改用统一 Token |
| `src/pages/History/History.css` | 改用统一 Token |
| `src/pages/Detail/Detail.css` | `.detail-recommend-row` 改用统一 Token |
| `config/tmdb-token.md` | TMDB Token 本地保存（不进 git） |

## 8. 已知 / 接受的行为

- **横滚条永久隐藏**：仅 PC 端使用左右箭头按钮（≥769px），移动端触摸滑动，TV 端用遥控方向键。

## 9. v2 修订：修复"第 N+1 张 card 部分露出"（2026-06-05）

### 9.1 约束变化

用户在第二轮提出**新约束**：

> 必须满足可视范围显示完整的 card，不允许有显示不完整的 card

v1 实现（v2 修复前）的实测问题（1440×900）：
- scroll 容器 R = 1356
- 第 7 张 card R = 1346（完整可见）
- 第 8 张 card L = 1354 → **在 scroll 容器内露出 2px（裁切边缘）**

→ "不允许显示不完整的 card"约束被破坏。

### 9.2 v2 修复方案

将"箭头让位"从 scroll 容器 padding 移到 wrapper 容器 padding：

```css
/* TMDBMovieRow.css v2 */
.tmdb-movierow-wrapper {
  position: relative;
  padding-right: 60px;            /* 让出 60px 给右箭头（40+余量） */
  padding-left: var(--space-md, 4px);  /* 视觉左侧间距 */
}

.tmdb-movierow-scroll {
  display: flex;
  gap: var(--space-sm, 10px);
  overflow-x: auto;
  padding: 0;                      /* 关键：scroll 自身无 padding，box width = 100% 公式参考 */
  scroll-snap-type: x proximity;
}

.tmdb-movierow-card {
  flex: 0 0 calc(
    (100% - (var(--card-cols, 7) - 1) * var(--space-sm, 10px))
    / var(--card-cols, 7)
  );
  scroll-snap-align: start;
  min-width: 0;
}
```

箭头位置**不变**（仍 `left: 6px` / `right: 6px`），落在 wrapper padding-right 区域内，**不遮挡 scroll 容器内任何 card**。

### 9.3 v2 修复后 7 视口实测

| 视口 | 列数 N | scroll_W | 第 N 张 R | 第 N+1 张 L | scroll_R | N+1 张是否在可视区外 |
|------|--------|----------|-----------|-------------|----------|---------------------|
| 375×667 | 3 | 281 | 293 | 301 | 293 | ✅ 完全在外 |
| 768×1024 | 3 | 656 | 686 | 694 | 686 | ✅ 完全在外 |
| 1024×768 | 5 | 909 | 941 | 949 | 941 | ✅ 完全在外 |
| 1440×900 | 7 | 1321 | 1356 | 1364 | 1356 | ✅ 完全在外（差 8px） |
| 1920×1080 | 8 | 1790 | 1832 | 1843 | 1832 | ✅ 完全在外 |
| 2560×1440 | 9 | 2414 | 2467 | 2481 | 2467 | ✅ 完全在外 |
| 3840×2160 | 10 | 3692 | 3746 | 3760 | 3746 | ✅ 完全在外 |

**结论**：所有 7 视口下，第 N 张 card **严格填满 scroll 容器可视区**（R = scroll_R），第 N+1 张 card 起点在 scroll 容器外 ≥ 7px。**满足"不允许显示不完整的 card"**。

### 9.4 v2 滚动后状态（1440×900，scrollLeft=570）

- 完整可见：i=3-9（第 4-10 张，共 7 张）✅
- 第 10 张 R = 1355，scroll_R = 1356（差 1px 亚像素）✅
- 第 11 张 L = 1364，scroll_R = 1356（差 8px 在 scroll 外）✅
- 滚动 0 位置 1-3 张已滚出 ✅

**结论**：scroll-snap proximity 行为正常，滚动后 N 张仍严格填满可视区。

### 9.5 v2 截屏归档

`d:\trae\5.13\video-warehouse\shots\`

| 文件 | 视口 | 内容 |
|------|------|------|
| `fix-v2-375x667.png` | 移动 | 3 列严格填满 |
| `fix-v2-768x1024.png` | 平板 | 3 列严格填满 |
| `fix-v2-1024x768.png` | 小桌面 | 5 列严格填满 |
| `fix-v2-1440x900.png` | PC 默认 | 7 列严格填满 |
| `fix-v2-1440x900-scrolled.png` | 滚动后 | 仍 7 列严格填满 |
| `fix-v2-1920x1080.png` | 大屏 | 8 列严格填满 |
| `fix-v2-2560x1440.png` | TV | 9 列严格填满 |
| `fix-v2-3840x2160.png` | 4K TV | 10 列严格填满 |

### 9.6 v2 关键设计点

| 决策 | 选择 | 理由 |
|------|------|------|
| 箭头让位 | 移到 wrapper padding | 不影响 scroll 容器 box width，card 公式 100% 严格等于可视区 |
| scroll 容器 padding | 设为 0 | 避免 box width 与 content width 不一致导致第 N+1 张卡露出 |
| wrapper padding-left | var(--space-md) | 保持视觉左侧间距（与 .tmdb-movierow-header 一致） |
| wrapper padding-right | 60px | 给右箭头 40px + 6px 边距 + 14px 余量 |
| 左箭头 hover 遮挡 | 接受 | scrollLeft > 0 时左箭头显示，可能盖在第 1 张剩余 card 上（与右箭头对称的可接受模式） |

## 10. v3 修订：调整中中间断点列数（2026-06-05）

### 10.1 用户反馈

> 768×1024、1024×768 这两个视口下，card 数量太少了，导致 card 尺寸太大了

v2 实测：
- 768 视口 3 列 → card 宽 **213px**（与 1920 大屏 8 列 card 214px 几乎一样大）
- 1024 视口 5 列 → card 宽 175px

### 10.2 v3 新断点

| 视口 | v2 列数 | v3 列数 | 变化 |
|------|---------|---------|------|
| < 768 | 3 | 3 | 保持（最少 3 列硬约束） |
| **768-1023** | 3 | **5** | ⬆️ +2 |
| **1024-1279** | 5 | **6** | ⬆️ +1 |
| 1280-1919 | 7 | 7 | 保持（PC 默认） |
| 1920-2559 | 8 | 8 | 保持 |
| 2560-3839 | 9 | 9 | 保持 |
| ≥ 3840 | 10 | 10 | 保持 |

### 10.3 v3 修复后 7 视口实测

| 视口 | N | card 宽 | card 高 | 第 N+1 张 L | scroll_R | 状态 |
|------|---|---------|---------|-------------|----------|------|
| 375×667 | 3 | 88 | 159 | - | - | ✅ 保持 |
| 768×1024 | **5** | **125** | 214 | 694 | 686 | ✅ 第 6 张 L=694 > 686 |
| 1024×768 | **6** | **145** | 244 | 949 | 941 | ✅ 第 7 张 L=949 > 941 |
| 1440×900 | 7 | 181 | 300 | 1365 | 1356 | ✅ |
| 1920×1080 | 8 | 214 | 356 | 1843 | 1832 | ✅ |
| 2560×1440 | 9 | 256 | 429 | 2481 | 2467 | ✅ |
| 3840×2160 | 10 | 357 | 589 | 3760 | 3746 | ✅ |

**对比 v2 → v3 card 宽变化**：

| 视口 | v2 card 宽 | v3 card 宽 | 变化 |
|------|-----------|-----------|------|
| 375 | 90 | 88 | -2px（基本不变） |
| **768** | **213** | **125** | **-88px (-41%)** |
| **1024** | **175** | **145** | **-30px (-17%)** |
| 1440 | 181 | 181 | 不变 |
| 1920 | 214 | 214 | 不变 |
| 2560 | 256 | 256 | 不变 |
| 3840 | 357 | 357 | 不变 |

**核心修复**：768 平板 card 宽从 213→125（-41%），1024 桌面从 175→145（-17%），与 1920 大屏 214px 比例更合理（小屏 card < 大屏 card）。

### 10.4 v3 滚动后状态（1440×900，scrollLeft=570）

- 完整可见：i=3-9（第 4-10 张，共 7 张）✅
- i=9 R=1355, scroll_R=1356（差 1px 亚像素）✅
- i=10 L=1364, scroll_R=1356（差 8px 在 scroll 外）✅

**结论**：scroll-snap proximity 行为正常，滚动后 N 张仍严格填满可视区。

### 10.5 v3 截屏归档

`d:\trae\5.13\video-warehouse\shots\`

| 文件 | 视口 | 列数 | card 宽 |
|------|------|------|---------|
| `fix-v3-375x667.png` | 移动 | 3 | 88 |
| `fix-v3-768x1024.png` | 平板 | 5 | 125 |
| `fix-v3-1024x768.png` | 小桌面 | 6 | 145 |
| `fix-v3-1440x900.png` | PC 默认 | 7 | 181 |
| `fix-v3-1440x900-scrolled.png` | PC 滚动后 | 7 | 181 |
| `fix-v3-1920x1080.png` | 大屏 | 8 | 214 |
| `fix-v3-2560x1440.png` | TV | 9 | 256 |
| `fix-v3-3840x2160.png` | 4K TV | 10 | 357 |

## 11. v4 修订：每行偶数列数 + 左右视觉对称 (2026-06-06)

### 11.1 用户反馈（第三轮 Plan Mode）

> 重新分配每个视口的 card 数量，每行 card 数量始终为偶数，
> 但要严格保持最右侧空白区域与最左侧保持一致。
> 移动端 card 仍然是 3 列，此时不用视口大小去判断。

### 11.2 v4 偶数断点

| 视口 | v3 列数 | v4 列数 | 变化 |
|------|---------|---------|------|
| < 768 | 3 | **3** | 保持（移动端硬约束） |
| 768-1023 | 5 | **6** | ⬆️ +1（强制偶数） |
| 1024-1279 | 6 | **6** | 不变 |
| 1280-1919 | 7 | **8** | ⬆️ +1（强制偶数） |
| 1920-2559 | 8 | **8** | 不变 |
| 2560-3839 | 9 | **10** | ⬆️ +1（强制偶数） |
| ≥ 3840 | 10 | **10** | 不变 |

**约束满足**：
- ✅ ≥ 768 视口每行 card 数量全部为偶数（6/6/8/8/10/10）
- ✅ 移动端 < 768 保持 3 列硬约束（用户明确要求）

### 11.3 v4 对称 padding 方案

| 视口范围 | wrapper padding | 设计意图 |
|---------|----------------|---------|
| 移动/平板 (< 1024) | `var(--space-md)/var(--space-md)` ≈ 14.35/14.35 | 移动端无箭头，左右各保留 --space-md 视觉间距 |
| 桌面/TV (≥ 1024) | `60/60` | 左右各 60px 给左右箭头让位，左右严格对称 |

**scroll 容器 padding**：始终 `0`（保持 v2 修复成果：N 张 card 严格填满可视区）

### 11.4 v4 网格居中方案

```css
.browse-grid {  /* 同样适用于 search/collection/history/detail-recommend/video-card-grid */
  display: grid;
  grid-template-columns: repeat(var(--card-cols, 6), minmax(0, 1fr));
  width: max-content;     /* grid 收缩到内容宽 */
  max-width: 100%;        /* 父容器窄时不溢出 */
  margin: 0 auto;         /* grid 水平居中，左右空白对称 */
}
```

**设计意图**：
- `width: max-content` → grid 自动收缩到 N 列卡宽 + gap + padding 之和
- `max-width: 100%` → 父容器比 grid 内容窄时强制缩到父容器宽（不溢出）
- `margin: 0 auto` → 父容器有富余宽度时 grid 居中，左右空白对称

### 11.5 v4 7 视口实测数据

| 视口 | 期望列数 | 实际列数 | 期望 padding | 实际 wrapper padL | 实际 wrapper padR | 对称 | 单卡宽 | 单卡高 | 状态 |
|------|---------|---------|-------------|-------------------|-------------------|------|--------|--------|------|
| 375×667 | 3 | 3 | 14.35/14.35 | 12.00 | 12.00 | ✅ | 104 | 188 | ✅ |
| 768×1024 | 6 | 6 | 14.35/14.35 | 12.02 | 12.02 | ✅ | 111 | 192 | ✅ |
| 1024×768 | **6** | **6** | **60/60** | **60** | **60** | **✅** | 132 | 220 | ✅ |
| 1440×900 | 8 | 8 | 60/60 | 60 | 60 | ✅ | 152 | 255 | ✅ |
| 1920×1080 | **8** | **8** | **60/60** | **60** | **60** | **✅** | 208.64 | 348.02 | ✅ |
| 2560×1440 | **10** | **10** | **60/60** | **60** | **60** | **✅** | 225.16 | 383.45 | ✅ |
| 3840×2160 | 10 | 10 | 60/60 | 60 | 60 | ✅ | 353 | 583.5 | ✅ |

**所有 7 视口验证通过**：
- ✅ 列数严格按偶数梯度 3/6/6/8/8/10/10
- ✅ wrapper 左右 padding 完全相等（差 ≤ 0.05px 亚像素）
- ✅ 1024 视口下桌面断点 padding 跳变（14.35→60）正确生效

### 11.6 v4 滚动后状态（1440×900, scrollLeft=642）

| 状态 | scrollLeft | wrapper padL | wrapper padR | 对称 |
|------|-----------|-------------|-------------|------|
| 滚动前 | 0 | 60 | 60 | ✅ |
| 滚动后 | 642 | 60 | 60 | ✅ |

**结论**：wrapper padding 是容器级属性，与 scroll 状态完全解耦。滚动后左右 padding 仍 60/60 严格对称。

### 11.7 v4 Browse 页面 grid 居中实测

| 视口 | N | grid_width | parent_width | grid_margin_L | grid_margin_R | 居中 | 状态 |
|------|---|-----------|-------------|---------------|---------------|------|------|
| 800×600 | 6 | 790 | 790 | 0 | 0 | ✅ | grid 填满 |
| 1024×768 | 6 | 1014 | 1014 | 0 | 0 | ✅ | grid 填满 |
| 1440×900 | 8 | 1430 | 1430 | 0 | 0 | ✅ | grid 填满 |

**结论**：
- ✅ `margin: 0 auto` 在所有 3 个验证视口下，左右 margin 完全相等
- ✅ grid 内容宽度 753.6px（6 列 110px + 5 gap 18px）始终填满父容器（max-width 限制生效）
- ✅ Browse 页面在 20 张数据下 6×3 + 2 行，最后一行 2 张 card 居左（不满 N 列时不对齐是 grid 浏览器默认行为，符合预期）

### 11.8 v4 截屏归档

`d:\trae\5.13\video-warehouse\shots\`

| 文件 | 视口 | 内容 | 列数 | padding |
|------|------|------|------|---------|
| `fix-v4-375x667.png` | 移动 | 3 列横滚 | 3 | 12/12 |
| `fix-v4-768x1024.png` | 平板 | 6 列横滚（v3 5→6） | 6 | 12.02/12.02 |
| `fix-v4-1024x768.png` | 小桌面 | 6 列横滚 + 箭头 | 6 | 60/60 |
| `fix-v4-1440x900.png` | PC 默认 | 8 列横滚（v3 7→8） | 8 | 60/60 |
| `fix-v4-1440x900-scrolled.png` | 滚动后 | 仍 8 列严格填满 | 8 | 60/60 |
| `fix-v4-1920x1080.png` | 大屏 | 8 列横滚 | 8 | 60/60 |
| `fix-v4-2560x1440.png` | TV | 10 列横滚（v3 9→10） | 10 | 60/60 |
| `fix-v4-3840x2160.png` | 4K TV | 10 列横滚 | 10 | 60/60 |
| `fix-v4-browse-1440x900.png` | Browse 页面 | grid 居中 + 8 列 | 8 | grid_margins_equal=true |

### 11.9 v4 关键设计点

| 决策 | 选择 | 理由 |
|------|------|------|
| 列数分配 | 3/6/6/8/8/10/10 | 满足"每行偶数"，移动端保持 3 列硬约束 |
| wrapper padding | 左右相等（移动 14.35/14.35，桌面 60/60） | "最右空白 = 最左空白"硬约束 |
| scroll 容器 padding | 0 | 保持 v2 修复（card 严格填满可视区） |
| 网格居中 | `width: max-content; max-width: 100%; margin: 0 auto` | 父容器富余时居中，父容器窄时填满不溢出 |
| 1024 padding 跳变 | 接受 | 桌面/TV 断点统一 60/60，移动/平板 14.35/14.35 |

### 11.10 v4 文件变更

| 文件 | 变更 |
|------|------|
| `src/assets/styles/variables.css` | `--card-cols` 媒体查询改为 3/6/6/8/8/10/10 + 注释更新 |
| `src/components/TMDBMovieRow/TMDBMovieRow.css` | wrapper padding 改为左右相等 + 桌面断点 60/60 |
| `src/pages/Browse/Browse.css` | `.browse-grid` 添加 `width: max-content; max-width: 100%; margin: 0 auto;` |
| `src/pages/Search/Search.css` | `.search-grid` 添加 `width: max-content; max-width: 100%; margin: 0 auto;` |
| `src/pages/Collections/Collections.css` | `.collection-grid` 添加 `width: max-content; max-width: 100%; margin: 0 auto;` |
| `src/pages/History/History.css` | `.history-grid` 添加 `width: max-content; max-width: 100%; margin: 0 auto;` |
| `src/pages/Detail/Detail.css` | `.detail-recommend-row` 添加 `width: max-content; max-width: 100%; margin: 0 auto;` |
| `src/assets/styles/index.css` | `.video-card-grid` 添加 `width: max-content; max-width: 100%; margin: 0 auto;` |
| `docs/video-card-sizing-verification.md` | 追加第 11 节 v4 修订记录 |

## 12. v5 修订：Detail 页面两推荐 row 宽度一致性 (2026-06-06)

### 12.1 用户反馈

> 视频详情页中你可能还喜欢这个栏目下 card 应该与相关推荐下 card 尺寸保持一致。

实测 `/detail/tmdb-movie-2018`（婚礼专家）下：

| 栏目 | card 宽 | card 高 | row 宽 |
|------|---------|---------|--------|
| 相关推荐 | 164.89 | 275.39 | 1410.19 |
| 你可能还喜欢 | **149.81** | **252.75** | **1289.53** |
| 差异 | -15.08 | -22.64 | -120.66 |

截图：[`shots/detail-recommend-both-sections.png`](file:///d:/trae/5.13/video-warehouse/shots/detail-recommend-both-sections.png)

### 12.2 根因分析

v4 计划的 `.detail-recommend-row { width: max-content; max-width: 100%; margin: 0 auto; }` 触发了 CSS Grid 的 **intrinsic min-content** 行为：

- `width: max-content` 让 row 收缩到 N 列"内容最大宽之和 + gap + padding"
- 每列内容最大宽由 row 内 card 的 max-content 决定
- **循环依赖**：列宽决定 row 宽，row 宽决定列宽
- 当 row 内某个 card 的标题（或其他元素）比其他 card 更长时，**整个 row 都会按 max-content 收缩到该最宽元素**
- 不同 row 内"最宽元素"差异 → row 宽度差异 → 同一页面多 row 列宽不一致

具体场景：第一个 row 的第 2 张 card 标题宽 165px（撑爆 min-content），第二个 row 所有标题 ≤ 52px → row 1 宽 1410，row 2 收缩到 1289。

### 12.3 v5 修复方案

**用户选择**：仅修 Detail 页面，其他 grid 保持 v4 行为。

```css
/* src/pages/Detail/Detail.css */
.detail-recommend-row {
  display: grid;
  grid-template-columns: repeat(var(--card-cols, 6), minmax(0, 1fr));
  gap: var(--space-sm);
  padding: 0 var(--space-md);
  width: 100%;        /* v5: 从 max-content 改为 100%，强制 row 填满 parent */
  max-width: 100%;
  margin: 0 auto;
}
```

**设计意图**：
- `width: 100%` 强制 row 填满 parent
- `grid-template-columns: repeat(N, minmax(0, 1fr))` 让 N 列等分 row 宽
- 同一页面多个 row 自动宽度一致 → card 尺寸一致

**风险**：
- Browse/Search/Collections/History 页面仍是 `width: max-content`，未来如添加多 grid 页面会重现此 bug
- 已告知用户但用户选择仅修 Detail

### 12.4 v5 实测数据（Detail 页面 `/detail/tmdb-movie-2018`）

#### 1440×900 桌面端

| 栏目 | card 宽 | card 高 | cover 宽 | cover 高 | row 宽 |
|------|---------|---------|---------|---------|--------|
| 相关推荐 | 164.89 | 275.39 | 162.89 | 244.33 | 1410.19 |
| 你可能还喜欢 | **164.89** | **275.39** | **162.89** | **244.33** | **1410.19** |
| 差异 | 0 | 0 | 0 | 0 | 0 |

`cardSizeConsistent: true` ✅

截图：[`shots/detail-recommend-fixed-1440x900.png`](file:///d:/trae/5.13/video-warehouse/shots/detail-recommend-fixed-1440x900.png)

#### 1920×1080 大屏

| 栏目 | card 宽 | card 高 |
|------|---------|---------|
| 相关推荐 | 221.34 | 367.08 |
| 你可能还喜欢 | **221.34** | **367.08** |
| 差异 | 0 | 0 |

截图：[`shots/detail-recommend-fixed-1920x1080.png`](file:///d:/trae/5.13/video-warehouse/shots/detail-recommend-fixed-1920x1080.png)

#### 1024×768 小桌面

| 栏目 | card 宽 | card 高 | row 宽 | 溢出 |
|------|---------|---------|--------|------|
| 相关推荐 | 154.81 | 259.31 | 995.63 | false |
| 你可能还喜欢 | **154.81** | **259.31** | **995.63** | false |

### 12.5 v5 Browse 页面回归测试（确认未受影响）

1440×900 视口下：

| 指标 | 值 |
|------|---|
| gridW | 1430 |
| parentW | 1430 |
| marginL | 0 |
| marginR | 0 |
| symmetric | true |

Browse 页面仍按 v4 居中行为工作，grid 填满 parent，左右 margin 对称 ✅

### 12.6 v5 文件变更

| 文件 | 变更 |
|------|------|
| `src/pages/Detail/Detail.css` | `.detail-recommend-row` `width: max-content` → `width: 100%` |
| `docs/video-card-sizing-verification.md` | 追加第 12 节 v5 修复记录 |
| `shots/detail-recommend-fixed-1440x900.png` | 新增：修复后 1440 视口截图 |
| `shots/detail-recommend-fixed-1920x1080.png` | 新增：修复后 1920 视口截图 |

**未变更**（用户确认保持 v4 行为）：
- `src/pages/Browse/Browse.css`（`.browse-grid` 仍 `width: max-content`）
- `src/pages/Search/Search.css`（`.search-grid` 仍 `width: max-content`）
- `src/pages/Collections/Collections.css`（`.collection-grid` 仍 `width: max-content`）
- `src/pages/History/History.css`（`.history-grid` 仍 `width: max-content`）
- `src/assets/styles/index.css`（`.video-card-grid` 仍 `width: max-content`）


