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
