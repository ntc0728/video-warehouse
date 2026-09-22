---
date: 2026-09-22 18:33
module: tooling
type: audit
build: false
files:
  - package.json
---

# package.json scripts 执行耗时审计

环境: node v24.14.0 / pnpm 10.33.0 / 2026-09-22 18:33

| # | script | 类型 | 耗时(s) | 状态 | 备注 |
| --- | --- | --- | ---: | --- | --- |
| 1 | `postinstall` | complete | 5.97 | OK | exit=0 · > node scripts/optimize-deps.mjs / > kinotv@1.27.1 postinstall D:\trae\5.13\vide… |
| 2 | `sync:android-version` | complete | 1.08 | OK | exit=0 · > kinotv@1.27.1 sync:android-version D:\trae\5.13\video-warehouse / > node scrip… |
| 3 | `icons:android` | complete | 2.85 | OK | exit=0 · ======================================== / 下一步: /   1. pnpm exec cap sync androi… |
| 4 | `lint:json` | complete | 1.16 | OK | exit=0 · > kinotv@1.27.1 lint:json D:\trae\5.13\video-warehouse / > node scripts/json-dup… |
| 5 | `lint:design` | complete | 1.06 | OK | exit=0 · ✓ raw-z-index            [enforce] 新增 0    / 基线 0    / 现存 0     页级裸 z-index（≥100… |
| 6 | `lint:css` | complete | 5.8 | OK | exit=0 · > kinotv@1.27.1 lint:css D:\trae\5.13\video-warehouse / > stylelint "src/**/*.{c… |
| 7 | `lint` | complete | 59.92 | OK | exit=0 ·   40:17  warning  Fast refresh only works when a file only exports components. U… |
| 8 | `test` | complete | 14.82 | OK | exit=0 ·     at new Promise (<anonymous>) /     at runWithCancel [90m(file:///D:/trae/5.… |
| 9 | `test:coverage` | complete | 20.14 | OK | exit=0 ·     at new Promise (<anonymous>) /     at runWithCancel [90m(file:///D:/trae/5.… |
| 10 | `build:fast` | complete | 43.1 | OK | exit=0 · [2mdist/[22m[36massets/react-vendor-D_VZw7Sb.js            [39m[1m[2m235.5… |
| 11 | `build` | complete | 51.44 | OK | exit=0 · dist/D:/trae/5.13/video-warehouse/assets/dash-vendor-CgWRSAQK.js.br             … |
| 12 | `lint:all` | complete | 103.18 | OK | exit=0 ·  ✅ lint:design /  ✅ lint:css /  ✅ lint:json (重复 key) /  ✅ lint (eslint) /  ✅ bui… |
| 13 | `build:android` | complete | 61.95 | OK | exit=0 · [info] Found 3 Capacitor plugins for android: /        @capacitor/screen-orienta… |
| 14 | `test:changed` | complete | 81.57 | FAIL | exit=1 ·     Error Context: test-results\home-1-2-HeroBanner-交互-Ban-8cc55-0-Banner存在-012-… |
| 15 | `test:smart` | complete | 81.4 | FAIL | exit=1 ·     ────────────────────────────────────────────────────────────────────────────… |
| 16 | `test:smoke` | complete | 70.84 | OK | exit=0 ·   ok 29 [chromium] › scripts\player.spec.ts:530:5 › 4.13 投屏能力分端（Web Cast / iOS 隐… |
| 17 | `test:regression` | complete | 91.24 | FAIL | exit=1 ·     test-results\home-1-2-HeroBanner-交互-Ban-8cc55-0-Banner存在-012-缩略图-011-CTA）-ch… |
| 18 | `test:e2e:skeleton` | complete | 101.27 | FAIL | exit=1 ·     Call log: / [100s] 清理无响应的测试自建 server PID 23484 / [101s] playwright 退出码 1；总耗时… |
| 19 | `test:e2e:subpages` | complete | 7.62 | OK | exit=0 ·   ok 3 [chromium] › scripts\source-checker.spec.ts:16:3 › 9.1 网速检测 › CHK-001/004… |
| 20 | `dev` | resident | 12.44 | RESIDENT_KILLED | timeout 12000ms · > kinotv@1.27.1 dev D:\trae\5.13\video-warehouse / Port 3001 is in use, trying a… |
| 21 | `preview` | resident | 12.44 | RESIDENT_KILLED | timeout 12000ms · > vite preview / > kinotv@1.27.1 preview D:\trae\5.13\video-warehouse /   [32m➜… |
| 22 | `test:watch` | resident | 9.81 | OK | exit=0 ·     at new Promise (<anonymous>) /     at runWithCancel [90m(file:///D:/trae/5.… |
| 23 | `test:e2e:report` | resident | 12.46 | RESIDENT_KILLED | timeout 12000ms · > kinotv@1.27.1 test:e2e:report D:\trae\5.13\video-warehouse / > pnpm exec playw… |
| 24 | `open:android` | resident | 1.14 | OK | exit=0 · > kinotv@1.27.1 open:android D:\trae\5.13\video-warehouse / > pnpm exec cap open… |
| 25 | `lint:fix` | skip | 0 | SKIPPED | 会改工作区文件 |
| 26 | `lint:css:fix` | skip | 0 | SKIPPED | 会改工作区文件 |
| 27 | `lint:design:update` | skip | 0 | SKIPPED | 会改 baseline 文件 |
| 28 | `deploy:pages` | skip | 0 | SKIPPED | 外部部署副作用 |
| 29 | `deploy:worker` | skip | 0 | SKIPPED | 外部部署副作用 |
| 30 | `deploy:cors` | skip | 0 | SKIPPED | 外部部署副作用 |
| 31 | `test:e2e` | skip | 0 | SKIPPED | 全量 E2E 红线，需明确授权 |
| 32 | `test:e2e:shots` | skip | 0 | SKIPPED | e2e-skeleton --all 全量红线，需明确授权 |

## 卡死记录（不处理，仅击杀后继续）

- （无 HANG_KILLED）

## 常驻型（预期不退出，探活后击杀）
- `dev` 12.44s 后仍存活 → 判定常驻服务，已击杀
- `preview` 12.44s 后仍存活 → 判定常驻服务，已击杀
- `test:e2e:report` 12.46s 后仍存活 → 判定常驻服务，已击杀

## 跳过
- `lint:fix` — 会改工作区文件
- `lint:css:fix` — 会改工作区文件
- `lint:design:update` — 会改 baseline 文件
- `deploy:pages` — 外部部署副作用
- `deploy:worker` — 外部部署副作用
- `deploy:cors` — 外部部署副作用
- `test:e2e` — 全量 E2E 红线，需明确授权
- `test:e2e:shots` — e2e-skeleton --all 全量红线，需明确授权

原始日志目录: `C:\Users\13438\AppData\Local\Temp\npm-timing-20260922-181925`
