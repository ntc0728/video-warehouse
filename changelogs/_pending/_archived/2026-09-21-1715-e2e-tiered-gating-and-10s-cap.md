---
date: 2026-09-21
module: scripts/e2e
type: docs+refactor
build: npm run build ✓（tsc -b + vite build，类型零错误）
files:
  - AGENTS.md
  - docs/agents/testing.md
  - scripts/{browse,chart,collections,cross-tab,detail,history,home,iptv,iptv-player,person,player,player-cms-error,player-failover,regression,settings,skeleton,smoke-player-fs-mobile,source-checker,verify-grid,boot-splash}.spec.ts
  - scripts/fetch-diagram-data.mjs
  - scripts/fixtures/iptv-seed.ts
---

# E2E 分级门禁 + 单步等待 ≤10s 全量清扫

## 旧 ↔ 新

| | 旧 | 新 |
| --- | --- | --- |
| 红线 #6 | 一律「全量 ≤5 分钟」，任何改动都可能触发全量 | **分级门禁**：删除/文档/纯脚本类 = build + lint + 受影响 spec（ad-hoc 档）；行为类才全量；**全量 E2E 未经用户明确允许不得运行** |
| 单步等待上限 | 12s/15s/20s/25s/30s/45s 混杂（存量 ~300 处） | **一律 ≤10s**（新红线 #8）：21 个 spec 的 `waitForSelector` / `toBeVisible` / `expect.poll` / `waitFor({timeout})` 全部压到 10000ms |
| 必须 >10s 才能跑时 | 无规矩（易被自行放宽） | **立即停止操作并向用户说明原因**，禁止自行放宽 |
| 封顶机制 | 与单步等待混为一谈 | 明确豁免清单：用例级 testTimeout 45s/30s、`test.setTimeout`、globalTimeout 30/40min、webServer 就绪 60s、看门狗 120s/300s —— 属 kill-switch 非等待，保留现值（用户确认） |
| browse.spec.ts 013 断言 | 诊断残留（pending 监听 + ZDIAG 打印 + 8s 短窗） | 恢复原语义断言，上限按新规矩改 25s→10s |

## 豁免依据（用户 2026-09-21 拍板）

> 「单步等待/超时 ≤10s」按一类全量清扫；二类的用例级/整轮级/server 就绪预算属于封顶机制，保留现值。

## 验证

- `npm run build` ✓（tsconfig include 仅 src，spec 不在 tsc 覆盖内；本次为纯数字替换，grep 复核 >10s 单步等待零残留）。
- 未跑任何 E2E（分级门禁 + 全量禁令生效中）。
- 已知不兼容项：`boot-splash-shots.spec.ts:113` 仍有 20000（用户 WIP 未跟踪文件，未触碰，已口头提示）。

## 存量缺陷（未修，待用户指示）

/browse 顶部搜索框 Enter 后：`handleSearch` 已执行（`search-history-browse` 写入 localStorage），但 `history.state` 无变化、Browse 页 query 状态未更新（卡片数与「共 84,922 条」计数不动）→ 页面搜索回调链（usePageSearchStore.setPageSearch → handlePageSearch）疑似断裂，BROWSE-013/094/095 三条失败同源。非本轮引入（demo 删除仅动 routes/routeConfig 的三条占位路由）。
