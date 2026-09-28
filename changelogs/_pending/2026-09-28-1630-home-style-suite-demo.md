---
date: 2026-09-28
module: Home
type: proposal
build: n/a（仅 Demo，未改 src）
files: demos/home-demos-all.html、demos/home-style-e-typographic.html、demos/home-e-v1-faithful.html、demos/home-e-v2-edit.html、demos/home-e-v3-rail.html、demos/home-n1-cinemaglow.html、demos/home-n2-gallery.html、demos/home-n3-stage.html（仓库根 demos/）
demo: demos/home-demos-all.html
---

## 首页风格探索 · 七款 suite × 4 端适配 Demo（待拍板）

- 日期：2026-09-28（承接 2026-09-24 去卡片化线索）
- 脉络：v1 剥壳 / v2 渐变 / v3 同构换皮 / v4 五方案（A 影院画廊 / B 印刷杂志 / C 霓虹赛博 / D 高密度门户 / E 命令面板，原 `changelogs/demos/demo-home-decard-2026-09-24.html`）先后被否，v4 文件已删除（从未入 git，无法恢复）；当前基准 = 仓库根 `demos/` 七款分文件 + 总览外壳。
- 七款：`home-style-e-typographic`（E 报刊排版，旧基准）/ `home-e-v1-faithful`（结构忠实版）/ `home-e-v2-edit`（编辑部重排版）/ `home-e-v3-rail`（左栏动线版）/ `home-n1-cinemaglow`（光晕影院）/ `home-n2-gallery`（画廊白盒）/ `home-n3-stage`（宽幅舞台）；总览外壳 `home-demos-all.html` = 风格切换 + 设备切换（iframe 承载，`?device=` 传递）。
- 数据：运行时拉真实 CMS（豆瓣 dbzy5 / 茅台 maotaizy，`ac=videolist`），离线自动回退演示数据并在徽章标识；骨架屏过渡、图片 onerror 降级。
- 4 端适配（每文件独立 `xdev-css` + `xdev-js` 块，`?device=tv|beamer` 或真机视口触发）：
  - **TV 10-foot**：`body zoom:1.5`（1280 逻辑布局渲染占满 1920）+ 安全区 `3.5vh/3.5vw` + 焦点 `outline 3px` 金 + 列数锁低档（--poster-n:6）
  - **投影仪**：`zoom:1.4` + 亮度自检（body 亮度 >0.5 自动 `invert+hue-rotate(180deg)` 反色、img 二次反色还原海报）+ 列数 7
  - **21:9 超宽**：外壳 iframe 固定 3440×1440 视口 scale 展示；真机 `@media (width≥2560px)` 升列（--poster-n:9、--pad-x:120）+ `min-aspect-ratio:21/9` 再升（10 列、封顶 3000px）
- 验证（headless chromium，28 例 = 7 款 × 4 端，2026-09-28）：0 JS 错误；zoom / 列数 / 设备属性全部生效；真实 CMS 数据全 200、渲染完整。已知小瑕疵：① E 系骨架期按桌面列数渲染，真数据回填前有 ≤98px 瞬时水平溢出（约 6s 自愈）；② N1 装饰光晕 `.aura` 超宽 72–240px，被 `body overflow-x:hidden` 裁切（预期）。
- 构建：n/a（src 未动）
