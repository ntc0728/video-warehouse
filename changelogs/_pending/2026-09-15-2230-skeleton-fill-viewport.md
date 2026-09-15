# 2026-09-15 22:30 骨架视口填满：启动骨架全 shape + 页级骨架续行

## 背景

上一轮把页级骨架张数改成「列数 × ROWS」派生，但首屏仍有两处不满：
启动骨架 home 形态是静态 HTML（hero + 1 行海报），宽屏下「2 行不到」；
固定 ROWS=3 在高视口（≥1440 高）或 16:9 / 3:2 网格下够不到视口底。

## 改动

### 启动骨架（index.html）

- 新增 `fillRows(host, maker, withSec)`：按 `body.scrollHeight` 逐行补占位块，
  直到「视口高 − header − 48（底部提示区预留）」；宁多不缺，超出被
  overflow:hidden 裁掉（与真实页「网格自然溢出首屏」同观感）；guard 24 次
  防异常视口死循环。列数仍由 CSS 档位唯一决定，JS 不另估行高。
- 九种 shape 全部接入 FILL 表（play / 未知路由 plain 不补）：
  home（poster 行 + sec 分区头，对齐真实首页节奏）、browse、chart（列表）、
  collections（channel 行 + sec）、history（record 行）、iptv（补进
  `.bs-split__main`）、detail / person（lines 文本块）。
- home 不再提前 return：静态 HTML 保留为无 JS 兜底，脚本在首帧绘制前按视口补行。
- `.bs-tip` 改为绝对定位钉在视口底：内容填满后提示不再被推出裁剪区。
- 填充粒度从整块 cloneNode 改为行级构造（browse 16 卡一块太粗，会整块溢出）。

### 页级骨架（React）

- 新增 `src/hooks/useFillRows.ts`：首帧渲染后量根容器
  `getBoundingClientRect().bottom`，未到「视口高 − reserve」就 `extra+1`
  （调用方渲染 `cols × (ROWS + extra)`），useLayoutEffect 同步收敛不闪屏；
  maxRows 兜底；cols 变化（跨断点）时重置重新收敛。与 useGridCols 同一哲学：
  只量渲染结果、不在 JS 里估行高，高度真源仍是 CSS。
- 接入：BrowseSkeleton / CollectionsSkeleton（影视网格）/
  IPTVSkeleton（频道网格，含刷新占位）/ PersonSkeleton（作品网格）/
  DetailSkeleton（简介行，每步 +2 行）。首页骨架（hero + 7 横滚行）本就
  超出视口，不接。

## 验证

- tsc -b 0 error；ESLint 改动文件 0 error 0 warning；vite build 成功
  （注意：本机 Git Bash 环境下 vite build 确定性报
  `html-inline-proxy No matching HTML proxy module`，HEAD 同样复现 ——
  是 Bash shim 的 cwd/路径解析问题，经 PowerShell `Start-Process` 构建成功，
  与代码无关）。
- jsdom 冒烟测试（scrollHeight stub 为 60px/块伪布局）11 用例全过：
  9 个填充 shape 均补至目标高度，play / plain 不补，guard 生效。
