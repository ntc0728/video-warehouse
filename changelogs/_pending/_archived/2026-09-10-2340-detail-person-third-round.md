---
date: 2026-09-10 23:40
module: Detail / StillsLightbox / videoService / Person
type: fix + feature
build: 通过（pnpm run build）
files:
  - src/pages/Detail/Detail.css
  - src/pages/Detail/index.tsx
  - src/components/StillsLightbox/StillsLightbox.tsx
  - src/components/StillsLightbox/StillsLightbox.css
  - src/services/videoService.ts
  - src/pages/Person/Person.css
demo: changelogs/demos/demo-widescreen-overhaul-2026-09-10.html（议题④ C1 形态）
---

## Detail / Person 第三轮调整（用户 2026-09-10 反馈 6 项）

### 问题与旧逻辑

| # | 现象 | 根因 |
| --- | --- | --- |
| 1 | `detail-hero-side` 没有分行 | 右栏窄，info-card 保持「图标+标签+值」单行、值被挤压 |
| 2 | 简介未随基础信息进右栏 | 简介块仍留在 info tab 内条件渲染 |
| 3 | hero 偏宽 / 海报偏大 | 列比 1.55fr:1fr、海报用全局 `--layout-detail-poster-w` |
| 4 | 剧照缩放在网格标题行，形态不符 | 位置与交互都在 Detail 页，用「相邻档位百分比」按钮 |
| 5 | **有线路却显示「0 条线路」/「1 集」** | 见下 |
| 6 | Person 返回键偏下 | `top: var(--space-md)`(≈9px) |

### 第 5 项的根因（实测接口确认）

抓 `iqiyizyapi` 的 `ac=videolist&wd=海洋奇缘：启航&year=2026` 返回：

```
type_id: 11, type_id_1: 7      ← 均不在 VOD_TYPE_MAP(1/2/3/4) 内
vod_play_url: 正片$https://play.ly166.com:65/videos/.../index.m3u8
```

链路：`getCmsVodType` → `undefined` → `parsePlaySources` 的 `isMovie = vodType === 'movie'` 为 false
→ 这条**单线路**被写进 `episodes`、`sources` 留空 → 详情页 meta 行 `v.sources.length` = 0。

### 新逻辑

1. **info-card 分行**：`flex-wrap: wrap` + `strong { flex-basis: 100% }`，值左对齐到标签起点。
2. **简介上提**：抽 `overviewNode` 变量，≥1024 随 `infoCoreNode` 进右栏；窄屏仍在 info tab
   （同一份 JSX 按 `isWideDetail` 决定渲染位置，不产生重复 DOM）。
3. **列比 1.55fr → 1.4fr**（1440 下 hero 797 → 771px、右栏 515 → 551px）；
   `.detail-hero-bg` 是 `inset:0` 自动跟随列宽，无需单独改。
   **海报 ×0.78**（1440 实测 160 → 125px 宽）。
   分行 + 简介后右栏内容实测 774px > hero 457px，由已有 `overflow-y` 兜底为栏内滚动（非裁切）。
4. **剧照缩放迁入 StillsLightbox**：形态改为 `− / 百分比 / +`（符号显示），每级 5%、
   范围 50%~200%、到界禁用；放大后可拖拽平移；**单击主图复位 100%**（点百分比数字同样复位）；
   键盘 `+`/`-`/`0`；切图自动复位。详情页侧删除原控件、`STILLS_ZOOM_STEPS` 常量与 `--stills-zoom` 列宽联动。
   实测：100% → 连点 + 到 200%（+ 禁用）→ 连点 − 到 50%（− 禁用）→ 单击图片回 100%。
5. **线路数取值修复**：`resolvePlaySources` 中非 `forceSeries` 时 `getCmsVodType(item) ?? 'movie'`。
   ⚠️ 不能把 `undefined` 全局当 movie —— `forceSeries` 正是用 `undefined` 表示「强制按剧集解析」。
   另在详情页 meta 行补兜底（sources 空 → episodes 数量 → 都空才「暂无线路」），「全部」按钮条件同步纳入。
   实测：爱奇艺资源由「1 集」变为「正片」，与其余三源一致。
6. **Person 返回键**：`top: var(--space-md)` → `var(--space-xs)`（实测距 hero 顶部 5px）。

### 验证

- `pnpm run build` 通过。
- E2E：`detail.spec.ts` 7/7 + `person.spec.ts` 4/4 = **11/11 全通过**。
- 浏览器实测 1440：两栏 `858/613`、hero 817×459 与右栏同高、海报 125×187、
  分行生效（标签 169 / 值 195）、简介仅在右栏、灯箱缩放全档位与复位均正确。

### ⚠️ 与并行会话 WIP 的冲突（需用户裁决）

同一工作区存在**另一个会话未提交的 WIP**（`changelogs/_pending/2026-09-10-1542-home-trend-rail-1024-breakpoint.md`），
与首页第一、二轮的拍板结果**直接冲突**：

| 项 | 本会话已提交（用户拍板） | 并行会话在途 WIP |
| --- | --- | --- |
| 宽屏起点 | **≥1280**（commit `aaaf1b2`） | 改回 **1024** |
| 首页左栏 | 分类热度榜 3 卡 × 5 条（`cqa-catcard`） | 重写为「今日趋势 TOP20」（`cqa-trend`） |
| 其他 | — | HeroBili 右卡 6→5、Chart/SearchBox/StickyHeader 同步调整 |

**后果**：当前工作树跑 `home.spec.ts` 有 5 项失败（`.cqa-catcard` 断言找不到元素），
全部由该 WIP 引起，与本批改动无关。**需用户确认以哪一边为准**，再决定是合并还是废弃。
本会话未触碰上述 WIP 文件，也未将其纳入提交。
