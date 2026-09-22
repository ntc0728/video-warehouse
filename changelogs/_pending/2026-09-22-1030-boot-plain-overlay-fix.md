---
date: 2026-09-22
module: boot-splash / home / main
type: 行为修复（启动链 plain 覆盖）
build: ✅ npm run build（49s）+ lint:all 全绿
tests: skeleton.spec 18/18 · boot-splash.spec 21/21 · home.spec 1.1 首屏用例 ✓（ad-hoc 调试档，未跑全量）
---

# 修复：首页启动骨架被 plain AppLoading 盖脸（用户 2026-09-22 反馈）

## 根因

09-21 整改只动了 index.html 启动骨架的「形」，React 侧两处 plain 插队未处理：

1. `main.tsx` `dropBootSplash` 只等「#root 有子节点」——chunk 冷加载时首帧提交的是
   `BootLoading` / AppLayout `LoadingFallback`（`.app-loading` plain），骨架一摘就被 plain 盖住；
2. Home 首进无数据时固定 500ms `pageLoading`（整页 AppLoading「精彩内容加载中…」），
   同构骨架被拦腰打断成「骨架 → plain → 骨架 → 内容」。

## 新旧对照

| | 旧 | 新 |
| --- | --- | --- |
| splash 摘除条件（main.tsx） | #root 有子节点即摘 | 有子节点 **且首帧非 plain**（存在 `.app-loading--fullscreen` / `.page-loading .app-loading` 时不摘）；10s 兜底改为 force 强摘 |
| Home 首进整页 loading | 500ms AppLoading 后才进骨架 | 删除 `pageLoading`，直接进 homeSkeleton / enterPhase 骨架覆盖 |
| 8.3C 机制（Suspense fallback 时间戳跳过 500ms） | main.tsx / AppLayout / Home 三处协作 | 整体退役（`window.__kinoSuspenseFallback` 及 vite-env.d.ts 声明删除） |
| `.home-page--loading`（Home.css） | 服务 plain loading 容器 | 删除留注释 |
| home.spec 003 断言 | `.app-loading` 可见 | `#boot-splash, .home-skeleton, .app-loading` 任一在位（启动链契约改为「同构骨架恒在位」） |

## 取证

- boot-splash 21/21 含「主模块放行后骨架被摘除（不残留）」——新摘除判据无死锁。
- 一次性 preview 脚本（跑完已删）：拦延迟 HomeRoute chunk 制造 plain 窗口，实测
  `.app-loading` 在位期间 `#boot-splash` 仍在、chunk 落地后骨架正常摘除（PASS）。

## 遗留说明

- BootLoading / LoadingFallback 组件保留：仍是 Suspense fallback（导航切页时 LoadingFallback 可见），
  仅启动期被骨架遮住。
- 属行为类改动，全量 E2E 未跑（未经用户放行）；受影响 spec 均已 ad-hoc 绿。
