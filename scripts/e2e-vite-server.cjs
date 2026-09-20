/**
 * E2E 测试专用 vite 启动入口（进程识别标记）
 *
 * 唯一目的：让测试自己拉起的 vite server 在进程命令行里带上 `e2e-vite-server.cjs`
 * 这个独有文件名。收尾/清场即可**只**按该标记精确击杀自建 server，
 * 绝不按端口占用者乱杀 —— 别的程序（包括用户 dev server）占着任何端口都不受影响。
 * 参数原样透传给 vite CLI。
 */
const path = require('path');
const { pathToFileURL } = require('url');
import(pathToFileURL(path.resolve(__dirname, '../node_modules/vite/bin/vite.js')).href).catch((err) => {
  console.error(err);
  process.exit(1);
});
