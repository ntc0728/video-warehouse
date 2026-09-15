#!/usr/bin/env node
/**
 * lint:all 总闸（护栏演进 §5.2 第 2 项：全跑不短路）。
 *
 * 原实现 `a && b && c && d`：前面的检查一失败，后面的根本不执行——
 * 一次只能看到一个门的结果，修完再跑才能发现下一个门还有问题。
 * 本脚本顺序跑完全部检查（每步失败也继续），最后汇总报告，任一失败 exit 1。
 */
import { execSync } from 'node:child_process';

const steps = [
  ['lint:design', 'pnpm run lint:design'],
  ['lint:css', 'pnpm run lint:css'],
  ['lint:json (重复 key)', 'node scripts/json-dup-key-check.mjs'],
  ['lint (eslint)', 'pnpm run lint'],
  ['build', 'pnpm run build'],
];

const failed = [];

for (const [name, cmd] of steps) {
  console.log(`\n━━━━━━━━ ▶ ${name} ━━━━━━━━`);
  const t0 = Date.now();
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${name}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  } catch {
    failed.push(name);
    console.log(`❌ ${name}（${((Date.now() - t0) / 1000).toFixed(1)}s）—— 继续，不短路`);
  }
}

console.log('\n━━━━━━━━ 汇总 ━━━━━━━━');
for (const [name] of steps) console.log(` ${failed.includes(name) ? '❌' : '✅'} ${name}`);

if (failed.length) {
  console.error(`\n${failed.length}/${steps.length} 项失败：${failed.join('、')}`);
  process.exit(1);
}
console.log('\n全部通过 🎉');
