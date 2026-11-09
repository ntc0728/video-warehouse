/**
 * EdgeOne Pages 构建机 nofile 硬上限过低且不可提升（ulimit -n 报 Operation not permitted），
 * Tailwind 逐 CSS 文件打开 tailwind.config.js 时撞 EMFILE: too many open files。
 *
 * graceful-fs 在 EMFILE 时自动排队重试；core fs 模块是全局单例，gracefulify 原地改写，
 * 因此通过 NODE_OPTIONS="--require 本文件" 预加载后，后续所有 require('fs') 均被覆盖
 * （含 tailwind/vite 等间接依赖）。
 */
require('graceful-fs').gracefulify(require('fs'));
