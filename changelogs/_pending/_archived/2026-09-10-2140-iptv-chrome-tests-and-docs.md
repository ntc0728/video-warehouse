---
date: 2026-09-10 21:40
module: 测试 / 文档 / 记忆库（IPTV 播放页 chrome 收尾）
type: test
build: 通过（npm run build）
files:
  - scripts/iptv-player.spec.ts
  - scripts/fixtures/iptv-seed.ts
  - docs/agents/patterns.md
  - docs/agents/testing.md
  - docs/KNOWN-ISSUES.md
  - docs/sizing-fluid-dims.md
  - docs/sizing-inventory.md
---

## IPTV 播放页 chrome 收尾：补测试脚本 + 同步公共文档

承接同日两次改动（提案 → 落地 commit `450dd3d`），本轮只补测试与文档，不改产品代码。

### 一、测试脚本：新增 11.4 段 IPTVP-020 ~ 023

`scripts/iptv-player.spec.ts` 从 6 条扩到 **10 条**（全量 118 → **122 条 / 18 spec**）：

| 用例 | 断言 |
| --- | --- |
| IPTVP-020 | OSD 宽度走 78vw 单曲线：1024 / 1280 / 1440 三档判 `osdW / vw ∈ (0.76, 0.8)`，且左右留白 ≥ `--space-lg`（旧的两段式曲线在 1024 处是 98vw、1440 处 84vw，都会被判红） |
| IPTVP-021 | ≥1024 左右翼等宽（差 < 1.5px）+ 控件行相对 OSD 中心偏移 < 1.5px（改前 +27.9px）+ 控件行不裁切 |
| IPTVP-022 | 「音轨」恒显示（控件按钮数 = 4，桌面带文字、375 只留图标）+ 两种布局下控件行都不裁切 |
| IPTVP-023 | 频道列表一级栏 132px（375 走窄屏档 116px）、二级栏 > 一级栏 × 1.8（改前两者相等）、质量徽章 375 隐藏 |

**已用旧代码验证过断言有效**：`git checkout 450dd3d^ -- <4 个源文件>` 回退后四条**全部变红**，
还原后全绿。⚠️ 这一步不能用 `git stash push -- <路径>` —— 这批改动已 commit，stash 会
「无可 stash」而**静默什么都不回退**，于是测出一个假的「旧代码也通过」
（本轮第一次验证就踩到了）。必须 `git checkout <rev>^ -- <路径>`，验完
`git checkout HEAD -- <路径>` 还原，再 `git diff HEAD --stat` 确认干净。

判定阈值写成**区间/比例**而不是等值（如 `osdW/vw ∈ (0.76,0.8)`）：这些 token 都乘
`--ui-scale`，而该曲线在产物里是 0.00013 而非源码的 0.000125 → ≥1920 档实测比手算大 ≈1%
（1920 处 `--ui-scale` = 1.0096），等值断言会被这 1% 打红。

### 二、新增 fixture `scripts/fixtures/iptv-seed.ts`

频道列表断言需要 `channels` 非空，但 e2e 不应依赖真实 IPTV 源。该 fixture 用**注入缓存**
喂数据（零网络请求）。头注释记了三个「不能错」的细节，摘要同步进 `docs/agents/testing.md`：

1. **必须先访问一次同源页面**再注入 —— 否则 `indexedDB.open('video-warehouse')`（不带版本号）
   会开出一个**没有任何 object store** 的空库，应用随后按 v8 打开时 upgrade 已被跳过 →
   `db.get('iptvChannels')` 直接抛错；
2. localStorage `iptv-store` 必须 `version: 0`（zustand persist 版本号）且
   `settings.aggregatorUrls` **非空** —— `loadFromCache` 在 sourceUrls 为空时直接 return false；
3. IndexedDB 记录的 `sourceUrls` 必须与 `aggregatorUrls` **逐元素、保持顺序**相等 ——
   `getCachedIPTVChannels` 刻意不做 sort 比较（源顺序决定频道 `sourceId`）。
   另：频道不要带 `sourceId: 'source-N'` 前缀（`loadFromCache` 会过滤掉这类本地源频道）。

### 三、公共文档同步

| 文件 | 内容 |
| --- | --- |
| `docs/agents/patterns.md` | 新增「IPTV 播放页 chrome（频道列表 / OSD 栏）尺寸契约」段：五个子项（一/二级宽度内容派生、OSD 单曲线、左右翼等宽、控件行 nowrap + 图标化、音轨恒显示）+ 量测口径两个坑 + `nowrap` 的安全网警告 |
| `docs/KNOWN-ISSUES.md` | 新增**第 14 条**：播放器内 `--color-primary = #000` → 频道列表活跃态全不可见（含四条规则的实测值与影响面约 10 处），标注「已知 · 未修 · 待办，用户指示单独立项」 |
| `docs/agents/testing.md` | 总数说明 118 → **122 条 / 18 spec**；`src/pages/IPTV/` 行 10+6 → **10+10**；新增 IPTVOSDBar/IPTVChannelList 的精准映射行（`-g "IPTVP-02"`）；`UniversalPlayer` 合计 57 → **61**；新增「IPTV 频道数据种子」小节 |
| `docs/sizing-fluid-dims.md` | `--layout-osd-max-width` 行改为新曲线各档实测值（320 / 599 / 799 / 998 / 1413 / 1512 / 1512，并说明 ≥1920 含 `--ui-scale`）；新增 `--layout-channel-group-w` 行（116 / 132 ×5 / 143 ×2）；顶部加改期提示；使用位置补一行 |
| `docs/sizing-inventory.md` | 修掉失效 token 名（`--layout-iptv-channel-list-w` → `--layout-panel-medium-w`，该名早已重命名）；新增 `--layout-channel-group-w` 行 |

### 四、记忆库

- 已存在并行会话写的 `iptv-player-chrome-landed.md`，**不新建重复条目**：删掉本轮误建的
  `iptv-player-chrome-contract.md`，把缺的部分（IPTVP-020~023、验证红/绿的 `git checkout` 手法、
  公共文档落点）追加进该文件。
- 新增 `uiscale-coefficient-minified.md`：`--ui-scale` 的 vw 系数源码写 `0.000125`、
  产物与 dev server 实为 **0.00013**，≥1920 的 token 实测比手算大 ≈1%（1920 → 1.0096）。
  这是本轮把 OSD 宽度改成 `clamp(320px, 78vw, 1400px)` 后，1920 处预期 1400 却实测 1413.4
  才反推出来的；用旧曲线同样成立（1329.6 × 1.0096 = 1342.4 ＝ 改动前实测值），故为既有行为。
- 三条记忆里的「全量 E2E 基线 117 passed」统一更新为 **121 passed / 1 skipped（122 条 / 18 spec）**。

### 验证

- `npm run build` 通过（exit 0）。
- 全量 e2e：**121 passed / 1 skipped**（122 条 / 18 spec），无 flaky 复发。
- 新增 4 条断言在改动前代码上**全部变红**（见上），改动后全绿 —— 断言有效性已验证。
