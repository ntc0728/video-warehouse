# Changelog

## [1.7.3](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.2...kinotv-v1.7.3) (2026-08-14)


### Bug Fixes

* **ci:** release-please.yml 门控改为 release 存在性探测（release_created 恒跳过根因修复）+ 双 workflow 版本号提取兼容 kinotv-v 前缀 ([c9373e7](https://github.com/ntc0728/video-warehouse/commit/c9373e76b483783317703be6bb7074b87d01c643))

## [1.7.2](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.1...kinotv-v1.7.2) (2026-08-14)


### Bug Fixes

* **ci:** APK 构建恢复 release 事件主通道 + 修复手动补传 tag 前缀 ([7b54c7d](https://github.com/ntc0728/video-warehouse/commit/7b54c7dbb715cd17c76b415f346f16d276be54dd))

## [1.7.1](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.7.0...kinotv-v1.7.1) (2026-08-13)


### Bug Fixes

* **ci:** APK 构建移入 release-please 工作流根治 Release 缺 assets ([70e9953](https://github.com/ntc0728/video-warehouse/commit/70e9953bc0c92bd957897e1401948f99e6a5a41f))
* **hero-banner:** 分类切换主图旧图垫底→新图就绪淡入，消除硬切 ([3474500](https://github.com/ntc0728/video-warehouse/commit/34745006e95374104fba80b3ead2eaabf12d3102))
* **home:** 分类切换交叉淡出/淡入过渡，消除直白瞬间替换 ([0f1e40f](https://github.com/ntc0728/video-warehouse/commit/0f1e40fa86f6175fccccf2bb4ee07c231186c968))
* **home:** 分类切换内容无透明空窗 + 修复轮播回归 + 缩略图交叉淡入 ([455c8ce](https://github.com/ntc0728/video-warehouse/commit/455c8cefd1481acf557cc704008c3b05b93b41d2))
* **home:** 分类切换改渲染层 SWR 根治白屏闪烁 ([0154816](https://github.com/ntc0728/video-warehouse/commit/01548164e0f78e05b18a3b3d2225b1b04475a046))
* **settings:** tab 常驻挂载消除切 tab 抖动 + OverlayScrollbar 补内容变化监听 ([4e08cb6](https://github.com/ntc0728/video-warehouse/commit/4e08cb612a4c989a9319689a4922e4e9714ac07e))
* **settings:** 关于页免责声明贴底 + 点击项左右平移改文本缩放 ([d69dbd7](https://github.com/ntc0728/video-warehouse/commit/d69dbd7a05f3f7be5faddf4705d68ff91409d133))


### Performance Improvements

* 页面走读问题整改（源JSON按需加载/分类请求取消与去重/封面失败重试/IP层动画统一/收藏历史页卡顿优化） ([8748f30](https://github.com/ntc0728/video-warehouse/commit/8748f3093b3ddfe4adcc2a45f20aa72b5a31d8d6))

## [1.7.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.6.0...kinotv-v1.7.0) (2026-08-12)


### Features

* **iptv:** app 端播放页自动横屏 + 隐藏全屏按钮 ([62cd8a5](https://github.com/ntc0728/video-warehouse/commit/62cd8a50ba3b374eda19b76b0d4c6457a3dc91aa))
* **nav:** 桌面侧边栏底部新增设置入口+版本号，顶栏设置项迁出 ([ff24bcb](https://github.com/ntc0728/video-warehouse/commit/ff24bcb35c1be266f1f017bdaf44e364f33e77a5))
* **nav:** 桌面顶栏最右侧新增个人头像+用户名入口 ([7104d94](https://github.com/ntc0728/video-warehouse/commit/7104d948f52c2ed05f5850eaeaf8ff4736295f53))
* **nav:** 移动 web 顶栏新增个人头像+用户名入口，抽屉设置项移到底部 ([cfc3a51](https://github.com/ntc0728/video-warehouse/commit/cfc3a51d061d6f7d7e9066e3485053d4a2052b3c))
* **settings:** 移动端子页增加进入/退出过渡动画 ([99b9fbd](https://github.com/ntc0728/video-warehouse/commit/99b9fbd6b0cd816826c3830c85c537b782b372e7))
* **skin:** 皮肤字体自托管（public/fonts/），替换不可达的 Google gstatic ([9b7bfc3](https://github.com/ntc0728/video-warehouse/commit/9b7bfc36021f02a59e1d5038ad24b70773670cfd))
* **ui:** 顶栏/侧边栏/设置页细节统一（hover-scale 全局方法等 4 项） ([c67aab9](https://github.com/ntc0728/video-warehouse/commit/c67aab93d1a399980a9b51a30d1da4b8f391150e))


### Bug Fixes

* **base:** 字体基准显式化 14px + 移除 App 端无效 root 缩放 ([5da795f](https://github.com/ntc0728/video-warehouse/commit/5da795ffd1a7448b02dda9894e023194b8e0b7a4))
* **boot:** 消除冷启动白屏 + app 端汉堡隐藏 + 布局判断统一移动 ([345690a](https://github.com/ntc0728/video-warehouse/commit/345690a4356147722e554856c180581e2decb884))
* **browse:** 分类导航进入清空搜索词 + 立即刷新，消除旧数据闪现 ([d78ef85](https://github.com/ntc0728/video-warehouse/commit/d78ef858afdd431bce3dd9ed7b72ecdab351d71f))
* **cover:** 封面占位品牌化（加载中+失败兜底主题自适应） ([82f7d7d](https://github.com/ntc0728/video-warehouse/commit/82f7d7d26eef75bb39d9fac5f3c2b0374f85ca40))
* **home:** 实施时发现 50vh 移动端规则冲突，取消以让 token flex:1 撑满 ([d5c4b3f](https://github.com/ntc0728/video-warehouse/commit/d5c4b3f3aa1632e10830fe840372e5df964ae98d))
* **iptv/settings/ci:** 源接口走IPTV代理+源管理拖拽+卡片动画+Android CI 补SDK ([dd7e718](https://github.com/ntc0728/video-warehouse/commit/dd7e718efb14dceffbbbae61bb50f140f350167a))
* **iptv/settings/epg:** 4 项自测问题修复 ([e0ee1a3](https://github.com/ntc0728/video-warehouse/commit/e0ee1a3412e76475820abb9d55b67a851370b010))
* **iptv:** 频道封面失败占位统一为 KinoTV fallback 图（与 VideoCard 一致） ([e854c55](https://github.com/ntc0728/video-warehouse/commit/e854c55f41729a84c8b3ac7f856a0c5496fb3f1b))
* **layout:** app 端横屏恒为移动布局（CSS 断点双前缀） ([174433a](https://github.com/ntc0728/video-warehouse/commit/174433a325d7c37ab82f704ce493aa3f1ce9a463))
* **records:** 收藏/历史页容器改为数据就绪后挂载，IPTV tab 切换动画正常播放 ([07f0d13](https://github.com/ntc0728/video-warehouse/commit/07f0d13684e784a355f68fb847733de700630bd2))
* **settings/iptv:** 设置页返回按钮加文字 + IPTV 横向 cover 失败占位特殊处理 ([52cad60](https://github.com/ntc0728/video-warehouse/commit/52cad604eddd1c18285af0d3d3b2494978f0ae40))
* **typography:** 全局字体栈显式声明中文字体 + 移除无条件 Google Fonts [@import](https://github.com/import) ([e820eab](https://github.com/ntc0728/video-warehouse/commit/e820eabd09746aad53bf22691a3023ee8afd687c))
* **ui:** source-modal 移动端改为底部滑出全宽，消除两侧间隙 ([847ce7d](https://github.com/ntc0728/video-warehouse/commit/847ce7dfa43a8f317d544106e842aa301cd66df7))
* **ui:** VideoCard 加载占位统一纯色背景 + HeroBanner 缩略图无间隙 ([1406613](https://github.com/ntc0728/video-warehouse/commit/14066130817639274ddbdacf2c1137acced48b91))
* **ui:** 分类卡片 hover 上移/缩放仅限精指针设备，触摸端不再越界 ([f225262](https://github.com/ntc0728/video-warehouse/commit/f225262f700f5555e9e3c486314be731b8e9c664))
* **ui:** 桌面端隐藏 category-quick-access + 全端移除选中高亮 ([e00fba1](https://github.com/ntc0728/video-warehouse/commit/e00fba1ef7aafccde47224cf0d159faa5bb42b70))
* **ui:** 设置页padding对齐全局 + TabBar间距+安全区 + 免责声明贴底 ([a038443](https://github.com/ntc0728/video-warehouse/commit/a0384431c0ca58775eff6a8dcd00d854fd5a8044))

## [1.6.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.5.0...kinotv-v1.6.0) (2026-08-11)


### Features

* **iptv:** 台标三级回退优化（库清单预判+成败持久化+字母占位）与 sources 并发去重 ([81c55bd](https://github.com/ntc0728/video-warehouse/commit/81c55bd6286dc62f91103319d09a7cc2a0fa7cea))
* **iptv:** 新增 3 个国内稳定源 + catchup/UA 属性解析（预留默认关闭） ([720df28](https://github.com/ntc0728/video-warehouse/commit/720df28dfb8fe4394a19ad65a877634e147fd96c))


### Bug Fixes

* **iptv:** EPG/IPTV 服务重构与页面清理，修复加载慢与泄漏 ([ebb4f8a](https://github.com/ntc0728/video-warehouse/commit/ebb4f8a1f6883ca4253cfcfc673f27c83f87b419))
* **iptv:** 修复台标串台——成功记忆仅对当前频道候选链内排序 ([5f15dd2](https://github.com/ntc0728/video-warehouse/commit/5f15dd28bbb12946e6ccece05db1ea64c6ff5e30))
* IPTV台标占位重叠/移动端搜索框自适应/Android启动页与APK发布链 ([b4bc035](https://github.com/ntc0728/video-warehouse/commit/b4bc03593b37d952e02058fbc7b57b60bc3737ea))
* **settings:** 离开设置页时卸载移动端子页 portal，修复从子页跳转 source-checker/proxy-setup 被遮挡问题 ([9fef6c3](https://github.com/ntc0728/video-warehouse/commit/9fef6c33ab18f179f5db4e640cce5324a2b120a2))
* 源增量合并/子页顶栏/占位封面/首页后台刷新 4 项优化 ([549ba18](https://github.com/ntc0728/video-warehouse/commit/549ba181ab4595d755ecf06ba4f6230acd5f5143))

## [1.5.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.4.0...kinotv-v1.5.0) (2026-08-10)


### Features

* **browse:** 移动端筛选区改两行命令栏 + 全屏筛选面板 ([c7ebaca](https://github.com/ntc0728/video-warehouse/commit/c7ebacab5785bf5e974bd987db15dc94d76bfcaf))
* **settings:** 移动端设置页采用 iOS 分组圆角卡 + 子页全屏顶栏替代导航栏 + 双行卡对齐桌面 ([9331b05](https://github.com/ntc0728/video-warehouse/commit/9331b05d34ad07295a9e67d730c6b5f8d5ce8d1e))


### Bug Fixes

* **browse:** bmb-presets 与弹窗布局精确对齐 S3 HTML 示例（无偏差） ([0108703](https://github.com/ntc0728/video-warehouse/commit/01087031fe201218524652368a00c9199866c29b))
* **browse:** 筛选面板完成制应用 + 命令栏/弹窗细节对齐 ([151f61f](https://github.com/ntc0728/video-warehouse/commit/151f61f00e1326e19a2d08de745af21a2c3c8d6c))
* **browse:** 筛选面板对齐 S3 示例（删预设卡/返回箭头顶栏/pgIn 动画/chip 尺寸） ([98f7603](https://github.com/ntc0728/video-warehouse/commit/98f76038b1f501ea3fcddba8b2d637c2451c5093))
* **settings:** 子页用 createPortal 挂到 body 脱离 contain:layout ([7fc13e2](https://github.com/ntc0728/video-warehouse/commit/7fc13e2326730f748d45c89550212c19ab6c8965))
* **settings:** 子页顶栏对齐导航栏高度 + 移除淡入动画 + 个人设置/源管理卡片化对齐桌面 ([805aa73](https://github.com/ntc0728/video-warehouse/commit/805aa7336cb9325e6b6e89c1f8c4fe72b7b47456))
* **ui:** 弹窗按钮胶囊化修复 + ProfileEditModal 按钮补宽 ([da1749d](https://github.com/ntc0728/video-warehouse/commit/da1749dfbefa59d0cfca0e65fa573f654076fe9f))


### Performance Improvements

* **dev:** dev 模式跳过 preloadAllRoutes 消除白屏 ([2586c45](https://github.com/ntc0728/video-warehouse/commit/2586c45f7818a7ab77c98e1963d602a9e11b8c65))
* **dev:** vite server.warmup 预热核心模块，缓解首次打开慢 ([9fe8f57](https://github.com/ntc0728/video-warehouse/commit/9fe8f577a4f379683f08aab5d4ec21a4ffcb615c))

## [1.4.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.3.0...kinotv-v1.4.0) (2026-08-09)


### Features

* **settings:** 新增状态标签 SettingsStatusTag + List 双行布局 + 设置项 description 补全 ([2f9223b](https://github.com/ntc0728/video-warehouse/commit/2f9223b695374002ee90a58588b22ac6bcee5a83))


### Bug Fixes

* **settings:** desc 移入 header 与按钮两端对齐，单行截断+title 显示全文 ([72c684e](https://github.com/ntc0728/video-warehouse/commit/72c684e7f6b74af118ad77d420a526c6e4a3d049))
* **settings:** title 单独拆出卡片 + header/desc/badge 移入卡片 + profile-card 左右对齐 ([665e5c0](https://github.com/ntc0728/video-warehouse/commit/665e5c0ba6a31976c2bca8657cdab84ae886f838))
* **settings:** TMDB Token 按需解密 + 源折叠面板底部空隙 + 卡片化 ([95ec6f3](https://github.com/ntc0728/video-warehouse/commit/95ec6f3d57d7962ed0999b71be26828d21e4c909))
* **settings:** 个人设置 section 去 padding，标题上下间距对齐其他 tab ([9c19409](https://github.com/ntc0728/video-warehouse/commit/9c1940990d44a891ca3a5508165d6e82e942bd77))
* **settings:** 恢复个人设置 section 左右 12px 缩进 ([fa933d1](https://github.com/ntc0728/video-warehouse/commit/fa933d11680299409b80d02367ca58985119563a))
* **settings:** 标题单独移出卡片 + source-manager 加 padding + 个人设置大卡片化 ([d08dccd](https://github.com/ntc0728/video-warehouse/commit/d08dccdfcddb501f18197232489be836b9a64b08))
* **settings:** 桌面端设置项之间去分割线 + tabbar 文本图标稍大 ([fc426ac](https://github.com/ntc0728/video-warehouse/commit/fc426acb83db98c231fc6197a2f4c1057e42c06e))
* **source-manager:** toolbar 与 list 间距 8px，折叠时无残留 ([1744ba9](https://github.com/ntc0728/video-warehouse/commit/1744ba98f3ce86946111d5b691fdebdbbdd6517e))
* **source-manager:** 折叠时 gap 与 body 收缩同步过渡，消除按钮移动和收起延迟 ([b176a3a](https://github.com/ntc0728/video-warehouse/commit/b176a3a9a072224e56358f052f1abf4bdcbc124f))

## [1.3.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.2.0...kinotv-v1.3.0) (2026-08-07)


### Features

* 三源统一管理收敛 + IPTV 检测按组隔离 + proxy-setup ([0b1e20a](https://github.com/ntc0728/video-warehouse/commit/0b1e20a932a7c574725282b1db1e5c2e1c590689))


### Bug Fixes

* **IPTV:** GroupPicker 折叠高度改用相对容器偏移计算 ([ba5cad4](https://github.com/ntc0728/video-warehouse/commit/ba5cad46ed827494b06c6a516529f67a7a5d9dd3))


### Reverts

* **ci:** 删除多余的 Pages 部署 workflow（GitHub 集成已自动部署） ([24e567d](https://github.com/ntc0728/video-warehouse/commit/24e567d321d7b64398e00c5631b68a6ba0e05622))

## [1.2.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.1.0...kinotv-v1.2.0) (2026-08-06)


### Features

* CMS按钮6列均分 + 拖拽进度条提示 + Hero骨架位置修正 + 免责声明 ([978c243](https://github.com/ntc0728/video-warehouse/commit/978c243085bd20dae9809a289b94270c9755e62c))
* **detail:** 海报图 CMS 优先并支持 TMDB 失败兜底 ([b88f9e9](https://github.com/ntc0728/video-warehouse/commit/b88f9e90d9fd6804712ca527bfac64fb4798fbc2))
* **iptv:** C1 仅含音频时自动切线路（每频道名仅切 1 次防循环） ([f8d2885](https://github.com/ntc0728/video-warehouse/commit/f8d2885bf1a126e7acd8483219e424c9430fd07f))
* **iptv:** D1 裸流降级识别（fail-and-retry，零额外请求） ([3fcaafb](https://github.com/ntc0728/video-warehouse/commit/3fcaafb77509bfb04e997e12a24b3d79d19c8e26))
* **iptv:** 代理规则内置直连白名单默认值（降低 worker 请求量） ([cbe4a9a](https://github.com/ntc0728/video-warehouse/commit/cbe4a9aa61565d286c7cdd587f8ac9f9fa4d830a))
* **iptv:** 播放器操作提示独立右上角 + TV 端 IPTV 交互 ([79f276f](https://github.com/ntc0728/video-warehouse/commit/79f276ff963cec111ef905e20801ffcb2aa4bd75))
* **iptv:** 类型探测增强 + worker CORS 智能路由（分片直连省请求量） ([ac8bd21](https://github.com/ntc0728/video-warehouse/commit/ac8bd2189ed66a03e810cb7a0e79a00a5e89ff6d))
* **player:** IPTV 播放链路增强 - 视频轨检测 + FLV/TS 兜底 + 自动切代理 ([38f1c7a](https://github.com/ntc0728/video-warehouse/commit/38f1c7a0fd80a45ca6680a436381cd4f93f57bfb))
* **player:** toast 全局系统整改 + 播放器交互修复 ([aad7911](https://github.com/ntc0728/video-warehouse/commit/aad79119e395a3ac0a72a9360c355c09f617f644))
* **player:** 提示统一右上角 + 预加载①点播首分片预取 ([12b9db4](https://github.com/ntc0728/video-warehouse/commit/12b9db49883b72193ac3ff0bb619c0dfbd3bacbb))
* **player:** 预加载②剧集连播预加载（方案C，仅Wi-Fi） ([468bdc4](https://github.com/ntc0728/video-warehouse/commit/468bdc4ec3c079738e1461e8de7d21d04ea54182))
* **searchbox:** 搜索框输入词实时搜索建议 ([ad35f9c](https://github.com/ntc0728/video-warehouse/commit/ad35f9cc012e4f7e2b870501f3e31f60e8287baf))
* **ui:** 页面体验修复与侧边栏折叠重构 ([ea97ca9](https://github.com/ntc0728/video-warehouse/commit/ea97ca963696d3c62335ac9863a43bd2df8ca21a))
* 免责声明样式优化 + 移动端头像进入个人设置 ([c0d8876](https://github.com/ntc0728/video-warehouse/commit/c0d887676f45e9f77fdaf68b950385a0d36774a6))
* 播放页交互优化 + 首页继续观看行 2/3/5 + 测试 fixtures 纳入版本控制 ([a4a3732](https://github.com/ntc0728/video-warehouse/commit/a4a37326342d76cdebc430926a8ec1448704e42a))
* 继续观看行骨架与响应式 + 非手机web小视口箭头 + 骨架占位精细化 ([38df989](https://github.com/ntc0728/video-warehouse/commit/38df98904c34e9a3472b059a0839220a5a363277))
* 设置/首页 UI 优化 7 项 ([76796c2](https://github.com/ntc0728/video-warehouse/commit/76796c2c6752e28d5ed4db2460072dd85b117efa))


### Bug Fixes

* **browse:** 修复移动端断言与 loading 捕获（BROWSE-075/076/077） ([6ba10f6](https://github.com/ntc0728/video-warehouse/commit/6ba10f6e8d3c7aeb4fc537f0599c9db864e41659))
* **home,iptv:** 首页新增「继续观看」区块 + IPTV OSD 空回调按钮清除 ([efb85e2](https://github.com/ntc0728/video-warehouse/commit/efb85e29c27f7e674fa1c9598034b6dd6468031b))
* **home:** token 提示区高度链逐层撑满，主提示真居中、免责声明贴底 ([7231dec](https://github.com/ntc0728/video-warehouse/commit/7231decd657b3bfa54de654ec0493fa56991d3a5))
* **home:** 移动端 token 提示上移 + 骨架缩略图叠加暗底镜像真实加载态 ([7f252c6](https://github.com/ntc0728/video-warehouse/commit/7f252c6a67d0a6d44047180e2c7ce5a684ea1da4))
* **iptv:** EPG 请求合并 + 节目单缓存优先 + 仅含音频停止加载动画 ([48ac9c9](https://github.com/ntc0728/video-warehouse/commit/48ac9c9526fddb66294194466f357613328bc6de))
* **perf:** 主题/皮肤切换瞬切根治卡顿 + discover 流搜索竞态保护 ([a7dba22](https://github.com/ntc0728/video-warehouse/commit/a7dba2223cf06c485cb2865135d571ef306025d1))
* **player:** 播放器 UI 细节修正 ([b078e92](https://github.com/ntc0728/video-warehouse/commit/b078e92d376399295eb5ab42ece6cded6f8dd84b))
* **player:** 播放进度身份错位与历史记录展示修复 ([469a383](https://github.com/ntc0728/video-warehouse/commit/469a38363b961f2203c5fd9fe715fb940f8406ea))
* **settings:** TMDB Token 加密覆盖内存致 401 修复 + E2E 排除 backup-specs ([672d0c5](https://github.com/ntc0728/video-warehouse/commit/672d0c5ef3f99b63a2cc0e49cf88a3724d4d2ba4))
* sonner toast 宽度改为内容撑开（fit-content） ([4d62a43](https://github.com/ntc0728/video-warehouse/commit/4d62a43184244eba2cfe7e37b04d6913a5e958af))
* sonner 选择器失效致 toast 压顶不居中 + 播放页中间按钮播放无提示 + 免责声明标题居中 ([87e7cd4](https://github.com/ntc0728/video-warehouse/commit/87e7cd4e88bc58c3c949a18cb7e685be4c054a6d))
* Toast 系统统一 — 操作类右上角、警告/错误/成功类播放器内部中间靠上 ([87bcf12](https://github.com/ntc0728/video-warehouse/commit/87bcf12412ea06d2d6e93d7ae02a4a8acc7f5e6f))
* 播放器 Toast 位置改回右上角 + 浏览器拦截提示统一到播放器内部 ([3f20164](https://github.com/ntc0728/video-warehouse/commit/3f2016446ffdcf327c485e2270cf2413a5b7cd62))


### Performance Improvements

* 接口滥用治理与播放页缓存优化 ([3729f78](https://github.com/ntc0728/video-warehouse/commit/3729f78c6529ff4c711208974d8331c521b6d065))

## [1.1.0](https://github.com/ntc0728/video-warehouse/compare/kinotv-v1.0.0...kinotv-v1.1.0) (2026-07-30)


### Features

* **browse:** 切换直链搜索tab跳过重复查询、双卡片相连、切换筛选触发搜索中 ([869dbf2](https://github.com/ntc0728/video-warehouse/commit/869dbf2496cf9becc79de3a39278a2551ecde2c4))
* **browse:** 移动端整页以卡片式布局包裹（isPhone / 视口&lt;768px） ([940b4b2](https://github.com/ntc0728/video-warehouse/commit/940b4b2f511f69ea943b91726b368943b5673e9f))
* **browse:** 移动端方案②命令栏+右滑全屏筛选面板，动态预设（trending+记忆），桌面移除更新中并全展开筛选tab ([63a102c](https://github.com/ntc0728/video-warehouse/commit/63a102cf9e3d4bd01a4dc77c4288cf1e64221cea))
* DASH播放器支持 + 时移回看 + UI组件增强 + README更新 ([6418432](https://github.com/ntc0728/video-warehouse/commit/6418432e25836b391939e8eb238bafa82ce2b98f))
* EPG 节目单 + UniversalPlayer OSD 与各页样式迭代 ([6923a65](https://github.com/ntc0728/video-warehouse/commit/6923a650ab52a3f7edec905cd7e5c443afde39a5))
* HeroBanner UI 优化 + TMDB Mock 测试保护 + 全页面测试用例 + Bug 修复 ([3c31bc1](https://github.com/ntc0728/video-warehouse/commit/3c31bc1241aa959b4d0bd4edd4af7f54417c6040))
* HeroBanner 滑动切换动画 + Capacitor 原生支持 + UI/播放器优化 ([2c1f09f](https://github.com/ntc0728/video-warehouse/commit/2c1f09ff167cd5e31120275a528f77150bdd7ddf))
* IPTV 播放器优化 + 接口滥用修复 + UI 调整 + 构建优化 ([90f80f0](https://github.com/ntc0728/video-warehouse/commit/90f80f0e81767623ab2496034a250e12e17ff7db))
* IPTV/设置页UI优化 + 播放器交互改进 + Loading居中修复 ([cd68289](https://github.com/ntc0728/video-warehouse/commit/cd6828909f4e62cdd8dcb8e8549c1e8a2caa5560))
* **iptv:** 修复双层滚动冲突 + 修复懒加载 120 卡死 + 同步 UI 组件库 ([94aa6e2](https://github.com/ntc0728/video-warehouse/commit/94aa6e2f63bd378cf437978d594a0cd62a4b1841))
* IPTV移动端OSD控制栏适配 + 播放器头部全屏按钮 + 页面左右padding统一 ([9223c60](https://github.com/ntc0728/video-warehouse/commit/9223c60f96e9baae4cad17f051738cc1022bf489))
* migrate HeroBanner from Swiper to Embla Carousel ([3d3313b](https://github.com/ntc0728/video-warehouse/commit/3d3313ba0c66c3ccecfd707190082784ebf55903))
* player UI improvements and Browse page cleanup ([7ac36fa](https://github.com/ntc0728/video-warehouse/commit/7ac36fa0ca5749b6eb44bdd9774f310b6e1a48fd))
* Player 页 UI 整改 — 连播导航/overview展开/空态主题/超时重试/代码清理 ([4eb6fb2](https://github.com/ntc0728/video-warehouse/commit/4eb6fb2c1126a26e5228e20f044b1f748ea90223))
* **Player:** 选季面板 + 选集排序/下拉 + 播放按钮/收藏样式优化 ([b9f2a77](https://github.com/ntc0728/video-warehouse/commit/b9f2a7773a931dc8af1c71400e22fd43743afd7b))
* RecordShell 共用外壳 + Browse 懒加载修复 + 页面原理图与流程图 + AI Agent 指南 ([0e98ad6](https://github.com/ntc0728/video-warehouse/commit/0e98ad69099306f774d2e8d9da23578d815cebc7))
* shadcn/ui迁移 + 动画增强 + 主题换肤系统 + Bug修复 ([da7fa05](https://github.com/ntc0728/video-warehouse/commit/da7fa05bfdf40578f423629f7d3f0bf6ebc25412))
* TMDB 服务 — 类型扩展 + 接口增强 + Store 更新 ([8ea4139](https://github.com/ntc0728/video-warehouse/commit/8ea4139f22a897fbf9f6a4b7b7ad72f6da553714))
* UI 交互优化 + 路由过渡动画 + Design Token 调整 + 移动端适配 ([7de343c](https://github.com/ntc0728/video-warehouse/commit/7de343cfca080f6ffbbc34f65a7f36bf41bcefe5))
* UI优化 + IPTV修复 + README文档 + Playwright测试框架 ([0026d76](https://github.com/ntc0728/video-warehouse/commit/0026d766f4e49b753aeecb8f306b1e30fd2fbf83))
* UI优化 + 播放器改进 + 测试基础设施 + 文档更新 + videoService编码修复 ([6612219](https://github.com/ntc0728/video-warehouse/commit/661221926aa003ffcd4d61923871ce61dfd3e7fd))
* UI优化 + 滚动条重构 + 页面交互修复 ([cdad78a](https://github.com/ntc0728/video-warehouse/commit/cdad78a830c7976a73aeb93dcb6c6877f9d2e8d0))
* UI重构 + IPTV代理修复 + 多项bug修复 ([12913f3](https://github.com/ntc0728/video-warehouse/commit/12913f3e1abb58650bca05fc3c181e0ecfba2e72))
* UniversalPlayer 控制栏增强 + UI 组件优化 + 样式修复 ([8a1a7d7](https://github.com/ntc0728/video-warehouse/commit/8a1a7d7fae1e35bdc32a48f67761c926d7217047))
* **version:** 引入 SemVer + release-please 自动版本与 Capacitor 双端同步 ([7226232](https://github.com/ntc0728/video-warehouse/commit/7226232015e5b4db30566e627cdd0634d3ad776b))
* 主题/动画/Design Token 调优 + IPTV 源数据更新 + UI 组件增强 ([c9a53c3](https://github.com/ntc0728/video-warehouse/commit/c9a53c369409d45b5efdf49e462a3608744244e3))
* 主题切换平滑过渡 + Browse 源状态弹层与详情页源检测一致 ([33a716d](https://github.com/ntc0728/video-warehouse/commit/33a716d2077e7abd287ce9ec6f2b27bd0db6c2b2))
* 卡片式布局升级 + 多页面 UI 优化 ([6b0469a](https://github.com/ntc0728/video-warehouse/commit/6b0469a2fcedf7ac79b39506707e4f4fa2191f57))
* 卡片模块 UI 风格（首页/侧边栏/顶栏/loading 卡片化，骨架扫光调速，仅桌面端生效） ([661e176](https://github.com/ntc0728/video-warehouse/commit/661e176d610ee705131e841be9a5a1085f1796b1))
* 历史页时间轴重构 — 圆点内联到分组标题行，竖线贯穿各节点 ([9532813](https://github.com/ntc0728/video-warehouse/commit/953281370c095dc0cf138a10b78e7417900d0c23))
* 批量修复 6 项 UI/行为问题 ([ebb453e](https://github.com/ntc0728/video-warehouse/commit/ebb453ee60b6cf1b077fa492d4e9195600166874))
* 搜索中心 + CMS 直链搜索 + 播放器优化 + 5项Bug修复 ([29963f0](https://github.com/ntc0728/video-warehouse/commit/29963f02c7ddf08098a818f9c3d5dcf14374dc47))
* 播放器交互优化 + IPTV 体验改进 + 设置项重构 ([ee90d2b](https://github.com/ntc0728/video-warehouse/commit/ee90d2b73f5355bfea6c60159a215294530f41c5))
* 播放器全面优化 + 首页Banner继续播放 + CSS设计令牌统一 ([53639e6](https://github.com/ntc0728/video-warehouse/commit/53639e6e916ee4f19cd381d4004b2473ce4fef1f))
* 播放流程入口测试 + 多页面 UI 优化 ([5129021](https://github.com/ntc0728/video-warehouse/commit/51290210c45ceee22735b1d399762bbb91f6845e))
* 新增 ConfirmDialog 组件 + CORS Proxy Worker + 各页样式优化 ([d607b72](https://github.com/ntc0728/video-warehouse/commit/d607b72a8e3cda8b1084a4b019a9a10ebb8688f3))
* 移动端UI优化 + 主题闪烁修复 + 设置页/首页/IPTV交互改进 ([3157f65](https://github.com/ntc0728/video-warehouse/commit/3157f6580478757a1e65e9a63d96ff49d68d391a))
* 详情页/人物页优化 + 播放器控制栏增强 + 动态页签标题 ([1655ecc](https://github.com/ntc0728/video-warehouse/commit/1655ecce131c115bd0e6f2c59aac74b713a2161e))
* 连接式导航布局 + Browse 双卡片重构 + 知识库同步 ([0d04981](https://github.com/ntc0728/video-warehouse/commit/0d049819b1b7ab0404255e8eaea2a257588dfa47))
* 页面级KeepAlive + 播放器重构 + TypeScript错误修复 + 构建优化 ([47f82c2](https://github.com/ntc0728/video-warehouse/commit/47f82c2bb8640fec3d38bffb62405e7bf35e5715))


### Bug Fixes

* **app-loading:** 移动端 AppLoading 全视口带卡片式布局，与桌面端一致 ([a22c8b5](https://github.com/ntc0728/video-warehouse/commit/a22c8b5259203dcabb3aa77e48ff626bf3e94ffc))
* Browse 刷新清空搜索词 + 历史页 tab 切换去重 + FilterBar 重构 + SearchBox 右键拦截 ([671b1d5](https://github.com/ntc0728/video-warehouse/commit/671b1d5389f2db797a9c7ce6ef9fd415589b8f4e))
* **browse:** useIsPhone 改为真实手机UA+App(非视口)，并补引入 BrowseMobileBar.css(此前未引入致移动端样式全失效)；移动端结果区去卡片外壳改全宽网格 ([cbc1998](https://github.com/ntc0728/video-warehouse/commit/cbc1998ed6503596624460da94a8070460349fd2))
* **browse:** 修复懒加载失效 + 统一 VideoCard 网格样式 ([941fc4d](https://github.com/ntc0728/video-warehouse/commit/941fc4de0172bcdd7ee4826128103745f161ac4a))
* **browse:** 切换筛选tab正确触发搜索中遮罩（换角度：快照hadData而非依赖discoverResults） ([f6c089c](https://github.com/ntc0728/video-warehouse/commit/f6c089cb31d8a346f79a03dba8e8581872e74906))
* **browse:** 清空搜索词后切到直链搜索时清空 CMS 残留数据 ([8b99337](https://github.com/ntc0728/video-warehouse/commit/8b99337c5cef195a537722ecf4d70191430ec052))
* **browse:** 移动端卡片布局改为镜像桌面端双卡片相连，整页随 app-shell 滚动 ([7a6f791](https://github.com/ntc0728/video-warehouse/commit/7a6f79199915a48d11978bd6c34316089593cef9))
* **browse:** 移动端命令栏对齐桌面端——激活tab文本#fff、亮色去背景、chip选中实色primary、删除排序按钮 ([2747944](https://github.com/ntc0728/video-warehouse/commit/27479448e739ca0aafe3ce95549cf05ffd0a3d8a))
* **browse:** 移动端布局仅真实手机web+App生效(useIsPhone)，命令栏对齐原型(模式段+排序+筛选入口+动态预设+说明+已选轨+面板为你推荐) ([b9de28e](https://github.com/ntc0728/video-warehouse/commit/b9de28e615e58702f98df539e4554edf11b58367))
* **browse:** 移动端布局增加视口&lt;768px触发；按钮缩小、重置/完成改胶囊；主题适配(#fff-&gt;var(--color-text-inverse)修复暗色不可见) ([d0a2387](https://github.com/ntc0728/video-warehouse/commit/d0a2387397e489effbb52f8f2164a542ab1466e4))
* **browse:** 移动端模式tab文本色对齐桌面端(secondary)，直链搜索隐藏bmb-rail ([81643b7](https://github.com/ntc0728/video-warehouse/commit/81643b769b9271a899bd7b479022c3b8fcc0da7c))
* **browse:** 移动端模式分段容器背景/边框对齐桌面端（surface + color-border） ([1c547c2](https://github.com/ntc0728/video-warehouse/commit/1c547c207dc898b7c083c683dfd9deab9d2b9c9d))
* **browse:** 移动端直链搜索模式隐藏排序/筛选入口与预设横滚 ([8c4d6b4](https://github.com/ntc0728/video-warehouse/commit/8c4d6b4b9f5f02db0ed2895b860ceb313cbfbdca))
* **browse:** 移动端直链搜索隐藏预设 + 整页卡片布局修复（结果区内部滚动） ([54027d3](https://github.com/ntc0728/video-warehouse/commit/54027d344841292acdfd3bfd3058d8876b9aaa74))
* **ci:** release-please 支持 PAT 绕过仓库 PR 创建权限限制 ([85e7f39](https://github.com/ntc0728/video-warehouse/commit/85e7f391e6159fe186bce87fa21595f68a215b6c))
* **detail:** 剧照在 Keep-Alive 隐藏加载后正确截断为 2 行 ([e600bc1](https://github.com/ntc0728/video-warehouse/commit/e600bc12dd2ca655d908a2676e6ab1db06f941bb))
* HeroBanner 缩略图 active 盒子缩放导致宽度不一致 + Detail 首次进入剧照截断/闪烁 ([eac50ad](https://github.com/ntc0728/video-warehouse/commit/eac50ad4fc9e0ecc99de185a3b1dbce2bbb3fd9b))
* HeroBanner 缩略图撑满 banner 高度 + 消除首屏双重 AppLoading ([6b21abe](https://github.com/ntc0728/video-warehouse/commit/6b21abe19ca935a5c478aa96c158886d0fc55eb3))
* **HeroBanner:** 修复 banner 切换后回退 crossfade 导致的闪烁 ([efe5865](https://github.com/ntc0728/video-warehouse/commit/efe5865ac7ac91398951e136ef8f434c152c1db3))
* **HeroBanner:** 修复切换分类越界导致整页白屏；切换时缩略图回骨架占位 ([739e7e3](https://github.com/ntc0728/video-warehouse/commit/739e7e347a42ee3beb8ec891273661685da151a1))
* **HeroBanner:** 修复右栏缩略图初始骨架宽度与真实不一致 ([56d6d4c](https://github.com/ntc0728/video-warehouse/commit/56d6d4c89d8b506922e427e441446515afdb1f33))
* **HeroBanner:** 修复缩略图切换时最后一个（新露出）缩略图闪烁 ([e1b61ab](https://github.com/ntc0728/video-warehouse/commit/e1b61abebea567c7f7b76d1e8c4fff009afbf1b7))
* **HeroBanner:** 彻底修复缩略图切换露白——改为预加载就绪后再换图 ([f607ed5](https://github.com/ntc0728/video-warehouse/commit/f607ed5d3eba4dcb8eafdd36026e6dbbf364ccf3))
* **home:** 修复首页 TMDBMovieRow 不显示 + banner 缩略图骨架不同步 ([282174a](https://github.com/ntc0728/video-warehouse/commit/282174a2e6009885153714f8918fcb6f6c0cc01f))
* IPTV 懒加载改边沿触发+隐藏期守卫，剧照 lightbox 用 Portal 修复高度与背景滚动锁定 ([4025a1d](https://github.com/ntc0728/video-warehouse/commit/4025a1da6a09bdef469906f98c6258fe92e1f910))
* m3u8-proxy 添加 User-Agent 解决 403 + 启动时同步 IPTV aggregatorUrl 避免首进无数据 ([b4734e8](https://github.com/ntc0728/video-warehouse/commit/b4734e8872bc669f844d9513302e8037ba754141))
* **record-shell:** 移动端 record-aside 用 space-md gap，对齐桌面端 edit-row 间距 ([ac75153](https://github.com/ntc0728/video-warehouse/commit/ac75153fa908db2057ef29164dd452d6e36d1bd7))
* **record-shell:** 移动端 record-aside 移除卡片式包裹，对齐桌面端纯布局条 ([81dce42](https://github.com/ntc0728/video-warehouse/commit/81dce42396a6a0993f76d062469e6ab1187e19cb))
* **record-shell:** 移动端 record-main 补 gap:space-sm，对齐桌面端内部间距 ([7cf3e18](https://github.com/ntc0728/video-warehouse/commit/7cf3e18e295bf5d21f0509ca27afe622c75a903b))
* resolve TypeScript build errors for Cloudflare Pages deployment ([1a805ba](https://github.com/ntc0728/video-warehouse/commit/1a805ba844c967e53f57fe92442fa19f8abf3db8))
* **Settings:** 补设置页进入过渡动画，消除进入僵硬感 ([223d5a2](https://github.com/ntc0728/video-warehouse/commit/223d5a28e37c2ced0f0519c336d14a5b6ee6f046))
* **styles:** 关于页版本/更新日志项移除 hover/focus 背景变色 ([9ef2f70](https://github.com/ntc0728/video-warehouse/commit/9ef2f70e64620011d5f757bdce8500a7841088c3))
* **styles:** 消除设置项按钮 active 时内部元素异常缩放/下沉 ([90c7c99](https://github.com/ntc0728/video-warehouse/commit/90c7c9920f175475a711c7f48d2243a95ae5f013))
* **styles:** 设置页按钮按压仅缩放内部文字、按钮框保持静止 ([4d4b300](https://github.com/ntc0728/video-warehouse/commit/4d4b3001be61da067dbdc6c5302d81e6953f5c08))
* **styles:** 设置页按钮改用 opacity 按压反馈（不缩放/不改背景） ([d0c8cd2](https://github.com/ntc0728/video-warehouse/commit/d0c8cd242c78fd9361732323291675c579ed27c4))
* **styles:** 设置项按压仅缩放文本自身宽度（标题收缩到 fit-content） ([f59b488](https://github.com/ntc0728/video-warehouse/commit/f59b488127a061889239742325b674f91ececc71))
* **style:** 方案6二次整改——缩放反馈一律不叠加 box-shadow；个人资料/导入导出/恢复默认仅文字缩放 ([7c22f08](https://github.com/ntc0728/video-warehouse/commit/7c22f0895dc90989737f9ebc6816ab3da9abd3dd))
* **style:** 方案6弹性回弹整改——补全侧边栏/顶栏、收敛 box-shadow、排除设置页全宽行、清除旧方案残留 ([ca3dda9](https://github.com/ntc0728/video-warehouse/commit/ca3dda9556c91118bcaa69212515a88d2878dbb7))
* **style:** 采用方案6弹性回弹替换全局按钮按压反馈 ([2af5c9a](https://github.com/ntc0728/video-warehouse/commit/2af5c9a025cd156371866be839f460584351a1bb))
* TMDB错误处理、CMS loading状态、Settings placeholder字体、Browse数据覆盖 ([cf2c764](https://github.com/ntc0728/video-warehouse/commit/cf2c76426d338bfbbfffd8ee5635d72f27ec60bb))
* **Transition:** 消除首页/分类页双重 AppLoading 并补全进入过渡动画 ([1d5654f](https://github.com/ntc0728/video-warehouse/commit/1d5654fac419c600982a2f6ec0f8b66b587cdbf6))
* 修复 7/28 页面过渡与侧边栏遗留问题 ([eabe0be](https://github.com/ntc0728/video-warehouse/commit/eabe0be16173344cbddb9d84bb699abda07d88e4))
* 修复 AppLayout.tsx 中 CustomScrollbar 拼写错误 ([4e92aa5](https://github.com/ntc0728/video-warehouse/commit/4e92aa5079e82ce59145ef9043e5dd8380949726))
* 修复 CSS 属性顺序和媒体查询语法 ([16fe0a8](https://github.com/ntc0728/video-warehouse/commit/16fe0a8e76854cf332256b38e885fafa7e001d49))
* 修复 DB 版本升级时整页卡在 loading 的问题 ([0439af6](https://github.com/ntc0728/video-warehouse/commit/0439af685922218c810a342da3fccd03c2bb29e5))
* 修复 HeroBanner 缩略图宽度跳变与 Detail 首进剧照不截断的真根因 ([5b27bfa](https://github.com/ntc0728/video-warehouse/commit/5b27bfab72184ba6748678854801860181b13107))
* 修复多重AppLoading闪烁/剧照分割/banner滑动/设置卡片/非首页trending ([28f2dab](https://github.com/ntc0728/video-warehouse/commit/28f2dabfd9305c9ec257d06af6315765d7a291b1))
* 修复播放列表立即播放的选集/线路回显与详情页 keep-alive ([0e4e713](https://github.com/ntc0728/video-warehouse/commit/0e4e71376d91563fc321db55ee5472e0c5f8894a))
* 修复缩略图骨架宽度与真实不一致（真实根因，非 HeroBanner） ([e16ec5a](https://github.com/ntc0728/video-warehouse/commit/e16ec5a28f491838a3541566834dadfcb7f612d4))
* 修复返回顶部/设置深链/Detail滚动恢复与标题/Browse标题 ([#1](https://github.com/ntc0728/video-warehouse/issues/1) [#3](https://github.com/ntc0728/video-warehouse/issues/3) [#4](https://github.com/ntc0728/video-warehouse/issues/4) [#5](https://github.com/ntc0728/video-warehouse/issues/5) [#6](https://github.com/ntc0728/video-warehouse/issues/6) [#7](https://github.com/ntc0728/video-warehouse/issues/7)) ([a91e4c0](https://github.com/ntc0728/video-warehouse/commit/a91e4c01babd81ffc22b951bd9b96749a82b7e8c))
* 全部弹窗实时订阅观看历史，修正返回后进度/百分比滞后 ([28fd59e](https://github.com/ntc0728/video-warehouse/commit/28fd59e77882393dfb662c55c87711bb9f63bb41))
* 引入分层 z-index 层级体系修复下拉框被侧边栏遮挡，合并页面进入动画统一、首页骨架一致性及 keep-alive store 等累积修复 ([5a9d24e](https://github.com/ntc0728/video-warehouse/commit/5a9d24eca1635d159d6fe22df19443e18c8736f0))
* 播放列表弹窗「播放中」标记按季隔离 ([c19f144](https://github.com/ntc0728/video-warehouse/commit/c19f1448bb07d32bb01b3fb55a59cb02d1598814))
* 播放列表弹窗抽屉层级与选季布局 ([846eb9d](https://github.com/ntc0728/video-warehouse/commit/846eb9ddd074d89e951313bd710e9c5287596b0f))
* 播放器核心逻辑修复 + UI优化 + 请求取消支持 ([02147e4](https://github.com/ntc0728/video-warehouse/commit/02147e4a6079c434a30d2cc3085bc52d6299ea6c))
* 播放进度按内容身份跨源共享（电影=videoId，剧集=videoId+季+集） ([fcf008f](https://github.com/ntc0728/video-warehouse/commit/fcf008f0e07c89f38843e8a0a72cebc1e372f08c))
* 播放页按历史进度恢复选集/线路（点击源卡片立即播放场景） ([6d04149](https://github.com/ntc0728/video-warehouse/commit/6d041491dee670efba50bfee018b2024c2771a79))
* 移除 StickyHeader 未使用的 isBrowse 变量，修复 TS6133 编译错误 ([cda1067](https://github.com/ntc0728/video-warehouse/commit/cda106746db6927ec76255130436c2237bccf63d))
* 移除 useTMDBStore 中未使用的 _totalResults 变量，修复 tsc -b 构建失败 ([f4b7601](https://github.com/ntc0728/video-warehouse/commit/f4b76014ce5b4a7ee113895597dcde5f408d8742))
* 移除详情页hero item多余背景色 ([4352391](https://github.com/ntc0728/video-warehouse/commit/435239117e8192f063eca3521100a49ea8800512))
* 返回后浏览器页签标题停留在旧页（Keep-Alive 多页竞态） ([44a6f06](https://github.com/ntc0728/video-warehouse/commit/44a6f064a4200d457c103500aa095d355c57165f))
* 还原 7/28 误删的 Browse 页面样式（e4514b4 过度删除） ([0d53286](https://github.com/ntc0728/video-warehouse/commit/0d532860e0b832941f3edd34ffa3834aa4bf4956))
* 选源优先级修正——routeSourceIndex 优先于历史记录，点哪个源播哪个源 ([c73fe1e](https://github.com/ntc0728/video-warehouse/commit/c73fe1eb70ac140226c761e8e1301c6c9f6947fc))
* 首页分类跳转 Browse 页搜索筛选联动 ([9ba1be5](https://github.com/ntc0728/video-warehouse/commit/9ba1be5172332765d1f4de0abac583452e842e84))


### Performance Improvements

* AppLayout 侧边栏折叠 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 ([d811da0](https://github.com/ntc0728/video-warehouse/commit/d811da081846e4f002e30c35713fb4322c79b6a7))
* AppLayout 侧边栏折叠改用 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 ([76a656a](https://github.com/ntc0728/video-warehouse/commit/76a656a1eecbdb383b10ffbd1c31f44f5324e368))
* Browse.css 去掉废弃的 browse-fade-in 进入动画（统一用 stagger） ([e4514b4](https://github.com/ntc0728/video-warehouse/commit/e4514b4b45989e8067b8af65e1245a109b38e0c2))
* HeroBanner 轮播图性能优化 — 使用 Swiper 替换自定义实现 ([8c2901e](https://github.com/ntc0728/video-warehouse/commit/8c2901e985da0a8a15d45bccb8337971cb96b0f6))
* HomeSidebar.css 同步方案 B 改造（去掉 width transition） ([25764b9](https://github.com/ntc0728/video-warehouse/commit/25764b9152db2121352624fe098258e1f1581738))
* HomeSidebar.tsx 注释同步 + RecordShell 统一用 stagger 变体 ([3aff037](https://github.com/ntc0728/video-warehouse/commit/3aff037cc724fa513191e144dec44610271a5022))
* **Home:** 用 useDeferredValue 解耦侧边栏分类切换的高亮与重内容渲染 ([a2af678](https://github.com/ntc0728/video-warehouse/commit/a2af678756e89bde8bd534bf20fe2c096e26890e))
* Layout.css + HomeSidebar.css 方案 B 改造（变量驱动 width，去 transition） ([bf9ba58](https://github.com/ntc0728/video-warehouse/commit/bf9ba58236254c6f3df7671ad681708c59754af2))
* **Layout:** 移除 View Transitions API + 优化 Keep-Alive 容器渲染 ([a567107](https://github.com/ntc0728/video-warehouse/commit/a5671073bfd66b0b0dd40fee0f1186e64346d91f))
* 侧边栏折叠 transform 补偿 + 统一页面进入过渡动画（核心样式/布局） ([6e373c2](https://github.com/ntc0728/video-warehouse/commit/6e373c21df8b4f4fab7d5d86965b69c1335235b5))
* 侧边栏折叠改用 transform 补偿 + 统一页面进入过渡动画（三套变体） ([678e58c](https://github.com/ntc0728/video-warehouse/commit/678e58c060d1c65909dccf085f9a1342ea30ee16))
* 侧边栏折叠改用 transform 补偿方案 + 统一页面进入过渡动画（1/2：核心样式） ([b48a153](https://github.com/ntc0728/video-warehouse/commit/b48a153f944749fb21fe7d942cb9ad844a191572))


### Reverts

* 撤销 play 页选源回归改动（恢复原始 routeSourceIndex 判断） ([585ef0c](https://github.com/ntc0728/video-warehouse/commit/585ef0c1c28d82912e261e9a7abd87400fb8f748))

## 1.0.0 (2026-07-30)


### Features

* **browse:** 切换直链搜索tab跳过重复查询、双卡片相连、切换筛选触发搜索中 ([869dbf2](https://github.com/ntc0728/video-warehouse/commit/869dbf2496cf9becc79de3a39278a2551ecde2c4))
* **browse:** 移动端整页以卡片式布局包裹（isPhone / 视口&lt;768px） ([940b4b2](https://github.com/ntc0728/video-warehouse/commit/940b4b2f511f69ea943b91726b368943b5673e9f))
* **browse:** 移动端方案②命令栏+右滑全屏筛选面板，动态预设（trending+记忆），桌面移除更新中并全展开筛选tab ([63a102c](https://github.com/ntc0728/video-warehouse/commit/63a102cf9e3d4bd01a4dc77c4288cf1e64221cea))
* DASH播放器支持 + 时移回看 + UI组件增强 + README更新 ([6418432](https://github.com/ntc0728/video-warehouse/commit/6418432e25836b391939e8eb238bafa82ce2b98f))
* EPG 节目单 + UniversalPlayer OSD 与各页样式迭代 ([6923a65](https://github.com/ntc0728/video-warehouse/commit/6923a650ab52a3f7edec905cd7e5c443afde39a5))
* HeroBanner UI 优化 + TMDB Mock 测试保护 + 全页面测试用例 + Bug 修复 ([3c31bc1](https://github.com/ntc0728/video-warehouse/commit/3c31bc1241aa959b4d0bd4edd4af7f54417c6040))
* HeroBanner 滑动切换动画 + Capacitor 原生支持 + UI/播放器优化 ([2c1f09f](https://github.com/ntc0728/video-warehouse/commit/2c1f09ff167cd5e31120275a528f77150bdd7ddf))
* IPTV 播放器优化 + 接口滥用修复 + UI 调整 + 构建优化 ([90f80f0](https://github.com/ntc0728/video-warehouse/commit/90f80f0e81767623ab2496034a250e12e17ff7db))
* IPTV/设置页UI优化 + 播放器交互改进 + Loading居中修复 ([cd68289](https://github.com/ntc0728/video-warehouse/commit/cd6828909f4e62cdd8dcb8e8549c1e8a2caa5560))
* **iptv:** 修复双层滚动冲突 + 修复懒加载 120 卡死 + 同步 UI 组件库 ([94aa6e2](https://github.com/ntc0728/video-warehouse/commit/94aa6e2f63bd378cf437978d594a0cd62a4b1841))
* IPTV移动端OSD控制栏适配 + 播放器头部全屏按钮 + 页面左右padding统一 ([9223c60](https://github.com/ntc0728/video-warehouse/commit/9223c60f96e9baae4cad17f051738cc1022bf489))
* migrate HeroBanner from Swiper to Embla Carousel ([3d3313b](https://github.com/ntc0728/video-warehouse/commit/3d3313ba0c66c3ccecfd707190082784ebf55903))
* player UI improvements and Browse page cleanup ([7ac36fa](https://github.com/ntc0728/video-warehouse/commit/7ac36fa0ca5749b6eb44bdd9774f310b6e1a48fd))
* Player 页 UI 整改 — 连播导航/overview展开/空态主题/超时重试/代码清理 ([4eb6fb2](https://github.com/ntc0728/video-warehouse/commit/4eb6fb2c1126a26e5228e20f044b1f748ea90223))
* **Player:** 选季面板 + 选集排序/下拉 + 播放按钮/收藏样式优化 ([b9f2a77](https://github.com/ntc0728/video-warehouse/commit/b9f2a7773a931dc8af1c71400e22fd43743afd7b))
* RecordShell 共用外壳 + Browse 懒加载修复 + 页面原理图与流程图 + AI Agent 指南 ([0e98ad6](https://github.com/ntc0728/video-warehouse/commit/0e98ad69099306f774d2e8d9da23578d815cebc7))
* shadcn/ui迁移 + 动画增强 + 主题换肤系统 + Bug修复 ([da7fa05](https://github.com/ntc0728/video-warehouse/commit/da7fa05bfdf40578f423629f7d3f0bf6ebc25412))
* TMDB 服务 — 类型扩展 + 接口增强 + Store 更新 ([8ea4139](https://github.com/ntc0728/video-warehouse/commit/8ea4139f22a897fbf9f6a4b7b7ad72f6da553714))
* UI 交互优化 + 路由过渡动画 + Design Token 调整 + 移动端适配 ([7de343c](https://github.com/ntc0728/video-warehouse/commit/7de343cfca080f6ffbbc34f65a7f36bf41bcefe5))
* UI优化 + IPTV修复 + README文档 + Playwright测试框架 ([0026d76](https://github.com/ntc0728/video-warehouse/commit/0026d766f4e49b753aeecb8f306b1e30fd2fbf83))
* UI优化 + 播放器改进 + 测试基础设施 + 文档更新 + videoService编码修复 ([6612219](https://github.com/ntc0728/video-warehouse/commit/661221926aa003ffcd4d61923871ce61dfd3e7fd))
* UI优化 + 滚动条重构 + 页面交互修复 ([cdad78a](https://github.com/ntc0728/video-warehouse/commit/cdad78a830c7976a73aeb93dcb6c6877f9d2e8d0))
* UI重构 + IPTV代理修复 + 多项bug修复 ([12913f3](https://github.com/ntc0728/video-warehouse/commit/12913f3e1abb58650bca05fc3c181e0ecfba2e72))
* UniversalPlayer 控制栏增强 + UI 组件优化 + 样式修复 ([8a1a7d7](https://github.com/ntc0728/video-warehouse/commit/8a1a7d7fae1e35bdc32a48f67761c926d7217047))
* **version:** 引入 SemVer + release-please 自动版本与 Capacitor 双端同步 ([7226232](https://github.com/ntc0728/video-warehouse/commit/7226232015e5b4db30566e627cdd0634d3ad776b))
* 主题/动画/Design Token 调优 + IPTV 源数据更新 + UI 组件增强 ([c9a53c3](https://github.com/ntc0728/video-warehouse/commit/c9a53c369409d45b5efdf49e462a3608744244e3))
* 主题切换平滑过渡 + Browse 源状态弹层与详情页源检测一致 ([33a716d](https://github.com/ntc0728/video-warehouse/commit/33a716d2077e7abd287ce9ec6f2b27bd0db6c2b2))
* 卡片式布局升级 + 多页面 UI 优化 ([6b0469a](https://github.com/ntc0728/video-warehouse/commit/6b0469a2fcedf7ac79b39506707e4f4fa2191f57))
* 卡片模块 UI 风格（首页/侧边栏/顶栏/loading 卡片化，骨架扫光调速，仅桌面端生效） ([661e176](https://github.com/ntc0728/video-warehouse/commit/661e176d610ee705131e841be9a5a1085f1796b1))
* 历史页时间轴重构 — 圆点内联到分组标题行，竖线贯穿各节点 ([9532813](https://github.com/ntc0728/video-warehouse/commit/953281370c095dc0cf138a10b78e7417900d0c23))
* 批量修复 6 项 UI/行为问题 ([ebb453e](https://github.com/ntc0728/video-warehouse/commit/ebb453ee60b6cf1b077fa492d4e9195600166874))
* 搜索中心 + CMS 直链搜索 + 播放器优化 + 5项Bug修复 ([29963f0](https://github.com/ntc0728/video-warehouse/commit/29963f02c7ddf08098a818f9c3d5dcf14374dc47))
* 播放器交互优化 + IPTV 体验改进 + 设置项重构 ([ee90d2b](https://github.com/ntc0728/video-warehouse/commit/ee90d2b73f5355bfea6c60159a215294530f41c5))
* 播放器全面优化 + 首页Banner继续播放 + CSS设计令牌统一 ([53639e6](https://github.com/ntc0728/video-warehouse/commit/53639e6e916ee4f19cd381d4004b2473ce4fef1f))
* 播放流程入口测试 + 多页面 UI 优化 ([5129021](https://github.com/ntc0728/video-warehouse/commit/51290210c45ceee22735b1d399762bbb91f6845e))
* 新增 ConfirmDialog 组件 + CORS Proxy Worker + 各页样式优化 ([d607b72](https://github.com/ntc0728/video-warehouse/commit/d607b72a8e3cda8b1084a4b019a9a10ebb8688f3))
* 移动端UI优化 + 主题闪烁修复 + 设置页/首页/IPTV交互改进 ([3157f65](https://github.com/ntc0728/video-warehouse/commit/3157f6580478757a1e65e9a63d96ff49d68d391a))
* 详情页/人物页优化 + 播放器控制栏增强 + 动态页签标题 ([1655ecc](https://github.com/ntc0728/video-warehouse/commit/1655ecce131c115bd0e6f2c59aac74b713a2161e))
* 连接式导航布局 + Browse 双卡片重构 + 知识库同步 ([0d04981](https://github.com/ntc0728/video-warehouse/commit/0d049819b1b7ab0404255e8eaea2a257588dfa47))
* 页面级KeepAlive + 播放器重构 + TypeScript错误修复 + 构建优化 ([47f82c2](https://github.com/ntc0728/video-warehouse/commit/47f82c2bb8640fec3d38bffb62405e7bf35e5715))


### Bug Fixes

* **app-loading:** 移动端 AppLoading 全视口带卡片式布局，与桌面端一致 ([a22c8b5](https://github.com/ntc0728/video-warehouse/commit/a22c8b5259203dcabb3aa77e48ff626bf3e94ffc))
* Browse 刷新清空搜索词 + 历史页 tab 切换去重 + FilterBar 重构 + SearchBox 右键拦截 ([671b1d5](https://github.com/ntc0728/video-warehouse/commit/671b1d5389f2db797a9c7ce6ef9fd415589b8f4e))
* **browse:** useIsPhone 改为真实手机UA+App(非视口)，并补引入 BrowseMobileBar.css(此前未引入致移动端样式全失效)；移动端结果区去卡片外壳改全宽网格 ([cbc1998](https://github.com/ntc0728/video-warehouse/commit/cbc1998ed6503596624460da94a8070460349fd2))
* **browse:** 修复懒加载失效 + 统一 VideoCard 网格样式 ([941fc4d](https://github.com/ntc0728/video-warehouse/commit/941fc4de0172bcdd7ee4826128103745f161ac4a))
* **browse:** 切换筛选tab正确触发搜索中遮罩（换角度：快照hadData而非依赖discoverResults） ([f6c089c](https://github.com/ntc0728/video-warehouse/commit/f6c089cb31d8a346f79a03dba8e8581872e74906))
* **browse:** 清空搜索词后切到直链搜索时清空 CMS 残留数据 ([8b99337](https://github.com/ntc0728/video-warehouse/commit/8b99337c5cef195a537722ecf4d70191430ec052))
* **browse:** 移动端卡片布局改为镜像桌面端双卡片相连，整页随 app-shell 滚动 ([7a6f791](https://github.com/ntc0728/video-warehouse/commit/7a6f79199915a48d11978bd6c34316089593cef9))
* **browse:** 移动端命令栏对齐桌面端——激活tab文本#fff、亮色去背景、chip选中实色primary、删除排序按钮 ([2747944](https://github.com/ntc0728/video-warehouse/commit/27479448e739ca0aafe3ce95549cf05ffd0a3d8a))
* **browse:** 移动端布局仅真实手机web+App生效(useIsPhone)，命令栏对齐原型(模式段+排序+筛选入口+动态预设+说明+已选轨+面板为你推荐) ([b9de28e](https://github.com/ntc0728/video-warehouse/commit/b9de28e615e58702f98df539e4554edf11b58367))
* **browse:** 移动端布局增加视口&lt;768px触发；按钮缩小、重置/完成改胶囊；主题适配(#fff-&gt;var(--color-text-inverse)修复暗色不可见) ([d0a2387](https://github.com/ntc0728/video-warehouse/commit/d0a2387397e489effbb52f8f2164a542ab1466e4))
* **browse:** 移动端模式tab文本色对齐桌面端(secondary)，直链搜索隐藏bmb-rail ([81643b7](https://github.com/ntc0728/video-warehouse/commit/81643b769b9271a899bd7b479022c3b8fcc0da7c))
* **browse:** 移动端模式分段容器背景/边框对齐桌面端（surface + color-border） ([1c547c2](https://github.com/ntc0728/video-warehouse/commit/1c547c207dc898b7c083c683dfd9deab9d2b9c9d))
* **browse:** 移动端直链搜索模式隐藏排序/筛选入口与预设横滚 ([8c4d6b4](https://github.com/ntc0728/video-warehouse/commit/8c4d6b4b9f5f02db0ed2895b860ceb313cbfbdca))
* **browse:** 移动端直链搜索隐藏预设 + 整页卡片布局修复（结果区内部滚动） ([54027d3](https://github.com/ntc0728/video-warehouse/commit/54027d344841292acdfd3bfd3058d8876b9aaa74))
* **detail:** 剧照在 Keep-Alive 隐藏加载后正确截断为 2 行 ([e600bc1](https://github.com/ntc0728/video-warehouse/commit/e600bc12dd2ca655d908a2676e6ab1db06f941bb))
* HeroBanner 缩略图 active 盒子缩放导致宽度不一致 + Detail 首次进入剧照截断/闪烁 ([eac50ad](https://github.com/ntc0728/video-warehouse/commit/eac50ad4fc9e0ecc99de185a3b1dbce2bbb3fd9b))
* HeroBanner 缩略图撑满 banner 高度 + 消除首屏双重 AppLoading ([6b21abe](https://github.com/ntc0728/video-warehouse/commit/6b21abe19ca935a5c478aa96c158886d0fc55eb3))
* **HeroBanner:** 修复 banner 切换后回退 crossfade 导致的闪烁 ([efe5865](https://github.com/ntc0728/video-warehouse/commit/efe5865ac7ac91398951e136ef8f434c152c1db3))
* **HeroBanner:** 修复切换分类越界导致整页白屏；切换时缩略图回骨架占位 ([739e7e3](https://github.com/ntc0728/video-warehouse/commit/739e7e347a42ee3beb8ec891273661685da151a1))
* **HeroBanner:** 修复右栏缩略图初始骨架宽度与真实不一致 ([56d6d4c](https://github.com/ntc0728/video-warehouse/commit/56d6d4c89d8b506922e427e441446515afdb1f33))
* **HeroBanner:** 修复缩略图切换时最后一个（新露出）缩略图闪烁 ([e1b61ab](https://github.com/ntc0728/video-warehouse/commit/e1b61abebea567c7f7b76d1e8c4fff009afbf1b7))
* **HeroBanner:** 彻底修复缩略图切换露白——改为预加载就绪后再换图 ([f607ed5](https://github.com/ntc0728/video-warehouse/commit/f607ed5d3eba4dcb8eafdd36026e6dbbf364ccf3))
* **home:** 修复首页 TMDBMovieRow 不显示 + banner 缩略图骨架不同步 ([282174a](https://github.com/ntc0728/video-warehouse/commit/282174a2e6009885153714f8918fcb6f6c0cc01f))
* IPTV 懒加载改边沿触发+隐藏期守卫，剧照 lightbox 用 Portal 修复高度与背景滚动锁定 ([4025a1d](https://github.com/ntc0728/video-warehouse/commit/4025a1da6a09bdef469906f98c6258fe92e1f910))
* m3u8-proxy 添加 User-Agent 解决 403 + 启动时同步 IPTV aggregatorUrl 避免首进无数据 ([b4734e8](https://github.com/ntc0728/video-warehouse/commit/b4734e8872bc669f844d9513302e8037ba754141))
* **record-shell:** 移动端 record-aside 用 space-md gap，对齐桌面端 edit-row 间距 ([ac75153](https://github.com/ntc0728/video-warehouse/commit/ac75153fa908db2057ef29164dd452d6e36d1bd7))
* **record-shell:** 移动端 record-aside 移除卡片式包裹，对齐桌面端纯布局条 ([81dce42](https://github.com/ntc0728/video-warehouse/commit/81dce42396a6a0993f76d062469e6ab1187e19cb))
* **record-shell:** 移动端 record-main 补 gap:space-sm，对齐桌面端内部间距 ([7cf3e18](https://github.com/ntc0728/video-warehouse/commit/7cf3e18e295bf5d21f0509ca27afe622c75a903b))
* resolve TypeScript build errors for Cloudflare Pages deployment ([1a805ba](https://github.com/ntc0728/video-warehouse/commit/1a805ba844c967e53f57fe92442fa19f8abf3db8))
* **Settings:** 补设置页进入过渡动画，消除进入僵硬感 ([223d5a2](https://github.com/ntc0728/video-warehouse/commit/223d5a28e37c2ced0f0519c336d14a5b6ee6f046))
* **styles:** 关于页版本/更新日志项移除 hover/focus 背景变色 ([9ef2f70](https://github.com/ntc0728/video-warehouse/commit/9ef2f70e64620011d5f757bdce8500a7841088c3))
* **styles:** 消除设置项按钮 active 时内部元素异常缩放/下沉 ([90c7c99](https://github.com/ntc0728/video-warehouse/commit/90c7c9920f175475a711c7f48d2243a95ae5f013))
* **styles:** 设置页按钮按压仅缩放内部文字、按钮框保持静止 ([4d4b300](https://github.com/ntc0728/video-warehouse/commit/4d4b3001be61da067dbdc6c5302d81e6953f5c08))
* **styles:** 设置页按钮改用 opacity 按压反馈（不缩放/不改背景） ([d0c8cd2](https://github.com/ntc0728/video-warehouse/commit/d0c8cd242c78fd9361732323291675c579ed27c4))
* **styles:** 设置项按压仅缩放文本自身宽度（标题收缩到 fit-content） ([f59b488](https://github.com/ntc0728/video-warehouse/commit/f59b488127a061889239742325b674f91ececc71))
* **style:** 方案6二次整改——缩放反馈一律不叠加 box-shadow；个人资料/导入导出/恢复默认仅文字缩放 ([7c22f08](https://github.com/ntc0728/video-warehouse/commit/7c22f0895dc90989737f9ebc6816ab3da9abd3dd))
* **style:** 方案6弹性回弹整改——补全侧边栏/顶栏、收敛 box-shadow、排除设置页全宽行、清除旧方案残留 ([ca3dda9](https://github.com/ntc0728/video-warehouse/commit/ca3dda9556c91118bcaa69212515a88d2878dbb7))
* **style:** 采用方案6弹性回弹替换全局按钮按压反馈 ([2af5c9a](https://github.com/ntc0728/video-warehouse/commit/2af5c9a025cd156371866be839f460584351a1bb))
* TMDB错误处理、CMS loading状态、Settings placeholder字体、Browse数据覆盖 ([cf2c764](https://github.com/ntc0728/video-warehouse/commit/cf2c76426d338bfbbfffd8ee5635d72f27ec60bb))
* **Transition:** 消除首页/分类页双重 AppLoading 并补全进入过渡动画 ([1d5654f](https://github.com/ntc0728/video-warehouse/commit/1d5654fac419c600982a2f6ec0f8b66b587cdbf6))
* 修复 7/28 页面过渡与侧边栏遗留问题 ([eabe0be](https://github.com/ntc0728/video-warehouse/commit/eabe0be16173344cbddb9d84bb699abda07d88e4))
* 修复 AppLayout.tsx 中 CustomScrollbar 拼写错误 ([4e92aa5](https://github.com/ntc0728/video-warehouse/commit/4e92aa5079e82ce59145ef9043e5dd8380949726))
* 修复 CSS 属性顺序和媒体查询语法 ([16fe0a8](https://github.com/ntc0728/video-warehouse/commit/16fe0a8e76854cf332256b38e885fafa7e001d49))
* 修复 DB 版本升级时整页卡在 loading 的问题 ([0439af6](https://github.com/ntc0728/video-warehouse/commit/0439af685922218c810a342da3fccd03c2bb29e5))
* 修复 HeroBanner 缩略图宽度跳变与 Detail 首进剧照不截断的真根因 ([5b27bfa](https://github.com/ntc0728/video-warehouse/commit/5b27bfab72184ba6748678854801860181b13107))
* 修复多重AppLoading闪烁/剧照分割/banner滑动/设置卡片/非首页trending ([28f2dab](https://github.com/ntc0728/video-warehouse/commit/28f2dabfd9305c9ec257d06af6315765d7a291b1))
* 修复播放列表立即播放的选集/线路回显与详情页 keep-alive ([0e4e713](https://github.com/ntc0728/video-warehouse/commit/0e4e71376d91563fc321db55ee5472e0c5f8894a))
* 修复缩略图骨架宽度与真实不一致（真实根因，非 HeroBanner） ([e16ec5a](https://github.com/ntc0728/video-warehouse/commit/e16ec5a28f491838a3541566834dadfcb7f612d4))
* 修复返回顶部/设置深链/Detail滚动恢复与标题/Browse标题 ([#1](https://github.com/ntc0728/video-warehouse/issues/1) [#3](https://github.com/ntc0728/video-warehouse/issues/3) [#4](https://github.com/ntc0728/video-warehouse/issues/4) [#5](https://github.com/ntc0728/video-warehouse/issues/5) [#6](https://github.com/ntc0728/video-warehouse/issues/6) [#7](https://github.com/ntc0728/video-warehouse/issues/7)) ([a91e4c0](https://github.com/ntc0728/video-warehouse/commit/a91e4c01babd81ffc22b951bd9b96749a82b7e8c))
* 全部弹窗实时订阅观看历史，修正返回后进度/百分比滞后 ([28fd59e](https://github.com/ntc0728/video-warehouse/commit/28fd59e77882393dfb662c55c87711bb9f63bb41))
* 引入分层 z-index 层级体系修复下拉框被侧边栏遮挡，合并页面进入动画统一、首页骨架一致性及 keep-alive store 等累积修复 ([5a9d24e](https://github.com/ntc0728/video-warehouse/commit/5a9d24eca1635d159d6fe22df19443e18c8736f0))
* 播放列表弹窗「播放中」标记按季隔离 ([c19f144](https://github.com/ntc0728/video-warehouse/commit/c19f1448bb07d32bb01b3fb55a59cb02d1598814))
* 播放列表弹窗抽屉层级与选季布局 ([846eb9d](https://github.com/ntc0728/video-warehouse/commit/846eb9ddd074d89e951313bd710e9c5287596b0f))
* 播放器核心逻辑修复 + UI优化 + 请求取消支持 ([02147e4](https://github.com/ntc0728/video-warehouse/commit/02147e4a6079c434a30d2cc3085bc52d6299ea6c))
* 播放进度按内容身份跨源共享（电影=videoId，剧集=videoId+季+集） ([fcf008f](https://github.com/ntc0728/video-warehouse/commit/fcf008f0e07c89f38843e8a0a72cebc1e372f08c))
* 播放页按历史进度恢复选集/线路（点击源卡片立即播放场景） ([6d04149](https://github.com/ntc0728/video-warehouse/commit/6d041491dee670efba50bfee018b2024c2771a79))
* 移除 StickyHeader 未使用的 isBrowse 变量，修复 TS6133 编译错误 ([cda1067](https://github.com/ntc0728/video-warehouse/commit/cda106746db6927ec76255130436c2237bccf63d))
* 移除 useTMDBStore 中未使用的 _totalResults 变量，修复 tsc -b 构建失败 ([f4b7601](https://github.com/ntc0728/video-warehouse/commit/f4b76014ce5b4a7ee113895597dcde5f408d8742))
* 移除详情页hero item多余背景色 ([4352391](https://github.com/ntc0728/video-warehouse/commit/435239117e8192f063eca3521100a49ea8800512))
* 返回后浏览器页签标题停留在旧页（Keep-Alive 多页竞态） ([44a6f06](https://github.com/ntc0728/video-warehouse/commit/44a6f064a4200d457c103500aa095d355c57165f))
* 还原 7/28 误删的 Browse 页面样式（e4514b4 过度删除） ([0d53286](https://github.com/ntc0728/video-warehouse/commit/0d532860e0b832941f3edd34ffa3834aa4bf4956))
* 选源优先级修正——routeSourceIndex 优先于历史记录，点哪个源播哪个源 ([c73fe1e](https://github.com/ntc0728/video-warehouse/commit/c73fe1eb70ac140226c761e8e1301c6c9f6947fc))
* 首页分类跳转 Browse 页搜索筛选联动 ([9ba1be5](https://github.com/ntc0728/video-warehouse/commit/9ba1be5172332765d1f4de0abac583452e842e84))


### Performance Improvements

* AppLayout 侧边栏折叠 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 ([d811da0](https://github.com/ntc0728/video-warehouse/commit/d811da081846e4f002e30c35713fb4322c79b6a7))
* AppLayout 侧边栏折叠改用 WAAPI transform 补偿（方案 B）+ Keep-Alive 进入动画重放选择器收敛 ([76a656a](https://github.com/ntc0728/video-warehouse/commit/76a656a1eecbdb383b10ffbd1c31f44f5324e368))
* Browse.css 去掉废弃的 browse-fade-in 进入动画（统一用 stagger） ([e4514b4](https://github.com/ntc0728/video-warehouse/commit/e4514b4b45989e8067b8af65e1245a109b38e0c2))
* HeroBanner 轮播图性能优化 — 使用 Swiper 替换自定义实现 ([8c2901e](https://github.com/ntc0728/video-warehouse/commit/8c2901e985da0a8a15d45bccb8337971cb96b0f6))
* HomeSidebar.css 同步方案 B 改造（去掉 width transition） ([25764b9](https://github.com/ntc0728/video-warehouse/commit/25764b9152db2121352624fe098258e1f1581738))
* HomeSidebar.tsx 注释同步 + RecordShell 统一用 stagger 变体 ([3aff037](https://github.com/ntc0728/video-warehouse/commit/3aff037cc724fa513191e144dec44610271a5022))
* **Home:** 用 useDeferredValue 解耦侧边栏分类切换的高亮与重内容渲染 ([a2af678](https://github.com/ntc0728/video-warehouse/commit/a2af678756e89bde8bd534bf20fe2c096e26890e))
* Layout.css + HomeSidebar.css 方案 B 改造（变量驱动 width，去 transition） ([bf9ba58](https://github.com/ntc0728/video-warehouse/commit/bf9ba58236254c6f3df7671ad681708c59754af2))
* **Layout:** 移除 View Transitions API + 优化 Keep-Alive 容器渲染 ([a567107](https://github.com/ntc0728/video-warehouse/commit/a5671073bfd66b0b0dd40fee0f1186e64346d91f))
* 侧边栏折叠 transform 补偿 + 统一页面进入过渡动画（核心样式/布局） ([6e373c2](https://github.com/ntc0728/video-warehouse/commit/6e373c21df8b4f4fab7d5d86965b69c1335235b5))
* 侧边栏折叠改用 transform 补偿 + 统一页面进入过渡动画（三套变体） ([678e58c](https://github.com/ntc0728/video-warehouse/commit/678e58c060d1c65909dccf085f9a1342ea30ee16))
* 侧边栏折叠改用 transform 补偿方案 + 统一页面进入过渡动画（1/2：核心样式） ([b48a153](https://github.com/ntc0728/video-warehouse/commit/b48a153f944749fb21fe7d942cb9ad844a191572))


### Reverts

* 撤销 play 页选源回归改动（恢复原始 routeSourceIndex 判断） ([585ef0c](https://github.com/ntc0728/video-warehouse/commit/585ef0c1c28d82912e261e9a7abd87400fb8f748))

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
- Android 端 `versionCode` 由 `scripts/sync-capacitor-version.mjs` 在 `build:android` 时从版本号自动派生
