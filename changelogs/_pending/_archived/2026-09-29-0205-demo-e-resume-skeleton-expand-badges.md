---
date: 2026-09-29 02:05
---

# 精简评审二轮五项：继续播放语义 / 骨架横条禁点 / 搜索就地展开 / 去导航底线 / 封面四角标

- date: 2026-09-29 02:05
- module: demos/home-style-e-typographic.html
- type: feat+fix
- build: lint:all 7 门全绿 + smoke-e.mjs 32 项断言 SMOKE OK + check-demo ALL OK
- files: demos/home-style-e-typographic.html (+115/−36)

## 旧 ↔ 新

1. **继续播放语义缺失（用户报「没体现」）**：原继续观看区无「继续播放」入口、banner 永远是「立即播放」。新：① `continue_` 改为 trending.slice(0,6) 与 banner 池重叠 → banner CTA 命中时显示「▶ 继续播放」（HeroBili historyMap 同款语义）；② 01 区卡片加 hover 遮罩 ▶（`.resume`）+ 原进度条。
2. **骨架期元素可点/直接显示真身（用户要求显示横条）**：`<html class="booting">` 静态初始化，骨架期导航链接/主题钮/搜索/数据徽章/区块 sub 与 more 链接/图片索引标签变横条占位且 `pointer-events:none`；edition/foot-stats 空态用 `::before` 横条补位；shuffle/search/theme 同步 `disabled`；boot 完成移除 booting + 解锁。
3. **搜索展开效果（用户：悬浮屏上效果不好）**：原绝对定位浮条改为「就地展开」——点击搜索按钮原位换成输入条（按钮 `hidden` 换 form），width 0→clamp(220,21vw,320) 动画 + 下划线展开；展开期 `.nav-fn.searching` 禁 wrap 防两行，收起后恢复。收条在回车/放大镜后触发（结果面板保留 = 跳转语义）；外点/⌘K/Esc 逻辑同步。
4. **`.mast-nav` 去 border-bottom**：顶导航下分隔线删除。
5. **封面四角标补齐（用户：原有角标呢）**：原单一 `.sc` 混杂角标改为镜像 `.video-card` portrait 四角——左上 ★ 评分（score.toFixed(1)）/ 右上收藏心（hover 显形、已收藏常驻红、点击写 FAVS）/ 左下年份 / 右下类型；搜索结果卡共用 `rcardHTML()`；`initRowFav()` delegation 绑 home-rows + search-grid；继续观看 `.time` 角标移左上（项目 landscape source-badge 同位）。

## 验证

- smoke-e.mjs 32 项全过：四角标×4 + 收藏心点击写入 + booting 收尾 + 继续播放语义×4 + 就地展开 10 项 + 换一换 4 项。
- `npm run lint:all` 7 门全绿。
