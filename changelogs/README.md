# Changelogs — 每日改动记录

> 本目录记录每次 UI / 逻辑改动的「旧逻辑 ↔ 新逻辑」对照，并**永久留存配套 Demo**，
> 用于跨会话追溯「为什么这么改、改之前长什么样」。

## 约定

1. **每日一文件**：以日期命名 `YYYY-MM-DD.md`，同一天的多次改动追加到同一文件。
2. **每次改动必更新**：完成一处改动（无论大改还是微调）后，立即在当日文件追加一条记录。
3. **记录格式**（每条改动）：
   ```markdown
   ## <简短标题>
   - 日期：YYYY-MM-DD
   - 问题：一句话现象
   - 旧逻辑：当前实现 + 为什么有问题（引用 文件:行号）
   - 新逻辑：改成什么 + 解决点
   - 涉及文件：xxx.tsx / xxx.css
   - 关联 Demo：demos/xxx.html （观感类改动必须有）
   - 构建：npm run build 通过 / 失败
   ```
4. **Demo 永久留存**：所有对比 Demo 放在 `changelogs/demos/`（不再删除）。
   - 命名建议：`demo-<功能>-<日期>.html`，或 `demo-<问题简述>.html`。
   - 观感类（动画/过渡/布局）改动**必须**附带可预览 Demo。
5. **预览方式**：在仓库根目录起一个静态服务器即可访问，例如
   `python -m http.server 8123`，然后浏览器打开
   `http://localhost:8123/changelogs/demos/<文件名>.html`。
6. **索引**：本 README 下方维护「Demo 索引」表，新增 Demo 时同步登记。

## Demo 索引

| 文件名 | 用途 | 关联改动日期 |
|--------|------|--------------|
| `demos/button-press-demo.html` | 按钮按压反馈方案对比 | 早期会话（归档留存） |
| `demos/demo-thumb-switch.html` | HeroBanner 缩略图切换 旧↔新 逻辑对比 | 2026-07-27 |
| `demos/demo-sidebar-collapse.html` | 侧边栏展开「弹一下」根因复现（结构等价）：OLD=`.main` 带 overflow:clip（复现弹跳）/ NEW=去 clip（连续滑入） | 2026-07-27 |
| `demos/demo-sidebar-perf-2026-07-27.html` | 侧边栏折叠性能方案 A/B/C 对比（width transition / transform 补偿 / 主内容 transform 平移），最终采用方案 B | 2026-07-27 |
| `demos/demo-player-mobile-settings.html` | 播放器移动端整改：控制栏精简 + 右上角图标组（画中画/投屏/更多）+ 更多设置底部卡片弹层 + 字幕设置二级弹窗 + 启动封面白/黑适配 | 2026-08-15 |
| `demos/demo-player-speed-icon-clip.html` | 倍速图标 hover 动画「被裁剪/重影」根因演示：OLD=双图标交叉淡化（中途两半透明图标错位重叠）/ NEW=单图标缩放（消除重影） | 2026-08-15 |
| `demos/demo-history-abacus-timeline-2026-08-17.html` | 历史页左侧固定时间轴（算珠累加）：滚动时轴点逐颗累加、不消失，向上滚动逐步恢复，点击轴点/组标题跳转 | 2026-08-17 |
| `demos/demo-history-redesign-2026-08-18.html` | 历史页 UI 整改原型：融合 Tab（综合/视频/IPTV）+ 操作按钮（更多筛选/清空/批量）+ 统一横版卡 + 时间轴 + 动态列数 | 2026-08-18 |
| `demos/demo-collections-redesign-2026-08-18.html` | 收藏页 UI 整改原型（方案 B）：融合 Tab + 影视/直播分区（竖版海报墙 + 原项目 IPTV 卡）+ 视频卡角标重组（左下年份+类型、右下状态） | 2026-08-18 |
| `demos/demo-lazy-crossfade-specificity-2026-08-25.html` | LazyImage 封面淡入失效对比：OLD=reveal 已经把 pending 压成不透明（硬化切图）/ NEW=reveal 排除 base+pending、280ms 淡入恢复 | 2026-08-25 |
| `demos/demo-iptv-badge-layout-2026-09-02.html` | IPTV 卡片 Cover 角标布局：OLD=横向+红底容器 / NEW=纵向(LIVE 上、availability 下)+去容器红底 | 2026-09-02 |
| `demos/demo-history-card-2026-09-03.html` | 历史页记录卡整改终稿（已落地，多迭代同步）：竖版卡 上封面(16:9)+下 2 行文字（标题 + 类型/来源/集数/时间 meta 行）+ 无缝跑马灯带点间距、批量栏 sticky 钉底、桌面 min-width 1024 全局规则、**移动端 <480 切横版**（封面 124px 132:92 左侧 + 标题/类型/来源逐行 + 集数·时间同行两端对齐）、桌面 grid ≥1024 每档 +1 列（1024→4…3840→8）、补 768 档 3 列、IPTV LIVE/无法观看红绿角标、进度文本 text-xs；双 stage（桌面列数阶梯 + 375px iframe 窄屏横版） | 2026-09-03 |
| `demos/demo-hero-text-slide-padding-2026-09-03.html` | HeroBanner 移动端文本距图左/下过远修复：`.hero-banner__text-slide` padding(--space-xl 16px) 与 `.hero-banner__text` margin(--space-lg/md 12/8px) 双重叠加致距左 28/距下 24px；仅 ≤767px + app 副本双收至 8px + 6/3px → 左≈14/下≈11px，桌面不变；黄虚线标注测量框、双 stage 对比 | 2026-09-03 |
| `demos/demo-hero-logo-prefetch-2026-09-03.html` | HeroBanner 标题位 logo 加载时序（已落地 commit 01666e0→b21771f）：模拟 20 项列表 / RTT600ms 双轨道对比——现状「首屏串行前 6、第 7+ 滑到才发 /images → 先标题后跳 logo 闪变 + 卡」vs 方案「焦点±3 窗口预取 + 像素预热 + **空闲缓慢递进补齐（滑动静默 + ~1.8s 间隔）** → 滑到即 LOGO」；含请求计数/在飞状态，可翻页/快滑/重置 | 2026-09-03 |
| `demos/demo-history-ultrawide-cap-2026-09-04.html` | 历史页超宽视口(≥2560px)列数封顶 5 列落地验证：BEFORE(旧 7/8 列铺满单卡 360px+) vs AFTER(新 ≥2560 封顶 5 列 + 容器锁 2560→1600px/3440→1500px 居中，单卡 ~320/300px)，模拟 2560/3440 视口实时显示列数/容器宽/单卡宽/两侧留白 | 2026-09-04 |
| `demos/demo-clamp-coeff-fix-2026-09-04.html` | **第二期**流体 token COEFF 修复验证（**待用户拍板，未落地**）：复刻真实的 41 个基准流体 token 与真实组件结构（RecordCard 横版卡 / 按钮 / 输入框 / 分页圆点 / 标题），并排对比 **① 现状（COEFF 漏 100×，恒取 MIN）② 修复（恢复 375→768 流体、768+ 冻结 MAX）③ 修复 + `--ui-scale` 1.15**；可调视口宽(320–3840，拖动即可见「现状面板完全不动 / 修复面板随视口增长」)与设备(27"2560@100% / 24"1080p@100% / 14"1920@150% / 55"4K TV / 15"Retina@200%)，实时输出物理毫米与视角角分；含 41 行 token 逐项对照表（MIN/MAX/现状取值/修复取值/变化%/物理mm/视角′）与修复公式说明。**核心结论：修复后桌面端间距 +133%、栅格间距 +100%、按钮高 +76%——观感剧变，必须先 demo 验证** | 2026-09-04 |
| `demos/demo-fluid-regimes-2026-09-04.html` | **流体适配体系审计可视化**（配套 `design-docs/2026-09-04-流体适配体系审计报告.md`，**未落地**）：全项目 92 个流体 token 按锚点反推分为 **R1 失效 41（漏写 100×，恒 MIN）/ R2 无契约 46（PREF=MIN、K 随手填，@3840 完成度 24%~100% 离散）/ R3 真实契约 5（正确，不该动）**，外加 TV 视口映射 / @media 阶梯 / 大屏兜底 2× / 组件级硬编码 / 常量共 **8 种 regime**；92 条曲线按 regime 着色，可拖视口(320–3840)、切换归一化/绝对值、开关分类、鼠标悬停看单 token 详情；含 `--grid-gap` 1919→1920 断点跳变 +96.7% 特写、8 regime 卡片总览、全量 token 明细表（可排序/筛选，实时取值与完成度） | 2026-09-04 |
| `demos/demo-large-screen-uiscale-2026-09-04.html` | 大屏观感诊断与方案（**待用户拍板，未落地**）：① 根因量化——14 寸(dpr1.5/PPI157/45cm) 与 27 寸(dpr1/PPI109/70cm) 同 14px 文字的**视角**差 1.4–1.6×（系统缩放差异，非代码差异）；② 四方案实时对比 A 现状(锁 1600px+5 列) / B 只放大字号(比例崩坏复现) / C 全局等比缩放 `--ui-scale` / D 全局缩放+卡片封顶 `auto-fill`；滑块调 ui-scale(1–1.6)、视口宽(1280–3840)、内容区宽、列数、卡片封顶宽，实时输出单卡宽/字号/gap/列数/两侧留白 + 按 PPI·dpr·观看距离换算**物理毫米与视角角分**；③ 业界对照表(Netflix/YouTube/B站/爱奇艺/Plex 均为「卡片封顶+列数增加+字号固定+用户可调 UI 缩放」)；④ 五步落地路径与「分散」三来源定位(变量.css:404 gap 放大 / 409-425 列数 9·10 / History.css:339-353 内容区锁窄) | 2026-09-04 |
| `demos/demo-hero-bili-style-2026-09-05.html` | 首页 Hero B 站风改造（>1280：大 banner + 右侧 2×3 横版卡 + 换一换 + 圆点），v1→v3 多轮参数档位调节（**已拍板落地，见同日 HeroBili 提交**） | 2026-09-05 |
| `demos/demo-fluid-endpoints-2026-09-05.html` | 流体 token 端点六方案对比（base/d768/s09/s085/E1/E2，1440 密度选型），**拍板「E2 间距 + 字号微降」→ 演进为密度契约 v2/v2.1/v2.2 已落地**（commits ef2d902/d5e554b/6ab01ea） | 2026-09-05 |
| `demos/demo-category-quick-access-wide-2026-09-05.html` | CategoryQuickAccess >1280 整改方案对比（**待审阅，未落地**）：现状基线 + 三候选——A 频道文字导航条 + hover 全量 TMDB genre 双列下拉面板（B站/爱奇艺式，★推荐，行高 90→50px）/ B YouTube 式 pill chips 单行滚动 / C 现状圆卡 + hover 类型子菜单；token 与 v2.2 逐字对齐、真实 TMDB genre id（电影 19/剧集 16）、标注跳转 URL 与改动面 | 2026-09-05 |
