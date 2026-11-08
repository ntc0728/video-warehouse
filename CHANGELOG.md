# Changelog

## [1.31.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.30.0...kinotv-v1.31.0) (2026-10-11)


### Features

* **player:** CMS 源面板过滤+并行探测追加、跨源顺延兜底、弹窗选集 epn/季集线回显（routePlayUrl 首帧最高优先） (`7683918`)
* **settings:** 错误日志收集与查看（localStorage 上限300/指纹去重、接口与全局捕获、个人设置独立组+时间轴弹窗） (`10e88ca`)


### Bug Fixes

* **deps:** 重生成合法 vite patch（pnpm patch-commit）并同步 pnpm-lock patchedDependencies——修复 Cloudflare CI frozen install 的 ERR_PNPM_LOCKFILE_CONFIG_MISMATCH/INVALID_PATCH (`d3abb92`)
* **lazy-image:** 图片加载兜底超时 8s 放宽至 10s（慢源防盗链挂起误判失败） (`41f5a68`)
* **ui:** 浅色主题纸白分层（页面底升白/占位骨架微冷灰阶/暗色冻结）+ 浮层按钮改内容右缘基准（--content-edge-gutter/--fab-breath/--shuffle-left 四版定稿）+ Detail 转圈轨道可见 + 选集下拉黑框抑制与尺寸收小 (`c1a7ed3`)
* **vite:** patch listen order — bind port before init, not after (`e5a1e20`)


### Performance Improvements

* **dev:** vite eager-pretransform 插件——首个请求触发后台并发预变换全部 src 模块，冷启动模块请求由波浪式 50-100ms/个降至 &lt;5ms (`3c2965e`)

## [1.30.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.29.0...kinotv-v1.30.0) (2026-10-10)


### Features

* **demo-e:** 分类 chip 面板方案 B — chip 行 + 子分类列表（CategoryQuickAccess 降级） (`ba989d8`)
* **demo-e:** 移动端报头重设计 + 趋势榜 5 条横图 + 删演示值提示 (`22fcb4e`)
* **detail:** 方案 A 海报对开布局落地（tab 居中资料区 + 两列等比等高） (`5fe9e54`)
* **home:** 今日热度趋势 topstrip 卡片化 + 简介 (`051506a`)
* **layout:** 源检测/代理配置接入 2200 封顶 + --page-pad-x 侧距 (`636042d`)
* **source-checker,proxy-setup:** 全面对齐监控台 demo + 标签整改 (`9a9c615`)
* **source-checker,proxy-setup:** 监控台改版落地真实页面 (`465fc7d`)
* **source-checker,proxy-setup:** 落地己·三栏+健康带布局并加单源重测 (`8fe5eb1`)
* **style:** 桌面端全站去卡片化 + 封面三态背景与页底色区分 (`cb2636b`)
* **style:** 页面级去卡片化第二批（Chart/Person/Detail/SourceChecker/SourceManager 条目） (`d2bdd96`)


### Bug Fixes

* **batch:** UI 细节整改六批收口——首页左栏清理/热度轮播公告/骨架镜像/Browse 收尾 (`ff5930f`)
* **demo-e:** 删公告带 / 搜索可点击按 SearchBox 链路 / 换一换对齐 HeroBili (`0ae3003`)
* **demo-e:** 方案C — FAB 外扩与 hover 修正 / 主体留白对齐项目 / 小视口·移动端适配 (`220ea83`)
* **demo-e:** 方案C 收口 — cqa 回滚静态链接 / FAB 恒显 / 继续观看单行 / 删 data-badge / 移动端 banner 图上文下 (`5be2e2e`)
* **demo-e:** 继续播放语义 / 骨架期横条禁点 / 搜索就地展开 / 去导航底线 / 封面四角标 (`b712017`)
* **history:** 卡片标题对齐全站口径（--text-sm/500/1.5），修「历史页标题大一号」 (`d5c6666`)
* **history:** 时间轴贴底测量修复单条数据假滚动条 (`7620c07`)
* **searchbox:** iOS web 点搜索框聚焦局部放大——mobile-web 字号抬回 16px (`78ce6e2`)
* **settings:** source-manager 面板去卡+条目保留卡片；设置页字号图标缩档 ×0.93；SET-050 改 web-first 断言 (`f59967d`)
* **settings:** 三源面板恢复卡片、设置项间距收紧、消子项标题黑点（含移动端）、hover 不再变背景 (`604611e`)
* **settings:** 个人页一键按钮方框再降至 29.5px 对齐 Select trigger；同步 testing.md 生成块 (`6643fad`)
* **settings:** 左栏字号/内边距豁免回原值，仅右侧内容区缩档；按钮族系数 0.93→0.8 (`d7b437a`)
* **settings:** 界面缩放换 Select 组件对齐 TMDB 下拉；个人设置行标题字号对齐；一键按钮方框缩至 40px (`26a9e1e`)
* **test:** SKEL-014 chip 期望 22 → 73 补同步 ff5930f 漏改 (`6bf6d6e`)
* **ui:** 首页/详情/播放/搜索零散修复批次（hero对齐与胶囊·detail veil与检测胶囊·play侧栏·搜索防抖动） (`c529f74`)


### Performance Improvements

* **vite:** dev 冷启动 early-HTML — document hold 2.1s/8.6s → ~1s (`4a49d44`)

## [1.29.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.28.0...kinotv-v1.29.0) (2026-09-24)


### Features

* **cqa:** 分类面板改锚定 popover（对齐触发 chip） (`c5f3b83`)
* **nav:** hero-bili 右卡与热度榜入口改 Link 支持右键新标签页 (`af4211d`)
* **nav:** 播放/详情入口改 Link 支持新开页签 + Player query 兜底 (`4ba1e7f`)
* **tmdb:** TMDB token 未配置全站门控 (`ddea17f`)


### Bug Fixes

* **browse:** 左栏骨架 chip 尺寸对齐真实 tab + 失败态去重试 (`8609147`)
* **cqa:** 面板顶角直角 + 热度值移入年份下方 (`84e7737`)
* **detail:** 骨架 tab 改方框 + info-card 对齐真实行高 (`ec10d68`)
* **lint:** 修 stylelint 属性顺序/0px 回退 + 同步 Android 版本至 1.28.0 (`d5bbc71`)
* **searchbox:** 顶栏搜索框聚焦黑框——排除规则抬特异性压过全局 focus outline (`fb64534`)
* **search:** 搜索框去全局粗焦点框 + 移动端 16px 字号排除 + 虚拟键盘 inset (`6e2b245`)

## [1.28.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.27.2...kinotv-v1.28.0) (2026-09-23)


### Features

* **browse:** 顶栏四方案 Demo + 左栏去滚动条 + 分类行壳 (`7918340`)
* **browse:** 顶栏方案A落地 — 排序tab改types分段 + 总数右对齐 (`9fc52f5`)
* **browse:** 首屏接口未返回时左栏/顶栏筛选项渲染骨架 (`3240ea4`)
* **cards:** 四卡封面角标/收藏/进度按 LazyImage 加载态 CSS 门控 (`dcb481c`)
* **detail:** 右栏基础信息同行布局 + 国家/发行末尾全宽 + 演员头像调小 (`71a2de0`)
* **detail:** 基础信息三轮 — 行距 gap 同源（grid 内外一致）+ 发行时间到日 (`f1bd689`)
* **detail:** 基础信息二轮 — 评分全宽 + 半宽自动 span + 行距同源 + 时长0不显示 (`9004040`)
* **detail:** 基础信息标题卡之间 gap 改为 var(--space-md) (`13ebb1d`)


### Bug Fixes

* **hero-bili:** banner 撑满行高 + 桌面文案收档 + 右卡角标间距收窄 (`822dd26`)
* **hero-bili:** CTA 纵向 padding 2xs→xs 修按钮压扁 (`49270fa`)

## [1.27.2](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.27.1...kinotv-v1.27.2) (2026-09-22)


### Bug Fixes

* **browse:** 修复清空再搜无结果词时空态不渲染 + E2E 断言漂移 (`0f7d1b2`)
* **changelog-collect:** 解析 front-matter 兼容 CRLF 并合并剩余 10 篇片段 (`70a6552`)
* **e2e:** 动态端口多进程不一致导致全量 CONNECTION_REFUSED (`1199f9e`)
* **testing:** 修复 run-tests.ps1 Home 段 grep 映射漂移 (`a0903c4`)
* **versioning:** 修复 sync-capacitor-version 断链引用 (`7d699c2`)

## [1.27.1](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.27.0...kinotv-v1.27.1) (2026-09-21)


### Bug Fixes

* **boot-splash:** 骨架 5 处与真实页错构修正 + 深色换一换白底 (`f02bf4d`)
* **browse:** 搜索态不再误命中 discover 缓存回显，store.search 正常触发 (`99de6b3`)
* **e2e:** 根治卡死——端口/进程安全红线 + hermetic 网络 + 5 分钟硬预算 (`14bfcfb`)

## [1.27.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.26.5...kinotv-v1.27.0) (2026-09-18)


### Features

* **githooks:** git 写操作后自动仓库健康自检 (`f5f3d67`)
* **githooks:** repo-health-check 增加 transport-probe 写前传输预检 (`09d564d`)
* **githooks:** 引用未落盘自愈补写 + 预检默认 HTTPS (`521e1dd`)

## [1.26.5](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.26.4...kinotv-v1.26.5) (2026-09-18)


### Bug Fixes

* **android:** 移除 MediaService 中类型不兼容的 MediaStyle 死代码 (`879763a`)

## [1.26.4](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.26.3...kinotv-v1.26.4) (2026-09-18)


### Bug Fixes

* **android:** MediaService 改用 framework MediaSession 修复 APK 构建 (`49eb39c`)

## [1.26.3](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.26.2...kinotv-v1.26.3) (2026-09-17)


### Bug Fixes

* **android:** 修复 MediaService 引用废弃 support.v4.media 致 APK 构建失败 (`81861c0`)

## [1.26.2](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.26.1...kinotv-v1.26.2) (2026-09-16)


### Bug Fixes

* **ci:** setup-android v4 显式 packages + 双 workflow 一致性补齐 (`a30002f`)
* 页面接口调用审查整改（刷新反馈 / 视口懒加载 / 竞态与并发） (`b4cfe83`)

## [1.26.1](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.26.0...kinotv-v1.26.1) (2026-09-16)


### Bug Fixes

* **ci:** bump android-actions/setup-android to v4 (`544f820`)

## [1.26.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.25.0...kinotv-v1.26.0) (2026-09-15)


### Features

* **design:** B1 色彩四档 + 状态色双档 + 角标统一口径 (`bfa295e`)
* **design:** B3 字号阶梯重构（取消段2 逆视口递减） (`65b0ada`)
* **design:** B5 TV 字号对齐 10-foot UI 基线 (`023b8e6`)
* **design:** B6 移动端触摸目标 / 视口安全区 / 缩放合规 (`efed48b`)
* **design:** B7 工程化收口（z-index 阶梯 / 设计护栏 / 一致性修复） (`bfcb237`)
* **skeleton:** 启动骨架全 shape 按视口填满首屏 + 页级骨架测量式续行 (`c51aab8`)
* **skeleton:** 骨架张数改为「列数 x 行数」派生 + 页级骨架延迟 150ms 淡入 (`c00d9d1`)


### Bug Fixes

* **a11y:** B2 恢复非 TV 键盘焦点环（WCAG 2.4.7 AA） (`feb9da3`)
* **boot-splash:** 历史页列数对齐 .history-grid 真源 + 骨架底色统一为 #f0f0f0 (`f78c0ce`)
* **build:** vite root 规范化到磁盘真实盘符大小写，修复 Bash 环境确定性构建失败 (`7251759`)
* **build:** 修复 @types/node 污染导致 setTimeout 类型不匹配（TS2322） (`00662e4`)
* **e2e:** 切换 Playwright 浏览器通道，修复会话内 E2E 完全不可执行 (`cdbea81`)

## [1.25.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.24.0...kinotv-v1.25.0) (2026-09-14)


### Features

* **browse:** 慢取页反馈 A′ + 取页出口收拢到逻辑分页层 (`29f7fbc`)


### Bug Fixes

* **browse:** 取页直连 store——慢网下搜索被初始 discover 覆盖；补 BROWSE-094/095 门控护栏 (`540840d`)
* **browse:** 左栏 chips 恒两列——auto-fill 随 rail 增宽多排列（1920 档 3 列/2560 档 4 列）改固定 2 列 (`c21674c`)
* **browse:** 慢网互斥渲染——空态/骨架/分页器不再同帧叠加；数据不足一页隐藏分页器 (`8f4c826`)
* **detail:** 剧照 +N 遮罩被 LazyImage 图片层压住（z-index 回归） (`b613405`)
* **home:** 首页骨架行补「卡片模块」外壳——骨架/真实切换不再纵向跳 27px (`4d0d176`)
* **layout:** 修复收藏/历史页空状态在 ≥1024 断点贴顶不居中 (`99d55fd`)
* **tooling:** changelog-collect 不再让残留片段永久阻断 push，并防重复合并 (`55f0461`)


### Performance Improvements

* **images:** Detail 剧照 / Person 头像改用 LazyImage，只加载进入视口的图片 (`d8bf86a`)

## [1.24.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.23.0...kinotv-v1.24.0) (2026-09-11)


### Features

* **browse,home:** 代并行会话入库——分页制/左栏骨架/首页视口骨架/FAB 软刷新等 + 本会话增补 (`bd9101c`)
* **browse:** 逻辑分页组装层——每页恒定 cols×5 行、总页数按每页条数折算 (`3882ab2`)
* **loading:** 五页专属视口自适应骨架替换统一 AppLoading + 首页≥2560 banner 收窄加高 (`3dd091f`)


### Bug Fixes

* **browse:** 切筛选空页/重复 key + 转圈同行 + 直链搜索恢复滚动追加 (`625140c`)
* **detail:** 加载骨架与顶栏间 ~166px 空隙——loading 宿主沿用菊花时代垂直居中，改顶对齐 (`f60f398`)


### Performance Improvements

* **drawer:** modal={false} 绕开 react-remove-scroll 的 document 级非 passive 监听 (`a8bd1de`)

## [1.23.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.22.1...kinotv-v1.23.0) (2026-09-10)


### Features

* **detail:** 上半部两栏（C1）+ 演员折叠裁切修复 + 剧照缩放控件 (`f561f56`)
* **home:** 大屏两栏布局（方案 C）+ 顶栏对齐 + 顶部过渡带 (`8fa3646`)
* **home:** 宽屏起点 1024 + 首页 rail 改「今日趋势」榜（落地并行会话在途工作） (`d3a5d69`)
* **home:** 宽屏起点改为 ≥1280 + 热度榜左栏 6 项调整 (`aaaf1b2`)
* **iptv:** 频道列表一/二级宽度改内容派生 + OSD 宽度单曲线 + OSD 内部布局 v1 (`450dd3d`)
* **person:** Hero 改左右布局（方案 C） (`fc99aaf`)


### Bug Fixes

* **badges:** 评分角标星标收到字号同档 + hero-bili 右栏角标收 10%；附 IPTV chrome 提案 demo (`3580e49`)
* **browse:** 筛选面板底部按钮改为 Drawer footer 插槽（真固定）+ 层级 token 化 + 滚动/模糊开销收敛 (`443a827`)
* **detail:** 两栏 banner 重叠修复（aspect-ratio 反算宽度）+ 右栏信息改一行两列；测试断言同步 (`610ed09`)
* **detail:** 剧照灯箱缩放控件改为主图正下方一行（三行流式布局），修移动端与缩略图条重叠 (`61895d3`)
* **detail:** 右栏分行+简介上提 / 剧照缩放迁入灯箱 / 线路数取值修复 / Person 返回键上移 (`f40f0b1`)
* **detail:** 右栏高度强制与 banner 一致 + 简介移回 info tab 原位 (`74a9718`)
* **home:** Hero banner 主图/缩略图加载失败改走公共 LazyImage 品牌兜底 (`3102aca`)
* **iptv:** mergeOrgWithLocal 按勾选状态决定是否替换本地流 (`a628d6c`)
* **iptv:** 修复 IPTV 播放逻辑 13 项问题 (`5c9d132`)
* **iptv:** 修复缓存过滤/更多台勾选/IP域名代理/iptv-org直连 4 项问题 (`2034933`)
* **iptv:** 收藏按钮去掉台标加载态门控 + 台标改 contain + 失败记忆 6h 复试 + 触屏常显兜底 (`b134cea`)
* **iptv:** 本地独有频道不进主干，iptv-org 失败显示空状态而非回退本地 (`a496fd2`)
* **player:** HLS 加载路径改为 hls.js 优先，修复原生分支 + zstd 响应必然失败 (`8d843f6`)
* **player:** 切源在 hls.js 初始化未落定时不得落回原生分支 (`54eb1ee`)
* **player:** 播放器作用域内覆写 primary 家族，修活跃态与填充按钮不可见（KNOWN-ISSUES [#14](https://github.com/ntc0728/video-warehouse/issues/14)） (`154bcb3`)
* **player:** 清晰度过滤非法档位/灰条跟随播放位置/暂停态 seek 落位/单集隐藏上下集/去掉播放暂停提示/移动端提示跟随播放器 (`45bea2b`)
* **ui:** 左栏视觉语言统一（方案 B）+ Browse 左栏紧凑化（B+C）+ 暗色选中态修复 (`91dbf0a`)


### Performance Improvements

* **home:** 移动端 banner 拖拽 rAF 合并 + 主图候选封顶 w780 + 标题阴影收窄；fix(player): 居中提示区分视口兜底锚定 (`fa90a60`)

## [1.22.1](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.22.0...kinotv-v1.22.1) (2026-09-09)


### Bug Fixes

* **player:** 三面板折叠动画重做 + CMS 源管理失败态治理 (`4dcfa7c`)

## [1.22.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.21.0...kinotv-v1.22.0) (2026-09-08)


### Features

* **iptv:** IPTV 页大改（iptv-org 主干化 + 左栏 rail）+ 播放器能力矩阵 P3/P4 + 断点 token 整改 (`71e2d4c`)
* **record:** 收藏/历史页桌面 rail 布局整改 + &lt;1024 面板只包 card (`020614a`)

## [1.21.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.20.0...kinotv-v1.21.0) (2026-09-07)


### Features

* **browse:** BR-C 二次定稿——类型分段移至结果区头部、面板去 sticky/240px/3 列网格、模式 tabs 通栏、直链搜索单列 (`f50c4c8`)
* **browse:** CMS 本地筛选面板（直链搜索不调接口纯前端过滤）+ --full 左对齐；demos V3/V4 入库 (`2665514`)
* **browse:** 直链搜索源状态双态重构——搜索中折叠 pill 右置结果数旁 + 结束态 demo 同款逐源 badge 卡片行 + 删悬浮弹层 + 未搜索不渲染 badges + 新增语义底色 token(success/warning/error-bg) (`f120c0b`)
* **browse:** 类型行升级为分类级 7 档（全部/电影/剧集/综艺/动漫/纪录片/排行榜），点击注入 CATEGORY_CONFIG 的 mediaType+默认genreIds (`ae3d502`)
* **history:** 记录卡网格 1280-&gt;5 列 / 1920-&gt;6 列独立分档 (`f197407`)
* **styles:** card-cols 梯度细化 5-6-7-8 + page-pad 渐进 32/48/80 (`76d8b09`)
* **styles:** 大屏 UI 断点起点 1280 → 1440 统一右移（播放页除外） (`8be907d`)
* **styles:** 大屏 ui-scale 连续化 + 卡片列数阈值对齐内容区封顶 2200 (`4cf1c84`)
* **ultrawide:** BR-C Browse 侧栏筛选 @≥1440（search 卡 display:contents + grid-areas 重排 + filter-bar 面板化） (`ad3dd66`)
* **ultrawide:** G1 content-shell 统一根级宽度（IPTV/Detail/Chart 接入 2200 壳 + Detail hero ≥2200 全出血 break-out） (`fad98cd`)
* **ultrawide:** G2-A --ui-scale 1.08 字号补偿档 @≥2560 (variables.css U-1) (`ee62d66`)
* **ultrawide:** G3 边框/文字对比度提档 @≥2560（U-2 浅色边框 token + U-3 tab-underline 未激活文字） (`020c89b`)
* **ultrawide:** P-A 播放器封顶 1920 · 16:9 @≥2560 (`99ef3ce`)


### Bug Fixes

* **breakpoint:** 修 CQA 上移扁平化 CSS 漏改(&gt;1440→&gt;1280, 与 JS 门控/HeroBili 对齐) + 清注释矛盾 + 修正命名误导注释 (`8b37442`)
* **breakpoint:** 回退 HeroBili + CQA 导航/mega/热度榜断点 1440 → 1280（useIsWideDesktop 回 1281 + 3 处 CSS + 调用方注释同步） (`b5658a1`)
* **browse:** --full 阈值改为 &gt;4 字宽（FilterBar.tsx）+ 规则移至 chip 系列末尾（Browse.css） (`bc67495`)
* **browse:** tabs 补分隔线/padding 对齐 demo + 新增对称柔影 token --shadow-soft 修选中态上下厚左右薄 + results 卡 align-self:stretch 占满剩余高度 (`0a051ba`)
* **card-cols:** 回退右移副作用——card-cols 保留 1280→6 / 1440→7，清理首页 4 处 &gt;1280 过期注释 (`388abaf`)
* **home:** 超宽屏 hero/骨架收口 2200 与内容同宽对齐；cqa 封面 150×85 + overlay 宽度基准修复记录 (`5496f46`)
* **ultrawide:** BR-C 间距修复（grid rows 1fr 吸收跨行剩余高度）+ 面板内选项去胶囊化改安静菜单样式 (`9f604eb`)

## [1.20.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.19.0...kinotv-v1.20.0) (2026-09-06)


### Features

* **chart:** 新增 /chart 热度榜页——排名/热度/无缝滚动/去重翻页 + 品牌兜底 demo 修正 (`ee9c725`)
* **detail:** 推荐网格对齐首页 --card-cols 等分——撤销 ≥1280 auto-fill 290px 固定轨道，gap 并入全站 --hero-side-gap 统一 (`8a00409`)
* **fluid:** comp-input-height 桌面契约 40-&gt;48（旧 MAX 58 为 R2 遗留，桌面渲染过大） (`0f7a8d3`)
* **fluid:** 内容区契约改 min(100%,2200px)——桌面满屏仅超宽封顶（用户拍板） (`1ce4cef`)
* **fluid:** 阶段A 三段式token重定义+TV漏斗补钉+gap跳变删除 (`868f4cb`)
* **fluid:** 阶段B R7组件clamp内rem转px防二次流动+lint豁免 (`c89fd74`)
* **history:** 超宽视口(&gt;=2560px)列数封顶 5 列 + 容器锁宽 (2560-&gt;1600px/3440-&gt;1500px) (`8f2249c`)
* **home:** 「首页」chip 其他页特殊处理——收起面板并跳转回首页 (`0ec305f`)
* **home:** &gt;1280 全站去卡片化 + 卡片间距统一 --hero-side-gap + 分类入口上移 (`d231752`)
* **home:** CategoryQuickAccess &gt;1280 方案 A2——频道导航+热门分类面板（真实 TMDB 数据） (`1a1f3bc`)
* **home:** cqa-nav 融合顶栏 + hover 面板语义 + 跨页常驻导航 (`3aefc66`)
* **home:** Hero B 站风落地（HeroBili &gt;1280 分支）+ 全局 --page-pad-x 三档 padding (`5d4ee0e`)
* **home:** 宽屏面板客户端分页 9/页 + 末页查看更多跳 browse (`a45e950`)
* **home:** 融合方案甲——分类导航带并入 HeroBili 卡、chip overlay 面板、热度榜常驻行 (`13cc3c6`)
* **home:** 面板全局挂载——chips 全端统一 hover 语义（跨页 mega-menu） (`0762fe6`)
* **home:** 面板分页（右下角+末页查看更多跳browse）+ hotgrid 竖向排列 (`0e700e1`)
* **home:** 首页卡片&gt;768每档列数-1 + 行内gap改--space-md（含骨架/宽度公式联动） (`56479cb`)
* **large-screen:** 阶段C 大屏机制落地-内容区2200/卡片封顶auto-fill/列数重算/自动档默认1.0/手动档uiScale (`40864e9`)
* **record-shell:** 顶栏方案 C+E——状态 chips 常驻+排序弹层+清空降级+IPTV 隐藏无效筛选 (`a74e83e`)
* **settings:** 桌面端改方案 B——topbar 移左栏竖排导航，内容满宽自适应 (`7b8cadc`)
* **settings:** 桌面端设置项下滑加回到顶部按钮（复用 BackToTopButton） (`f0fecdd`)
* **styles:** 密度契约 v2.1——段2 字号改递减曲线，1440 命中 E2/B站锚点 (`d5e554b`)
* **styles:** 密度契约 v2.2——控件族段2 按 ×0.8835 同字号比例递减校准 (`6ab01ea`)
* **styles:** 流体 token 密度契约 v2——E2 间距端点 + 字号段2 微降 (`ef2d902`)


### Bug Fixes

* **detail:** hero 海报恢复 868f4cb 前旧尺寸曲线 clamp(8rem,2rem+8vw,22rem)——三段式重定义误将 277→352px 抬高约 2 倍 (`7b58305`)
* **fluid:** 核查修正 E1 text-base 段2 跳变 + E2a R6 回退 + E3 注释 + E4 tv 前缀 (`b3de5f8`)
* **header:** 密度契约 v2 补瑕——桌面顶栏右侧图标间距与选中态胶囊回归校准 (`bc0223c`)
* **header:** 顶栏右侧间距三调——胶囊 padding-x md→sm（视觉 ≈18px）、right gap →xs (`43afa2f`)
* **header:** 顶栏右侧间距二调——gap 回 2xs 恢复「小 gap+大内边距」组合，right 区取 xs-plus (`3e927aa`)
* **home:** browse 页 chips 双向关联——选中态跟随 URL 分类、重复点击不压栈 (`94f506c`)
* **home:** CategoryQuickAccessPanel hooks 顺序崩溃——goBrowseMore useCallback 移到提前 return 之前 (`fc902ea`)
* **home:** HeroBili 六项验收修复——banner池6张/右卡横图/圆点归位/按钮缩小/跑马灯时机 (`784fc49`)
* **home:** HeroBili 换一换整批替换+池首补位 / hover 浅灰 / 继续观看行公式重算 (`5250ea3`)
* **home:** 分类面板切 chip 高度恒定——子分类单行滚动、加载态定高、head 不折行、panel min-height 兜底 (`e4a4cc5`)
* **home:** 分类面板数据统一按 popularity 倒序——/trending 趋势序不再直出 (`1d3e58b`)
* **home:** 继续观看行 768-1279 档 2-&gt;3 列（用户反馈稀疏回调） (`0e1d764`)
* **home:** 非首页 chips 与页面完全解耦——点分类不改 URL、无高亮 (`0603303`)
* **iptv:** ≥1440 列数恒 5 + 收藏按钮先于卡片出场修复——animate-fade-in-up 上移 wrap (`aabee95`)
* **record-grid:** 历史网格单列塌缩修复 + 收藏/Browse 网格回归 --card-cols 等分 (`f963406`)
* **record-shell:** 清空按钮响应式降级——&gt;1280 直显、768-1280 收进「⋯」（断点与间距块同款） (`d3e2da1`)
* **ui:** category-quick-access__inner flex均分改grid紧凑居中；还原icon-wrap误改 (`a232097`)
* **ui:** cqa 子分类chip选中hover掉底色+Chart满高/切tab遮罩胶囊+hero卡边框与封面品牌兜底 (`94e25c4`)
* **ui:** 首页验收反馈三修——导航搜索框高度/热搜徽标/内容区曲线移至段2 (`03f5f37`)

## [1.19.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.18.0...kinotv-v1.19.0) (2026-09-03)


### Features

* **history:** 记录卡整改收尾——桌面 grid ≥1024 每档 +1 列、进度字号调档、&lt;480 横版、IPTV 可看性角标 (`8f1115a`)


### Bug Fixes

* **history:** grid 断点补 768 档——768–1023 三列（用户抓漏） (`0b7adaf`)
* **home:** 移动端 hero 文本距图左/下过远——双收 slide padding 与 text margin (`b2ada48`)
* **iptv/history:** 频道可用性角标单源化 + 历史页 iptv 卡恒显 LIVE 修复 (`ad36d79`)


### Performance Improvements

* **home:** hero logo 改窗口预取+空闲补齐, 消除滑动期请求与闪变 (`01666e0`)
* **home:** 空闲补齐改缓慢递进——滑动静默+固定间隔, 不再密集拉取剩余 logo (`b21771f`)

## [1.18.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.17.0...kinotv-v1.18.0) (2026-09-02)


### Features

* **iptv-store:** 补跨页签实时同步（storage 事件 → rehydrate + isFavorite 重派生） (`f012aae`)
* **player:** 实施 HLS 缓冲优化与 MPEGTS 点播/重连/预检测 (`2eeaa16`)
* **settings-store:** 设置静态配置跨页签实时同步（storage 事件白名单受控合并） (`801c179`)
* **user-store:** 跨页签内存快照实时同步——BroadcastChannel 广播 + 静默 reload (`7ec0223`)
* 删除 IPTV 代理调试日志 + 可用性角标下移 + 历史/收藏 CMS 源未启用拦截 (`691807e`)


### Bug Fixes

* **db:** 跨页签 IDB 一致性——收藏主键收敛 + 历史 flush 守卫 + openDB 单飞与阻塞让路 (`178387b`)
* **player+proxy:** CMS wd 双重编码 + 后台返回播放冻结/意外暂停 (`4eb252b`)
* **player:** VOD 源不可用自动故障转移（同源切线路→跨源重搜） (`1f86d02`)
* **player:** 侧栏骨架 variant 不再随 TMDB 异步数据突变 (`8d188de`)
* **player:** 侧栏骨架行数与真实面板对齐 (`999a5d6`)
* **player:** 桌面播放页高度 100dvh → calc(100dvh - header-height) (`eabf6d1`)
* **player:** 桌面端播放页预留滚动条槽位，消除骨架到详情的横向跳动 (`ae295ab`)
* **player:** 浏览器窗口失焦（切其他软件）返回后画面冻结/误报错误 (`925f3f2`)
* **player:** 选季面板骨架行数 3→6，与 CMS 面板 2 行对齐调整 (`ae04bf5`)
* **user-store:** reload 合并脏集合，防广播回退本页节流窗口内的进度 (`8b9a53f`)

## [1.17.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.16.0...kinotv-v1.17.0) (2026-09-01)


### Features

* **player:** 新增移动端横屏/全屏/画中画多端兼容整改 demo (`ecf6fee`)
* **player:** 桌面端面板高度动态调整 + 播放器最小高度 (`577d5cf`)


### Bug Fixes

* **player:** 8 项 UI 整改 + 播放器父级不脱标 + pipController 错误文案可读 (`91c9d3a`)
* **player:** usePlayerCore 补齐 5 处 sonner → playerToast（全屏可达路径清零） (`db39c60`)
* **player:** 全屏可达提示统一走 playerToast，center-toast 滚出视口夹取兜底 (`3070aa4`)
* **player:** 提示避让 header + 抽屉改子项即关 + 非桌面全屏默认横屏 (`4e9ba96`)
* **player:** 更多设置抽屉 + 字幕弹窗 portal 进播放器容器（全屏不再被盖） (`0614b36`)
* **player:** 浮层 portal 目标穷尽修复——全屏下菜单/弹窗同样被盖 (`f260bca`)
* **player:** 续播卡片避让 header + 全屏返回仅退全屏 + 全屏提示可visible修复 (`67622d3`)
* **playwright:** 修复 player.spec.ts 沙箱 flake + 清理根目录调试脚本 (`d48d637`)
* **UniversalPlayer:** 全屏控制栏改造 + 右侧更多设置抽屉 + 竖版弹窗占满宽度 (`6c0a1e8`)
* **UniversalPlayer:** 自测整改 —— 全屏整改仅限真机移动端 + 抽屉对齐右键菜单 + 交互细节 (`f02eb23`)
* **UniversalPlayer:** 落地画中画防卡死 + 全屏三级降级策略 (`cc8d45b`)
* 恢复 5.1-5.5 丢失的改动（hover/骨架/CMS tab/meta/收藏动画） (`f67e94d`)

## [1.16.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.15.0...kinotv-v1.16.0) (2026-08-31)


### Features

* **player:** P0-1 移动端横向滑动 seek 手势 (`3d880fd`)
* **player:** P0-2/P0-3/P1-11 进度条无障碍 + 重渲染治理 + 缓冲拖拽钳制 (`9fdb579`)
* **player:** 后台听视频 MediaSession + 冻结修复 + CMS自适应 + Switch改完即关 + 画面比例重构 (`631c802`)
* **player:** 后台听视频 P2 iOS检测 + P3 Android原生前台媒体服务 (`bd6fbb6`)
* **player:** 批次4 P1快捷键重写/单击即时响应/清晰度记忆/字幕track渲染/定时器清理 (`4d93c2d`)
* **player:** 批次5 P1-3错误文案透传/P1-4续播卡片/P1-10进度展示解耦/P2-6安全区/P2-7移动端toast上移 (`bc35506`)
* **player:** 批次6 P1-6桌面右键菜单/P2-3控制栏对比度/P2-4移动端触摸目标 (`0fe34dd`)
* **player:** 播放器整改交互 Demo（/player-lab 路由） (`80d37b3`)


### Bug Fixes

* **player:** iOS后台提示仅真实设备显示(三层检测) + 删除移动端更多设置音量调节项 (`8c44db9`)
* **player:** Issue2 冻结解冻重写为分级策略（translateZ 方案实测无效） (`da44c86`)
* **player:** P0 止血——缓冲中可暂停、手势音量初值/滚动/UI 区三修复 (P0-7/4/5/6) (`d6371e1`)
* **player:** 修正更多设置弹窗未贴在图标正上方 (`91d8a1c`)
* **player:** 居中提示退出闪烁(单元素切换类名) + 清理reviveFrozenVideo重复定义 (`2d97962`)
* **player:** 弹窗/右键菜单/更多设置 UI 微调 (`1f6e30f`)
* **player:** 弹窗关闭不影响提示语(去重) + 更多弹窗移动一次根因修复(offsetWidth) + 补全reviveFrozenVideo (`7f2da1b`)
* **player:** 截图提示居中靠上并避让移动端header + 修复更多弹窗悬浮跳变 (`192edd8`)
* **player:** 截图提示改为播放器内屏幕居中 toast (`345421a`)
* **player:** 截图提示改为播放器容器居中 + 更多弹窗居中于图标 (`ce000c6`)
* **player:** 更多设置弹窗容器内定位 + 右键菜单文本尺寸 (`93d35ff`)
* **player:** 自测修复 Issue1/2/3 桌面手势条/切后台冻结/缓冲中进度条 (`95c36a1`)
* **player:** 自测修复 Issue4 右键菜单改版/色彩调整/音效调节 (`0d8390f`)

## [1.15.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.14.1...kinotv-v1.15.0) (2026-08-30)


### Features

* **player/settings:** 入场骨架+小电视加载态 / 设置移动端子页过渡方案1 (`c6a55b6`)
* **pull-to-refresh:** 桌面端禁止下拉刷新浮层 (`cb9f0d3`)
* **settings:** 桌面端 topbar 改头部条样式 + 进入过渡对齐卡片页 (`4c96126`)
* **transition:** 统一页面进入过渡到容器层并适配播放页 (`3b99cd6`)


### Bug Fixes

* **player:** 移除覆盖播放器的全屏 AppLoading，入场直接渲染完整布局 (`ecc197c`)
* **pull-to-refresh:** settings 变体文本在浅色主题下白字压白底不可见 (`2e0ca40`)
* **tv-loader:** 修正黑场小电视五官不可见 + 消除裸电视加载态 (`bfdaacf`)

## [1.14.1](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.14.0...kinotv-v1.14.1) (2026-08-29)


### Bug Fixes

* **e2e:** 修复 23 个失败用例并补全真实断言 (`297e576`)
* **home:** 修复 HomePage hook 在提前 return 后调用导致整页崩溃 (`00284cf`)

## [1.14.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.13.0...kinotv-v1.14.0) (2026-08-28)


### Features

* 本地 PullToRefresh 黑白配色+方案C光晕、设备调试修复、免责声明左对齐及全站样式/组件重构 (`f46c36b`)

## [1.13.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.12.0...kinotv-v1.13.0) (2026-08-27)


### Features

* 设置页/首页/Banner/历史页一系列体验修复与样式重构 (`8e156be`)


### Bug Fixes

* **hero-banner:** 16:9 几何改 aspect-ratio 驱动 + 切分类白隙修复 (`5ed1cc1`)
* **hero-banner:** banner/缩略图无缝拼接 + 外框圆角重排 + 首/尾缩略图常显标题 + 切换旧图闪现修复 (`80a95a4`)
* **HeroBanner:** 文本跟随 banner 滑动、回弹隐藏下一张文本、切换改为垂直 6px 位移 (`dd6b05e`)
* **HeroBanner:** 静止入场位移 16px→6px，避免文字压到图片外(容器)再浮入 (`557b896`)
* 快速连续切换分类时缩略图/卡片封面闪烁修复 (`151c230`)

## [1.12.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.11.0...kinotv-v1.12.0) (2026-08-23)


### Features

* **home:** 卡片封面滚动触发加载 + LazyImage placeholder 露白修复 (`ef00395`)


### Bug Fixes

* banner在768-1023px断点退回16:9，清理app端冗余height/aspect-ratio副本 (`d0a464f`)
* banner缩略图间距改2px，卡片底部与分类区保持space-sm间隔 (`096f702`)
* container-type size 移到卡片层，缩略图列宽正确锚定 banner 高度 (`5877281`)
* HeroBanner 最小高度改 40rem，确保 banner/缩略图真实 16:9 (`1b89a66`)
* lazy-image placeholder 加载时不露白（transition:none + solid背景兜底） (`f859046`)
* 用 JS 实测 banner 高度注入 --hero-banner-h，彻底去掉 container-type 依赖 (`0446076`)

## [1.11.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.10.0...kinotv-v1.11.0) (2026-08-20)


### Features

* apply source-section spacing to all settings sections (`4e6afd2`)
* **home:** 进入过渡覆盖层 + HeroBanner 初始淡入延迟 + VideoCard skipAnimations (`ad7e511`)


### Bug Fixes

* **home:** 分类切换过渡与滚动复位时序重做——单树渲染+卡片交叉淡入+内容先切后复位 (`6b6a9ce`)
* settings personal section titles moved outside cards with consistent border/hover styling (`ae342c8`)
* settings-profile-card border now visible on all screen sizes (`c25ff6e`)
* **ui:** 角标配色统一+收藏卡移动端布局+首页年份+暗色chip文字可读性+六项零散UI修复（进度条/季卡海报/bio展开/设置深链闪烁/停用源延迟/设置标题图标） (`232bfa8`)

## [1.10.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.9.0...kinotv-v1.10.0) (2026-08-20)


### Features

* **cards:** 卡片四项细节调整——角标统一/历史卡动画/IPTV封面失败样式/LIVE角标 (`6fe9f7d`)
* **collections:** 收藏页融合 Tab + 分区整改（方案 B）+ VideoCard 角标重组 (`95573d4`)


### Bug Fixes

* **collections:** 「更多筛选」排序去掉下拉框，恒显示 chips，空间不足自动换行 (`853e482`)
* **player:** 播放器交互修复计划落地（C1-C5 冲突 · G1-G10 缺口 · R1-R6 冗余） (`5d18a2e`)
* **scrollbar:** OverlayScrollbar thumb 直接 DOM 写入，消除主线程繁忙时「滚动条卡顶不跟手」 (`1a89705`)
* **scrollbar:** 彻底移除 rAF 节流——监听器直接调用 updateThumb，根治滚动条卡顶 (`e970b65`)

## [1.9.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.8.0...kinotv-v1.9.0) (2026-08-17)


### Features

* **cast:** Android 原生 DLNA 投屏模块（SSDP 发现 + UPnP AVTransport 推送） (`115be2f`)
* **cast:** Web 端投屏分端实现 - iOS 隐藏按钮，安卓 Web 走 Google Cast SDK (`b1e27fb`)
* **history:** 历史页桌面端左侧算珠时间轴 + StickyHeader 清理 (`0727c42`)


### Bug Fixes

* **home:** Keep-Alive 首页切走再切回 banner 不闪烁 (`4b9bfa1`)
* **home:** 解除分类切换时 banner/缩略图/video card 三者绑定 (`8ac0dca`)
* **player:** buffering/loading logic conflicts fix (13 items per review) (`8a1c213`)


### Performance Improvements

* **cast:** 投屏按需加载打包 + 部署性能优化 (`270a886`)

## [1.8.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.6...kinotv-v1.8.0) (2026-08-15)


### Features

* **player:** 播放器移动端设置——控制栏精简 + 右上角操作组（画中画/投屏/更多）+ 底部卡片弹层 + 字幕二级弹窗 + 投屏服务 (`cf5e65a`)


### Bug Fixes

* **home:** ???????????????????????? (`875e651`)
* **home:** 分类切换快速完成（移除预加载阻塞门控）+ 彻底删除 CardCoverLoading 浅白遮罩 (`2e64db1`)
* **home:** 无缓存时分类切换跳过旧图滞留动画（直接渲染新层，骨架占位自然加载） (`c6fafe0`)
* **player:** data-mobile-layout 全局标记驱动播放器 toast 定位（App 恒移动/手机桌面模式不再按视口误判桌面端）+ IPTV 全屏按钮右下角 (`d87ff21`)
* **player:** 修复窄窗桌面 toast 叠在头部图标上——CSS 锚点规则不再受 data-mobile-layout 拦截 (`1da8e91`)
* **player:** 区分移动端布局与真实移动设备（toast 居中仅手机）+ 弹窗全宽 (`15ba25e`)
* **player:** 播放页桌面端修复——vodParser 源 id 去重与 isDefault 全局化、CMS 面板空初始化、play 错误分类、进度恢复竞态守卫 (`5a8392f`)
* **player:** 桌面 toast 锚定头部右控件（data-player-header-controls）+ 移动端布局判定用例（4.12 M09/M10） (`fb23144`)
* **player:** 补充 data-player-header-controls 全局标记（桌面 toast 锚定头部右控件） (`e180e24`)

## [1.7.6](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.5...kinotv-v1.7.6) (2026-08-14)


### Bug Fixes

* **ci:** 包管理器迁移 npm→pnpm 并适配构建链路（workflows/scripts 换 pnpm 语法、sharp 常驻、新增 pnpm-lock.yaml/.npmrc） (`b19ecf9`)

## [1.7.5](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.4...kinotv-v1.7.5) (2026-08-14)


### Bug Fixes

* **ci:** build-apk 门控改为 release PR merge commit 判定（release_created 恒 false 与 API 探测竞态均不可靠，零探测终版） (`0a43a73`)

## [1.7.4](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.3...kinotv-v1.7.4) (2026-08-14)


### Bug Fixes

* **ci:** release 门控改用 API 匹配 target_commitish==GITHUB_SHA（release-please-action 运行后工作区 HEAD 漂移，读 package.json 不可靠） (`76ec1c7`)

## [1.7.3](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.2...kinotv-v1.7.3) (2026-08-14)


### Bug Fixes

* **ci:** release-please.yml 门控改为 release 存在性探测（release_created 恒跳过根因修复）+ 双 workflow 版本号提取兼容 kinotv-v 前缀 (`c9373e7`)

## [1.7.2](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.1...kinotv-v1.7.2) (2026-08-14)


### Bug Fixes

* **ci:** APK 构建恢复 release 事件主通道 + 修复手动补传 tag 前缀 (`7b54c7d`)

## [1.7.1](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.0...kinotv-v1.7.1) (2026-08-13)


### Bug Fixes

* **ci:** APK 构建移入 release-please 工作流根治 Release 缺 assets (`70e9953`)
* **hero-banner:** 分类切换主图旧图垫底→新图就绪淡入，消除硬切 (`3474500`)
* **home:** 分类切换交叉淡出/淡入过渡，消除直白瞬间替换 (`0f1e40f`)
* **home:** 分类切换内容无透明空窗 + 修复轮播回归 + 缩略图交叉淡入 (`455c8ce`)
* **home:** 分类切换改渲染层 SWR 根治白屏闪烁 (`0154816`)
* **settings:** tab 常驻挂载消除切 tab 抖动 + OverlayScrollbar 补内容变化监听 (`4e08cb6`)
* **settings:** 关于页免责声明贴底 + 点击项左右平移改文本缩放 (`d69dbd7`)


### Performance Improvements

* 页面走读问题整改（源JSON按需加载/分类请求取消与去重/封面失败重试/IP层动画统一/收藏历史页卡顿优化） (`8748f30`)

## [1.7.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.6.0...kinotv-v1.7.0) (2026-08-12)


### Features

* **iptv:** app 端播放页自动横屏 + 隐藏全屏按钮 (`62cd8a5`)
* **nav:** 桌面侧边栏底部新增设置入口+版本号，顶栏设置项迁出 (`ff24bcb`)
* **nav:** 桌面顶栏最右侧新增个人头像+用户名入口 (`7104d94`)
* **nav:** 移动 web 顶栏新增个人头像+用户名入口，抽屉设置项移到底部 (`cfc3a51`)
* **settings:** 移动端子页增加进入/退出过渡动画 (`99b9fbd`)
* **skin:** 皮肤字体自托管（public/fonts/），替换不可达的 Google gstatic (`9b7bfc3`)
* **ui:** 顶栏/侧边栏/设置页细节统一（hover-scale 全局方法等 4 项） (`c67aab9`)


### Bug Fixes

* **base:** 字体基准显式化 14px + 移除 App 端无效 root 缩放 (`5da795f`)
* **boot:** 消除冷启动白屏 + app 端汉堡隐藏 + 布局判断统一移动 (`345690a`)
* **browse:** 分类导航进入清空搜索词 + 立即刷新，消除旧数据闪现 (`d78ef85`)
* **cover:** 封面占位品牌化（加载中+失败兜底主题自适应） (`82f7d7d`)
* **home:** 实施时发现 50vh 移动端规则冲突，取消以让 token flex:1 撑满 (`d5c4b3f`)
* **iptv/settings/ci:** 源接口走IPTV代理+源管理拖拽+卡片动画+Android CI 补SDK (`dd7e718`)
* **iptv/settings/epg:** 4 项自测问题修复 (`e0ee1a3`)
* **iptv:** 频道封面失败占位统一为 KinoTV fallback 图（与 VideoCard 一致） (`e854c55`)
* **layout:** app 端横屏恒为移动布局（CSS 断点双前缀） (`174433a`)
* **records:** 收藏/历史页容器改为数据就绪后挂载，IPTV tab 切换动画正常播放 (`07f0d13`)
* **settings/iptv:** 设置页返回按钮加文字 + IPTV 横向 cover 失败占位特殊处理 (`52cad60`)
* **typography:** 全局字体栈显式声明中文字体 + 移除无条件 Google Fonts [@import](https://github.com/import) (`e820eab`)
* **ui:** source-modal 移动端改为底部滑出全宽，消除两侧间隙 (`847ce7d`)
* **ui:** VideoCard 加载占位统一纯色背景 + HeroBanner 缩略图无间隙 (`1406613`)
* **ui:** 分类卡片 hover 上移/缩放仅限精指针设备，触摸端不再越界 (`f225262`)
* **ui:** 桌面端隐藏 category-quick-access + 全端移除选中高亮 (`e00fba1`)
* **ui:** 设置页padding对齐全局 + TabBar间距+安全区 + 免责声明贴底 (`a038443`)

## [1.6.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.5.0...kinotv-v1.6.0) (2026-08-11)


### Features

* **iptv:** 台标三级回退优化（库清单预判+成败持久化+字母占位）与 sources 并发去重 (`81c55bd`)
* **iptv:** 新增 3 个国内稳定源 + catchup/UA 属性解析（预留默认关闭） (`720df28`)


### Bug Fixes

* **iptv:** EPG/IPTV 服务重构与页面清理，修复加载慢与泄漏 (`ebb4f8a`)
* **iptv:** 修复台标串台——成功记忆仅对当前频道候选链内排序 (`5f15dd2`)
* IPTV台标占位重叠/移动端搜索框自适应/Android启动页与APK发布链 (`b4bc035`)
* **settings:** 离开设置页时卸载移动端子页 portal，修复从子页跳转 source-checker/proxy-setup 被遮挡问题 (`9fef6c3`)
* 源增量合并/子页顶栏/占位封面/首页后台刷新 4 项优化 (`549ba18`)

## [1.5.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.4.0...kinotv-v1.5.0) (2026-08-10)


### Features

* **browse:** 移动端筛选区改两行命令栏 + 全屏筛选面板 (`c7ebaca`)
* **settings:** 移动端设置页采用 iOS 分组圆角卡 + 子页全屏顶栏替代导航栏 + 双行卡对齐桌面 (`9331b05`)


### Bug Fixes

* **browse:** bmb-presets 与弹窗布局精确对齐 S3 HTML 示例（无偏差） (`0108703`)
* **browse:** 筛选面板完成制应用 + 命令栏/弹窗细节对齐 (`151f61f`)
* **browse:** 筛选面板对齐 S3 示例（删预设卡/返回箭头顶栏/pgIn 动画/chip 尺寸） (`98f7603`)
* **settings:** 子页用 createPortal 挂到 body 脱离 contain:layout (`7fc13e2`)
* **settings:** 子页顶栏对齐导航栏高度 + 移除淡入动画 + 个人设置/源管理卡片化对齐桌面 (`805aa73`)
* **ui:** 弹窗按钮胶囊化修复 + ProfileEditModal 按钮补宽 (`da1749d`)


### Performance Improvements

* **dev:** dev 模式跳过 preloadAllRoutes 消除白屏 (`2586c45`)
* **dev:** vite server.warmup 预热核心模块，缓解首次打开慢 (`9fe8f57`)

## [1.4.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.3.0...kinotv-v1.4.0) (2026-08-09)


### Features

* **settings:** 新增状态标签 SettingsStatusTag + List 双行布局 + 设置项 description 补全 (`2f9223b`)


### Bug Fixes

* **settings:** desc 移入 header 与按钮两端对齐，单行截断+title 显示全文 (`72c684e`)
* **settings:** title 单独拆出卡片 + header/desc/badge 移入卡片 + profile-card 左右对齐 (`665e5c0`)
* **settings:** TMDB Token 按需解密 + 源折叠面板底部空隙 + 卡片化 (`95ec6f3`)
* **settings:** 个人设置 section 去 padding，标题上下间距对齐其他 tab (`9c19409`)
* **settings:** 恢复个人设置 section 左右 12px 缩进 (`fa933d1`)
* **settings:** 标题单独移出卡片 + source-manager 加 padding + 个人设置大卡片化 (`d08dccd`)
* **settings:** 桌面端设置项之间去分割线 + tabbar 文本图标稍大 (`fc426ac`)
* **source-manager:** toolbar 与 list 间距 8px，折叠时无残留 (`1744ba9`)
* **source-manager:** 折叠时 gap 与 body 收缩同步过渡，消除按钮移动和收起延迟 (`b176a3a`)

## [1.3.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.2.0...kinotv-v1.3.0) (2026-08-07)


### Features

* 三源统一管理收敛 + IPTV 检测按组隔离 + proxy-setup (`0b1e20a`)


### Bug Fixes

* **IPTV:** GroupPicker 折叠高度改用相对容器偏移计算 (`ba5cad4`)


### Reverts

* **ci:** 删除多余的 Pages 部署 workflow（GitHub 集成已自动部署） (`24e567d`)

## [1.2.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.1.0...kinotv-v1.2.0) (2026-08-06)


### Features

* CMS按钮6列均分 + 拖拽进度条提示 + Hero骨架位置修正 + 免责声明 (`978c243`)
* **detail:** 海报图 CMS 优先并支持 TMDB 失败兜底 (`b88f9e9`)
* **iptv:** C1 仅含音频时自动切线路（每频道名仅切 1 次防循环） (`f8d2885`)
* **iptv:** D1 裸流降级识别（fail-and-retry，零额外请求） (`3fcaafb`)
* **iptv:** 代理规则内置直连白名单默认值（降低 worker 请求量） (`cbe4a9a`)
* **iptv:** 播放器操作提示独立右上角 + TV 端 IPTV 交互 (`79f276f`)
* **iptv:** 类型探测增强 + worker CORS 智能路由（分片直连省请求量） (`ac8bd21`)
* **player:** IPTV 播放链路增强 - 视频轨检测 + FLV/TS 兜底 + 自动切代理 (`38f1c7a`)
* **player:** toast 全局系统整改 + 播放器交互修复 (`aad7911`)
* **player:** 提示统一右上角 + 预加载①点播首分片预取 (`12b9db4`)
* **player:** 预加载②剧集连播预加载（方案C，仅Wi-Fi） (`468bdc4`)
* **searchbox:** 搜索框输入词实时搜索建议 (`ad35f9c`)
* **ui:** 页面体验修复与侧边栏折叠重构 (`ea97ca9`)
* 免责声明样式优化 + 移动端头像进入个人设置 (`c0d8876`)
* 播放页交互优化 + 首页继续观看行 2/3/5 + 测试 fixtures 纳入版本控制 (`a4a3732`)
* 继续观看行骨架与响应式 + 非手机web小视口箭头 + 骨架占位精细化 (`38df989`)
* 设置/首页 UI 优化 7 项 (`76796c2`)


### Bug Fixes

* **browse:** 修复移动端断言与 loading 捕获（BROWSE-075/076/077） (`6ba10f6`)
* **home,iptv:** 首页新增「继续观看」区块 + IPTV OSD 空回调按钮清除 (`efb85e2`)
* **home:** token 提示区高度链逐层撑满，主提示真居中、免责声明贴底 (`7231dec`)
* **home:** 移动端 token 提示上移 + 骨架缩略图叠加暗底镜像真实加载态 (`7f252c6`)
* **iptv:** EPG 请求合并 + 节目单缓存优先 + 仅含音频停止加载动画 (`48ac9c9`)
* **perf:** 主题/皮肤切换瞬切根治卡顿 + discover 流搜索竞态保护 (`a7dba22`)
* **player:** 播放器 UI 细节修正 (`b078e92`)
* **player:** 播放进度身份错位与历史记录展示修复 (`469a383`)
* **settings:** TMDB Token 加密覆盖内存致 401 修复 + E2E 排除 backup-specs (`672d0c5`)
* sonner toast 宽度改为内容撑开（fit-content） (`4d62a43`)
* sonner 选择器失效致 toast 压顶不居中 + 播放页中间按钮播放无提示 + 免责声明标题居中 (`87e7cd4`)
* Toast 系统统一 — 操作类右上角、警告/错误/成功类播放器内部中间靠上 (`87bcf12`)
* 播放器 Toast 位置改回右上角 + 浏览器拦截提示统一到播放器内部 (`3f20164`)


### Performance Improvements

* 接口滥用治理与播放页缓存优化 (`3729f78`)

## [1.1.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.0.0...kinotv-v1.1.0) (2026-07-30)


### Features

* **browse:** 切换直链搜索tab跳过重复查询、双卡片相连、切换筛选触发搜索中 (`869dbf2`)
* **browse:** 移动端整页以卡片式布局包裹（isPhone / 视口&lt;768px） (`940b4b2`)
* **browse:** 移动端方案②命令栏+右滑全屏筛选面板，动态预设（trending+记忆），桌面移除更新中并全展开筛选tab (`63a102c`)
* DASH播放器支持 + 时移回看 + UI组件增强 + README更新 (`6418432`)
* EPG 节目单 + UniversalPlayer OSD 与各页样式迭代 (`6923a65`)
* HeroBanner UI 优化 + TMDB Mock 测试保护 + 全页面测试用例 + Bug 修复 (`3c31bc1`)
* HeroBanner 滑动切换动画 + Capacitor 原生支持 + UI/播放器优化 (`2c1f09f`)
* IPTV 播放器优化 + 接口滥用修复 + UI 调整 + 构建优化 (`90f80f0`)
* IPTV/设置页UI优化 + 播放器交互改进 + Loading居中修复 (`cd68289`)
* **iptv:** 修复双层滚动冲突 + 修复懒加载 120 卡死 + 同步 UI 组件库 (`94aa6e2`)
* IPTV移动端OSD控制栏适配 + 播放器头部全屏按钮 + 页面左右padding统一 (`9223c60`)
* migrate HeroBanner from Swiper to Embla Carousel (`3d3313b`)
* player UI improvements and Browse page cleanup (`7ac36fa`)
* Player 页 UI 整改 — 连播导航/overview展开/空态主题/超时重试/代码清理 (`4eb6fb2`)
* **Player:** 选季面板 + 选集排序/下拉 + 播放按钮/收藏样式优化 (`b9f2a77`)
* RecordShell 共用外壳 + Browse 懒加载修复 + 页面原理图与流程图 + AI Agent 指南 (`0e98ad6`)
* shadcn/ui迁移 + 动画增强 + 主题换肤系统 + Bug修复 (`da7fa05`)
* TMDB 服务 — 类型扩展 + 接口增强 + Store 更新 (`8ea4139`)
* UI 交互优化 + 路由过渡动画 + Design Token 调整 + 移动端适配 (`7de343c`)
* UI优化 + IPTV修复 + README文档 + Playwright测试框架 (`0026d76`)
* UI优化 + 播放器改进 + 测试基础设施 + 文档更新 + videoService编码修复 (`6612219`)
* UI优化 + 滚动条重构 + 页面交互修复 (`cdad78a`)
* UI重构 + IPTV代理修复 + 多项bug修复 (`12913f3`)
* UniversalPlayer 控制栏增强 + UI 组件优化 + 样式修复 (`8a1a7d7`)
* **version:** 引入 SemVer + release-please 自动版本与 Capacitor 双端同步 (`7226232`)
* 主题/动画/Design Token 调优 + IPTV 源数据更新 + UI 组件增强 (`c9a53c3`)
* 主题切换平滑过渡 + Browse 源状态弹层与详情页源检测一致 (`33a716d`)
* 卡片式布局升级 + 多页面 UI 优化 (`6b0469a`)
* 卡片模块 UI 风格（首页/侧边栏/顶栏/loading 卡片化，骨架扫光调速，仅桌面端生效） (`661e176`)
* 历史页时间轴重构 — 圆点内联到分组标题行，竖线贯穿各节点 (`9532813`)
* 批量修复 6 项 UI/行为问题 (`ebb453e`)
* 搜索中心 + CMS 直链搜索 + 播放器优化 + 5项Bug修复 (`29963f0`)
* 播放器交互优化 + IPTV 体验改进 + 设置项重构 (`ee90d2b`)
* 播放器全面优化 + 首页Banner继续播放 + CSS设计令牌统一 (`53639e6`)
* 播放流程入口测试 + 多页面 UI 优化 (`5129021`)
* 新增 ConfirmDialog 组件 + CORS Proxy Worker + 各页样式优化 (`d607b72`)
* 移动端UI优化 + 主题闪烁修复 + 设置页/首页/IPTV交互改进 (`3157f65`)
* 详情页/人物页优化 + 播放器控制栏增强 + 动态页签标题 (`1655ecc`)
* 连接式导航布局 + Browse 双卡片重构 + 知识库同步 (`0d04981`)
* 页面级KeepAlive + 播放器重构 + TypeScript错误修复 + 构建优化 (`47f82c2`)


### Bug Fixes

* **app-loading:** 移动端 AppLoading 全视口带卡片式布局，与桌面端一致 (`a22c8b5`)
* Browse 刷新清空搜索词 + 历史页 tab 切换去重 + FilterBar 重构 + SearchBox 右键拦截 (`671b1d5`)
* **browse:** useIsPhone 改为真实手机UA+App(非视口)，并补引入 BrowseMobileBar.css(此前未引入致移动端样式全失效)；移动端结果区去卡片外壳改全宽网格 (`cbc1998`)
* **browse:** 修复懒加载失效 + 统一 VideoCard 网格样式 (`941fc4d`)
* **browse:** 切换筛选tab正确触发搜索中遮罩（换角度：快照hadData而非依赖discoverResults） (`f6c089c`)
* **browse:** 清空搜索词后切到直链搜索时清空 CMS 残留数据 (`8b99337`)
* **browse:** 移动端卡片布局改为镜像桌面端双卡片相连，整页随 app-shell 滚动 (`7a6f791`)
* **browse:** 移动端命令栏对齐桌面端——激活tab文本#fff、亮色去背景、chip选中实色primary、删除排序按钮 (`2747944`)
* **browse:** 移动端布局仅真实手机web+App生效(useIsPhone)，命令栏对齐原型(模式段+排序+筛选入口+动态预设+说明+已选轨+面板为你推荐) (`b9de28e`)
* **browse:** 移动端布局增加视口&lt;768px触发；按钮缩小、重置/完成改胶囊；主题适配(#fff-&gt;var(--color-text-inverse)修复暗色不可见) (`d0a2387`)
* **browse:** 移动端模式tab文本色对齐桌面端(secondary)，直链搜索隐藏bmb-rail (`81643b7`)
* **browse:** 移动端模式分段容器背景/边框对齐桌面端（surface + color-border） (`1c547c2`)
* **browse:** 移动端直链搜索模式隐藏排序/筛选入口与预设横滚 (`8c4d6b4`)
* **browse:** 移动端直链搜索隐藏预设 + 整页卡片布局修复（结果区内部滚动） (`54027d3`)
* **ci:** release-please 支持 PAT 绕过仓库 PR 创建权限限制 (`85e7f39`)
* **detail:** 剧照在 Keep-Alive 隐藏加载后正确截断为 2 行 (`e600bc1`)
* HeroBanner 缩略图 active 盒子缩放导致宽度不一致 + Detail 首次进入剧照截断/闪烁 (`eac50ad`)
* HeroBanner 缩略图撑满 banner 高度 + 消除首屏双重 AppLoading (`6b21abe`)
* **HeroBanner:** 修复 banner 切换后回退 crossfade 导致的闪烁 (`efe5865`)
* **HeroBanner:** 修复切换分类越界导致整页白屏；切换时缩略图回骨架占位 (`739e7e3`)
* **HeroBanner:** 修复右栏缩略图初始骨架宽度与真实不一致 (`56d6d4c`)
* **HeroBanner:** 修复缩略图切换时最后一个（新露出）缩略图闪烁 (`e1b61ab`)
* **HeroBanner:** 彻底修复缩略图切换露白——改为预加载就绪后再换图 (`f607ed5`)
* **home:** 修复首页 TMDBMovieRow 不显示 + banner 缩略图骨架不同步 (`282174a`)
* IPTV 懒加载改边沿触发+隐藏期守卫，剧照 lightbox 用 Portal 修复高度与背景滚动锁定 (`4025a1d`)
* m3u8-proxy 添加 User-Agent 解决 403 + 启动时同步 IPTV aggregatorUrl 避免首进无数据 (`b4734e8`)
* **record-shell:** 移动端 record-aside 用 space-md gap，对齐桌面端 edit-row 间距 (`ac75153`)
* **record-shell:** 移动端 record-aside 移除卡片式包裹，对齐桌面端纯布局条 (`81dce42`)
* **record-shell:** 移动端 record-main 补 gap:space-sm，对齐桌面端内部间距 (`7cf3e18`)
* resolve TypeScript build errors for Cloudflare Pages deployment (`1a805ba`)
* **Settings:** 补设置页进入过渡动画，消除进入僵硬感 (`223d5a2`)
* **styles:** 关于页版本/更新日志项移除 hover/focus 背景变色 (`9ef2f70`)
* **styles:** 消除设置项按钮 active 时内部元素异常缩放/下沉 (`90c7c99`)
* **styles:** 设置页按钮按压仅缩放内部文字、按钮框保持静止 (`4d4b300`)
* **styles:** 设置页按钮改用 opacity 按压反馈（不缩放/不改背景） (`d0c8cd2`)
* **styles:** 设置项按压仅缩放文本自身宽度（标题收缩到 fit-content） (`f59b488`)
* **style:** 方案6二次整改——缩放反馈一律不叠加 box-shadow；个人资料/导入导出/恢复默认仅文字缩放 (`7c22f08`)
* **style:** 方案6弹性回弹整改——补全侧边栏/顶栏、收敛 box-shadow、排除设置页全宽行、清除旧方案残留 (`ca3dda9`)
* **style:** 采用方案6弹性回弹替换全局按钮按压反馈 (`2af5c9a`)
* TMDB错误处理、CMS loading状态、Settings placeholder字体、Browse数据覆盖 (`cf2c764`)
* **Transition:** 消除首页/分类页双重 AppLoading 并补全进入过渡动画 (`1d5654f`)
* 修复 7/28 页面过渡与侧边栏遗留问题 (`eabe0be`)
* 修复 AppLayout.tsx 中 CustomScrollbar 拼写错误 (`4e92aa5`)
* 修复 CSS 属性顺序和媒体查询语法 (`16fe0a8`)
* 修复 DB 版本升级时整页卡在 loading 的问题 (`0439af6`)
* 修复 HeroBanner 缩略图宽度跳变与 Detail 首进剧照不截断的真根因 (`5b27bfa`)
* 修复多重AppLoading闪烁/剧照分割/banner滑动/设置卡片/非首页trending (`28f2dab`)
* 修复播放列表立即播放的选集/线路回显与详情页 keep-alive (`0e4e713`)
* 修复缩略图骨架宽度与真实不一致（真实根因，非 HeroBanner） (`e16ec5a`)
* 修复返回顶部/设置深链/Detail滚动恢复与标题/Browse标题 ([#1](https://github.com/ntc0728/video-warehouse/issues/1) [#3](https://github.com/ntc0728/video-warehouse/issues/3) [#4](https://github.com/ntc0728/video-warehouse/issues/4) [#5](https://github.com/ntc0728/video-warehouse/issues/5) [#6](https://github.com/ntc0728/video-warehouse/issues/6) [#7](https://github.com/ntc0728/video-warehouse/issues/7)) (`a91e4c0`)
* 全部弹窗实时订阅观看历史，修正返回后进度/百分比滞后 (`28fd59e`)
* 引入分层 z-index 层级体系修复下拉框被侧边栏遮挡，合并页面进入动画统一、首页骨架一致性及 keep-alive store 等累积修复 (`5a9d24e`)
* 播放列表弹窗「播放中」标记按季隔离 (`c19f144`)
* 播放列表弹窗抽屉层级与选季布局 (`846eb9d`)
* 播放器核心逻辑修复 + UI优化 + 请求取消支持 (`02147e4`)
* 播放进度按内容身份跨源共享（电影=videoId，剧集=videoId+季+集） (`fcf008f`)
* 播放页按历史进度恢复选集/线路（点击源卡片立即播放场景） (`6d04149`)
* 移除 StickyHeader 未使用的 isBrowse 变量，修复 TS6133 编译错误 (`cda1067`)
* 移除 useTMDBStore 中未使用的 _totalResults 变量，修复 tsc -b 构建失败 (`f4b7601`)
* 移除详情页hero item多余背景色 (`4352391`)
* 返回后浏览器页签标题停留在旧页（Keep-Alive 多页竞态） (`44a6f06`)
* 还原 7/28 误删的 Browse 页面样式（e4514b4 过度删除） (`0d53286`)
* 选源优先级修正——routeSourceIndex 优先于历史记录，点哪个源播哪个源 (`c73fe1e`)
* 首页分类跳转 Browse 页搜索筛选联动 (`9ba1be5`)


### Performance Improvements

* AppLayout 侧边栏折叠 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 (`d811da0`)
* AppLayout 侧边栏折叠改用 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 (`76a656a`)
* Browse.css 去掉废弃的 browse-fade-in 进入动画（统一用 stagger） (`e4514b4`)
* HeroBanner 轮播图性能优化 — 使用 Swiper 替换自定义实现 (`8c2901e`)
* HomeSidebar.css 同步方案 B 改造（去掉 width transition） (`25764b9`)
* HomeSidebar.tsx 注释同步 + RecordShell 统一用 stagger 变体 (`3aff037`)
* **Home:** 用 useDeferredValue 解耦侧边栏分类切换的高亮与重内容渲染 (`a2af678`)
* Layout.css + HomeSidebar.css 方案 B 改造（变量驱动 width，去 transition） (`bf9ba58`)
* **Layout:** 移除 View Transitions API + 优化 Keep-Alive 容器渲染 (`a567107`)
* 侧边栏折叠 transform 补偿 + 统一页面进入过渡动画（核心样式/布局） (`6e373c2`)
* 侧边栏折叠改用 transform 补偿 + 统一页面进入过渡动画（三套变体） (`678e58c`)
* 侧边栏折叠改用 transform 补偿方案 + 统一页面进入过渡动画（1/2：核心样式） (`b48a153`)


### Reverts

* 撤销 play 页选源回归改动（恢复原始 routeSourceIndex 判断） (`585ef0c`)

## 1.0.0 (2026-07-30)


### Features

* **browse:** 切换直链搜索tab跳过重复查询、双卡片相连、切换筛选触发搜索中 (`869dbf2`)
* **browse:** 移动端整页以卡片式布局包裹（isPhone / 视口&lt;768px） (`940b4b2`)
* **browse:** 移动端方案②命令栏+右滑全屏筛选面板，动态预设（trending+记忆），桌面移除更新中并全展开筛选tab (`63a102c`)
* DASH播放器支持 + 时移回看 + UI组件增强 + README更新 (`6418432`)
* EPG 节目单 + UniversalPlayer OSD 与各页样式迭代 (`6923a65`)
* HeroBanner UI 优化 + TMDB Mock 测试保护 + 全页面测试用例 + Bug 修复 (`3c31bc1`)
* HeroBanner 滑动切换动画 + Capacitor 原生支持 + UI/播放器优化 (`2c1f09f`)
* IPTV 播放器优化 + 接口滥用修复 + UI 调整 + 构建优化 (`90f80f0`)
* IPTV/设置页UI优化 + 播放器交互改进 + Loading居中修复 (`cd68289`)
* **iptv:** 修复双层滚动冲突 + 修复懒加载 120 卡死 + 同步 UI 组件库 (`94aa6e2`)
* IPTV移动端OSD控制栏适配 + 播放器头部全屏按钮 + 页面左右padding统一 (`9223c60`)
* migrate HeroBanner from Swiper to Embla Carousel (`3d3313b`)
* player UI improvements and Browse page cleanup (`7ac36fa`)
* Player 页 UI 整改 — 连播导航/overview展开/空态主题/超时重试/代码清理 (`4eb6fb2`)
* **Player:** 选季面板 + 选集排序/下拉 + 播放按钮/收藏样式优化 (`b9f2a77`)
* RecordShell 共用外壳 + Browse 懒加载修复 + 页面原理图与流程图 + AI Agent 指南 (`0e98ad6`)
* shadcn/ui迁移 + 动画增强 + 主题换肤系统 + Bug修复 (`da7fa05`)
* TMDB 服务 — 类型扩展 + 接口增强 + Store 更新 (`8ea4139`)
* UI 交互优化 + 路由过渡动画 + Design Token 调整 + 移动端适配 (`7de343c`)
* UI优化 + IPTV修复 + README文档 + Playwright测试框架 (`0026d76`)
* UI优化 + 播放器改进 + 测试基础设施 + 文档更新 + videoService编码修复 (`6612219`)
* UI优化 + 滚动条重构 + 页面交互修复 (`cdad78a`)
* UI重构 + IPTV代理修复 + 多项bug修复 (`12913f3`)
* UniversalPlayer 控制栏增强 + UI 组件优化 + 样式修复 (`8a1a7d7`)
* **version:** 引入 SemVer + release-please 自动版本与 Capacitor 双端同步 (`7226232`)
* 主题/动画/Design Token 调优 + IPTV 源数据更新 + UI 组件增强 (`c9a53c3`)
* 主题切换平滑过渡 + Browse 源状态弹层与详情页源检测一致 (`33a716d`)
* 卡片式布局升级 + 多页面 UI 优化 (`6b0469a`)
* 卡片模块 UI 风格（首页/侧边栏/顶栏/loading 卡片化，骨架扫光调速，仅桌面端生效） (`661e176`)
* 历史页时间轴重构 — 圆点内联到分组标题行，竖线贯穿各节点 (`9532813`)
* 批量修复 6 项 UI/行为问题 (`ebb453e`)
* 搜索中心 + CMS 直链搜索 + 播放器优化 + 5项Bug修复 (`29963f0`)
* 播放器交互优化 + IPTV 体验改进 + 设置项重构 (`ee90d2b`)
* 播放器全面优化 + 首页Banner继续播放 + CSS设计令牌统一 (`53639e6`)
* 播放流程入口测试 + 多页面 UI 优化 (`5129021`)
* 新增 ConfirmDialog 组件 + CORS Proxy Worker + 各页样式优化 (`d607b72`)
* 移动端UI优化 + 主题闪烁修复 + 设置页/首页/IPTV交互改进 (`3157f65`)
* 详情页/人物页优化 + 播放器控制栏增强 + 动态页签标题 (`1655ecc`)
* 连接式导航布局 + Browse 双卡片重构 + 知识库同步 (`0d04981`)
* 页面级KeepAlive + 播放器重构 + TypeScript错误修复 + 构建优化 (`47f82c2`)


### Bug Fixes

* **app-loading:** 移动端 AppLoading 全视口带卡片式布局，与桌面端一致 (`a22c8b5`)
* Browse 刷新清空搜索词 + 历史页 tab 切换去重 + FilterBar 重构 + SearchBox 右键拦截 (`671b1d5`)
* **browse:** useIsPhone 改为真实手机UA+App(非视口)，并补引入 BrowseMobileBar.css(此前未引入致移动端样式全失效)；移动端结果区去卡片外壳改全宽网格 (`cbc1998`)
* **browse:** 修复懒加载失效 + 统一 VideoCard 网格样式 (`941fc4d`)
* **browse:** 切换筛选tab正确触发搜索中遮罩（换角度：快照hadData而非依赖discoverResults） (`f6c089c`)
* **browse:** 清空搜索词后切到直链搜索时清空 CMS 残留数据 (`8b99337`)
* **browse:** 移动端卡片布局改为镜像桌面端双卡片相连，整页随 app-shell 滚动 (`7a6f791`)
* **browse:** 移动端命令栏对齐桌面端——激活tab文本#fff、亮色去背景、chip选中实色primary、删除排序按钮 (`2747944`)
* **browse:** 移动端布局仅真实手机web+App生效(useIsPhone)，命令栏对齐原型(模式段+排序+筛选入口+动态预设+说明+已选轨+面板为你推荐) (`b9de28e`)
* **browse:** 移动端布局增加视口&lt;768px触发；按钮缩小、重置/完成改胶囊；主题适配(#fff-&gt;var(--color-text-inverse)修复暗色不可见) (`d0a2387`)
* **browse:** 移动端模式tab文本色对齐桌面端(secondary)，直链搜索隐藏bmb-rail (`81643b7`)
* **browse:** 移动端模式分段容器背景/边框对齐桌面端（surface + color-border） (`1c547c2`)
* **browse:** 移动端直链搜索模式隐藏排序/筛选入口与预设横滚 (`8c4d6b4`)
* **browse:** 移动端直链搜索隐藏预设 + 整页卡片布局修复（结果区内部滚动） (`54027d3`)
* **detail:** 剧照在 Keep-Alive 隐藏加载后正确截断为 2 行 (`e600bc1`)
* HeroBanner 缩略图 active 盒子缩放导致宽度不一致 + Detail 首次进入剧照截断/闪烁 (`eac50ad`)
* HeroBanner 缩略图撑满 banner 高度 + 消除首屏双重 AppLoading (`6b21abe`)
* **HeroBanner:** 修复 banner 切换后回退 crossfade 导致的闪烁 (`efe5865`)
* **HeroBanner:** 修复切换分类越界导致整页白屏；切换时缩略图回骨架占位 (`739e7e3`)
* **HeroBanner:** 修复右栏缩略图初始骨架宽度与真实不一致 (`56d6d4c`)
* **HeroBanner:** 修复缩略图切换时最后一个（新露出）缩略图闪烁 (`e1b61ab`)
* **HeroBanner:** 彻底修复缩略图切换露白——改为预加载就绪后再换图 (`f607ed5`)
* **home:** 修复首页 TMDBMovieRow 不显示 + banner 缩略图骨架不同步 (`282174a`)
* IPTV 懒加载改边沿触发+隐藏期守卫，剧照 lightbox 用 Portal 修复高度与背景滚动锁定 (`4025a1d`)
* m3u8-proxy 添加 User-Agent 解决 403 + 启动时同步 IPTV aggregatorUrl 避免首进无数据 (`b4734e8`)
* **record-shell:** 移动端 record-aside 用 space-md gap，对齐桌面端 edit-row 间距 (`ac75153`)
* **record-shell:** 移动端 record-aside 移除卡片式包裹，对齐桌面端纯布局条 (`81dce42`)
* **record-shell:** 移动端 record-main 补 gap:space-sm，对齐桌面端内部间距 (`7cf3e18`)
* resolve TypeScript build errors for Cloudflare Pages deployment (`1a805ba`)
* **Settings:** 补设置页进入过渡动画，消除进入僵硬感 (`223d5a2`)
* **styles:** 关于页版本/更新日志项移除 hover/focus 背景变色 (`9ef2f70`)
* **styles:** 消除设置项按钮 active 时内部元素异常缩放/下沉 (`90c7c99`)
* **styles:** 设置页按钮按压仅缩放内部文字、按钮框保持静止 (`4d4b300`)
* **styles:** 设置页按钮改用 opacity 按压反馈（不缩放/不改背景） (`d0c8cd2`)
* **styles:** 设置项按压仅缩放文本自身宽度（标题收缩到 fit-content） (`f59b488`)
* **style:** 方案6二次整改——缩放反馈一律不叠加 box-shadow；个人资料/导入导出/恢复默认仅文字缩放 (`7c22f08`)
* **style:** 方案6弹性回弹整改——补全侧边栏/顶栏、收敛 box-shadow、排除设置页全宽行、清除旧方案残留 (`ca3dda9`)
* **style:** 采用方案6弹性回弹替换全局按钮按压反馈 (`2af5c9a`)
* TMDB错误处理、CMS loading状态、Settings placeholder字体、Browse数据覆盖 (`cf2c764`)
* **Transition:** 消除首页/分类页双重 AppLoading 并补全进入过渡动画 (`1d5654f`)
* 修复 7/28 页面过渡与侧边栏遗留问题 (`eabe0be`)
* 修复 AppLayout.tsx 中 CustomScrollbar 拼写错误 (`4e92aa5`)
* 修复 CSS 属性顺序和媒体查询语法 (`16fe0a8`)
* 修复 DB 版本升级时整页卡在 loading 的问题 (`0439af6`)
* 修复 HeroBanner 缩略图宽度跳变与 Detail 首进剧照不截断的真根因 (`5b27bfa`)
* 修复多重AppLoading闪烁/剧照分割/banner滑动/设置卡片/非首页trending (`28f2dab`)
* 修复播放列表立即播放的选集/线路回显与详情页 keep-alive (`0e4e713`)
* 修复缩略图骨架宽度与真实不一致（真实根因，非 HeroBanner） (`e16ec5a`)
* 修复返回顶部/设置深链/Detail滚动恢复与标题/Browse标题 ([#1](https://github.com/ntc0728/video-warehouse/issues/1) [#3](https://github.com/ntc0728/video-warehouse/issues/3) [#4](https://github.com/ntc0728/video-warehouse/issues/4) [#5](https://github.com/ntc0728/video-warehouse/issues/5) [#6](https://github.com/ntc0728/video-warehouse/issues/6) [#7](https://github.com/ntc0728/video-warehouse/issues/7)) (`a91e4c0`)
* 全部弹窗实时订阅观看历史，修正返回后进度/百分比滞后 (`28fd59e`)
* 引入分层 z-index 层级体系修复下拉框被侧边栏遮挡，合并页面进入动画统一、首页骨架一致性及 keep-alive store 等累积修复 (`5a9d24e`)
* 播放列表弹窗「播放中」标记按季隔离 (`c19f144`)
* 播放列表弹窗抽屉层级与选季布局 (`846eb9d`)
* 播放器核心逻辑修复 + UI优化 + 请求取消支持 (`02147e4`)
* 播放进度按内容身份跨源共享（电影=videoId，剧集=videoId+季+集） (`fcf008f`)
* 播放页按历史进度恢复选集/线路（点击源卡片立即播放场景） (`6d04149`)
* 移除 StickyHeader 未使用的 isBrowse 变量，修复 TS6133 编译错误 (`cda1067`)
* 移除 useTMDBStore 中未使用的 _totalResults 变量，修复 tsc -b 构建失败 (`f4b7601`)
* 移除详情页hero item多余背景色 (`4352391`)
* 返回后浏览器页签标题停留在旧页（Keep-Alive 多页竞态） (`44a6f06`)
* 还原 7/28 误删的 Browse 页面样式（e4514b4 过度删除） (`0d53286`)
* 选源优先级修正——routeSourceIndex 优先于历史记录，点哪个源播哪个源 (`c73fe1e`)
* 首页分类跳转 Browse 页搜索筛选联动 (`9ba1be5`)


### Performance Improvements

* AppLayout 侧边栏折叠 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 (`d811da0`)
* AppLayout 侧边栏折叠改用 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 (`76a656a`)
* Browse.css 去掉废弃的 browse-fade-in 进入动画（统一用 stagger） (`e4514b4`)
* HeroBanner 轮播图性能优化 — 使用 Swiper 替换自定义实现 (`8c2901e`)
* HomeSidebar.css 同步方案 B 改造（去掉 width transition） (`25764b9`)
* HomeSidebar.tsx 注释同步 + RecordShell 统一用 stagger 变体 (`3aff037`)
* **Home:** 用 useDeferredValue 解耦侧边栏分类切换的高亮与重内容渲染 (`a2af678`)
* Layout.css + HomeSidebar.css 方案 B 改造（变量驱动 width，去 transition） (`bf9ba58`)
* **Layout:** 移除 View Transitions API + 优化 Keep-Alive 容器渲染 (`a567107`)
* 侧边栏折叠 transform 补偿 + 统一页面进入过渡动画（核心样式/布局） (`6e373c2`)
* 侧边栏折叠改用 transform 补偿 + 统一页面进入过渡动画（三套变体） (`678e58c`)
* 侧边栏折叠改用 transform 补偿方案 + 统一页面进入过渡动画（1/2：核心样式） (`b48a153`)


### Reverts

* 撤销 play 页选源回归改动（恢复原始 routeSourceIndex 判断） (`585ef0c`)

## Changelog

本文件由 [release-please](https://github.com/googleapis/release-please) 依据 **Conventional Commits** 自动维护。

## 版本规则（SemVer）

- **MAJOR（X）** — 破坏性变更
- **MINOR（Y）** — 新增功能（0.x 阶段破坏性变更也升 MINOR）
- **PATCH（Z）** — 修复 / 样式 / 重构
- 预发布通道：`-alpha.N` / `-beta.N` / `-rc.N`

> 首次自动发布（合并 release-please 开版 PR）后，上方占位内容将被实际变更记录取代。

## 当前状态

- `package.json` 版本：`0.0.0`（尚未发布首个稳定版）
- Android 端 `versionCode` 由 `scripts/sync-android-version.mjs` 在 `build:android` 时从版本号自动派生
