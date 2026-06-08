// scripts/split-single-line-decls.mjs
// 把 CSS 中的 "prop1: val1; prop2: val2;" 拆成多行。
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
let files = args.filter(a => !a.startsWith('--'));
if (args.includes('--all')) {
  files = [
    'src/pages/Detail/Detail.css',
    'src/pages/Collections/Collections.css',
    'src/pages/History/History.css',
    'src/components/StickyHeader/StickyHeader.css',
    'src/pages/Browse/Browse.css',
    'src/assets/styles/index.css',
    'src/components/FilterBar/FilterBar.css',
    'src/components/common/AppLoading.css',
    'src/components/common/CardCoverLoading.css',
  ];
}

let totalFixed = 0;
for (const file of files) {
  const path = resolve(file);
  const original = readFileSync(path, 'utf8');
  // 在 {} 块内，把 "; X: Y" 替换为 ";\n  X: Y"
  const out = original.replace(/(\{[^{}]*\})/g, (block) => {
    // 用 ; 切分声明
    const before = block.startsWith('{') ? '{' : '';
    const after = block.endsWith('}') ? '}' : '';
    const inner = block.slice(before.length, block.length - after.length);
    // 把每个 decl 独立成行
    const parts = inner.split(';').map(s => s.trim()).filter(s => s.length > 0);
    const decls = parts.map(p => p + ';').join('\n  ');
    return before + '\n  ' + decls + '\n' + after;
  });
  writeFileSync(path, out, 'utf8');
  const diff = (original.match(/;\s*[a-z-]+\s*:/g) || []).length;
  totalFixed += diff;
  console.log(`✓ ${file}: ${diff} single-line decls fixed`);
}
console.log(`\nTotal: ${totalFixed} single-line decls fixed across ${files.length} files`);
