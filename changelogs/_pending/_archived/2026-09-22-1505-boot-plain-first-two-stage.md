---
date: 2026-09-22
module: boot-splash / e2e
type: 行为修复（启动链两段式重排）
build: ✅ npm run build + lint:all 全绿
tests: boot-splash.spec 21/21 · skeleton.spec 18/18 · home.spec 1.1 ✓（ad-hoc 调试档）+ 一次性时序取证（跑完已删）
---

# 启动骨架改两段式：plain 启动页在前、同构骨架在后（顺序，非覆盖）

## 需求（用户 2026-09-22 定稿）

「把 plain 启动页做成第一段、同构骨架推后出现，绝对不是覆盖！！！」——
启动链 = **plain 启动页 → 目标页同构骨架 → 内容**，两段顺序呈现、互不叠层。
推翻 09-20「脚本同步换形、不会先闪默认形态」的即时换形设计。

## 新旧对照

| | 旧 | 新 |
| --- | --- | --- |
| 静态默认 data-shape | `home`（body 空） | `plain`（与中性形态语义一致，plain 档提示居中规则直接命中） |
| 换形时机 | 内联脚本解析期同步换形（plain 一帧不可见） | `setTimeout(revealShape, PLAIN_MS=400)` 后换形 |
| 换形方式 | — | 同一 `#boot-splash` 就地 setAttribute + 重建 body（结构上不可能叠层） |
| data-shape-ready | 脚本同步末尾挂 | revealShape 内挂（第二段完成信号；**两段式后 readyState/attached 读到的都是第一段，禁用作换形依据**） |
| React 先提交（warm） | splash 摘除 | 不变：revealShape 检测元素已摘除则放弃，第二段自然跳过 |

## 实现要点（index.html 内联脚本）

- 设备档/data-cols/COLS token 读取仍在脚本执行期（data-device 早写，防真实页闪档）；
  仅「换形 + 构建 + 填充 + ready 标记」延迟 400ms。
- home 形态提示隐藏规则（`[data-shape="home"][data-shape-ready]`）与两段式兼容：
  第一段 plain 居中显示「正在启动…」，第二段换形后隐藏。

## E2E 同步

- `skeleton.spec.ts` holdSplash：`readyState` 等待 → `waitForSelector('#boot-splash[data-shape-ready]')`（拦主模块 ≥2.5s ≫ 400ms 换形窗）。
- `boot-splash.spec.ts`：静态默认用例补断言 `data-shape="plain"`。
- `boot-splash-shots.spec.ts`：注释更新（等待逻辑本就是 data-shape-ready）。

## 取证

一次性 preview 脚本（已删）：addInitScript 挂 MutationObserver 记录 data-shape 序列，
实测 `[71ms plain] → [513ms home+ready]`（≈PLAIN_MS+构建），顺序两段非叠层。PASS。

## 遗留说明

- PLAIN_MS=400 为拍脑袋默认值，想调节奏只改 index.html 一处常量。
- 全量 E2E 未跑（未放行）；boot-splash-iso / shots 按需入口未在本轮回归。
