---
date: 2026-09-10 22:15
module: tests+docs
type: test
build: npm run build 通过 · 单测 33 files / 389 tests · e2e --workers=2 全量 126 passed / 1 skipped（共 127 条 / 18 spec）
files:
  - src/components/UniversalPlayer/lib/utils.test.ts (新增)
  - scripts/iptv.spec.ts
  - scripts/browse.spec.ts
  - scripts/detail.spec.ts
  - scripts/home.spec.ts
  - scripts/run-tests.ps1
  - docs/agents/patterns.md
  - docs/agents/testing.md
  - docs/knowledge/03-dev-guide.md
  - docs/KNOWN-ISSUES.md
  - docs/fix-iptv-tv-fallback.md
  - docs/test-cases/02-home.md
  - docs/test-cases/03-browse.md
  - docs/test-cases/04-detail.md
  - docs/test-cases/06-iptv.md
demo: 无
---

## 回归护栏补齐 + 公共文档同步（走读反馈批次的收尾）

### 新增测试（4 条 e2e + 1 个单测文件，共 6 条单测）

| 用例 | 守的是什么 | 验红结果（旧代码） |
| --- | --- | --- |
| `IPTV-090` | 收藏按钮**不依赖台标加载结果**：拦截 `i.imgur.com` 全部 404，断言 `.iptv-card-favorite` 数 == `.iptv-channel-card-wrap` 数 | ✅ 旧代码失败：`favorites(3) ≠ cards(60)` |
| `DETAIL-090` | 灯箱缩放控件在主图正下方（三行流式布局）：`__zoom`/`__thumbs` 为 `relative`、竖向次序、水平居中 ±2px | ✅ 旧代码失败：`zoomPosition` 为 `absolute` |
| `BROWSE-081/082` | 底部操作区真固定：footer 是 `.drawer-body` 的**兄弟**、滚动前后 y 不变、底边贴住面板；层级 ≥1000 且面板打开时返回顶部圆钮 `display:none` | 结构断言（旧代码 footer 在 `.drawer-body` 内） |
| `HOME-089` | Hero 主图 404 → 公共品牌兜底（**HeroBili + Classic 两条路径**，两条都断言 `kinoTV`） | 旧代码无兜底节点 |
| `src/components/UniversalPlayer/lib/utils.test.ts` | `getResolutionLabel` 对 `height=0` 不产出「0P」；`getSelectableLevels` 过滤且**保留 adapter 原始索引** | 旧代码 `getResolutionLabel(0)` 返回 `0P` |

> 验红/绿按项目约定用 `git checkout <commit> -- <file>` 回退源码（而非 stash），确认护栏在旧代码上确实会红。
> `detail.spec.ts` 的新 describe 命名避开文档既有段号，定为 **3.11 剧照灯箱**（文档 3.9 是「页面状态与回退」）。

### 测试脚本

`scripts/run-tests.ps1` 精粒度映射同步：`HeroBanner/**` 段号加 `1\.3e`、`StillsLightbox/**` 加 `3\.11`、
`IPTVChannelCard/**` 与 `services/channelLogo.ts` 加 `5\.11`、`BrowseMobileBar.tsx` 加 `BROWSE-081|082`，
并新增 `src/components/ui/Drawer.tsx` / `Drawer.css` → browse 的 `2\.8|2\.9`；
同时注明「uiPrecisionMap 是全部命中即累积、非首个命中即停」，因此改 `ui/Drawer*` 会连带命中
`ui/**`（settings 6.6），属已知的轻微过度覆盖。

### 文档同步

- **`docs/agents/patterns.md`**：重写「IPTV 频道台标」一节 —— 原文描述的是**已下线**的「三级回退链」
  （M3U tvg-logo → EPG `<icon>` → 在线台标库，2026-09-08 定稿为 iptv-org 单一来源），
  更正为当前实现，并补上三个必知项（imgur 托管域不可达 + 不走代理、`LOGO_FAIL_TTL = 6h`、
  卡片侧三条渲染约定）；另新增「全屏抽屉（Drawer）底部操作区」与「播放器进度条与控制栏」两节，
  HeroBanner 一节补「主图兜底」与「移动端滑动性能」两组约束，Toast 一节补播放器居中提示的锚定规则。
- **`docs/agents/testing.md`**：用例总数 123 → **127**；明确指出表中「test 数」列多为历史快照、
  与 `--list` 口径不一致，给出权威统计命令；补 `StillsLightbox/**`、`ui/Drawer.*`、`lib/utils.ts`(vitest) 三行映射；
  记录 `--workers=2` 的全量跑法与理由。
- **`docs/knowledge/03-dev-guide.md`**：清掉「主目录 13 个 spec 共 181 用例」的陈旧数字，
  改为指向 testing.md 的 `--list` 口径；补「Vite 转换缓存可能陈旧 → e2e 打到旧代码」的验证步骤与 `--workers=2` 建议。
- **`docs/KNOWN-ISSUES.md`**：新增 4 条 —— #15 IPTV 台标托管域不可达（待用户决策是否走代理）、
  #16 移动端 Hero banner 拖拽期 5 张全宽大图并存（未修，含「同批已修的三条勿回退」）、
  #17 Radix Dialog 非 passive touchmove（依赖库行为，含已做的收敛）、#18 Vite dev 缓存陈旧工具链坑（含判据命令）。
- **`docs/fix-iptv-tv-fallback.md`**（注：`docs/*` 被 .gitignore 忽略，该文件是本地文档、不入库）：新增 §10 —— Hero 主图复用公共兜底 class 的实现方式与
  「只写 onError 驱动内部状态机不算兜底」的教训；以及 IPTV 台标容器 `cover → contain` 的口径修正。
- **用例分片**：`02-home.md` 补 HOME-089、`03-browse.md` 补 BROWSE-081/082、`04-detail.md` 补 DETAIL-090、`06-iptv.md` 补 IPTV-090。
