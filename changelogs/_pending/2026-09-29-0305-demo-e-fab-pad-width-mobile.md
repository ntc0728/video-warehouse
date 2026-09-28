# 方案C：FAB 外扩与 hover 修正 / 主体留白对齐项目 / 小视口·移动端适配

- date: 2026-09-29 03:05
- module: demos/home-style-e-typographic.html
- type: fix
- build: lint:all 7 门全绿 + smoke-e.mjs 全过 + check-demo ALL OK
- files: demos/home-style-e-typographic.html (+44/−14)

## 旧 ↔ 新

1. **FAB 位置**：右下 `right: clamp(14,1.6vw,28) / bottom: clamp(14,2vh,26)`（紧贴内容）→ `right: clamp(24,2.6vw,48) / bottom: clamp(28,3.6vh,52)`，按钮间距 8→10px，离开内容留出呼吸边距。
2. **FAB hover 背景**：`background: var(--ink)`（日刊实心黑块、夜刊变浅色块刺眼）→ `background: var(--band)` + `translateY(-2px)` + 阴影加深 `4px 5px 0 ink`；过渡拆为 background/transform/shadow 三项。
3. **主体内容宽度对齐项目**：demo `--pad-x: clamp(16,2.4vw,44)`（1000–1439 视口比项目每边宽 ~12–20px 留白，内容窄 ~40px）→ 项目 `--page-pad-x` 同式分档：768–1439 = `clamp(12px, 9.77385px+0.59364vw, 14.333px)`（--space-lg），<768 = `clamp(6px, 5.04581px+0.25445vw, 7px)`（--space-sm），≥1440 沿用原有 60/100/140 档（与项目一致）；`--content-max:2200px` 与项目 >2200 封顶一致不变。
4. **小视口 ≤1023**：列数降档 `--poster-n:4 / --cont-n:3`；`.sec-head` 换行防溢出；搜索建议下拉宽度自适应；横滚箭头常显（平板无 hover）。
5. **移动端 ≤767**：`--poster-n:3 / --cont-n:2`；mast-row/brand 缩放换行；hl-actions 换行；cont 间距收紧；搜索展开条放宽至 `min(80vw,320)`（须同 `.search-wrap.open` 特异性覆盖）；FAB 贴 16/20px + 44px 触屏点击区；footer 纵排。
6. **触屏 `hover:none`**：收藏心 b-tr 与横滚箭头常显（无 hover 能力时可见可用）。

## 验证

- check-demo ALL OK（ids=42 refs=27 缺失 0）；smoke 44 项断言 SMOKE OK。
- `npm run lint:all` 7 门全绿。
