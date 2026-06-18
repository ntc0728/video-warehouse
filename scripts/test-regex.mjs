// 完整测试：直接 import 真实脚本的函数
import { readFileSync, writeFileSync } from 'fs';

const SIZE = {
  16:'var(--comp-thumb-size)', 64:'var(--space-3xl)', 80:'var(--space-3xl)',
  9999:'var(--radius-full)',
};

function replacePxInValueWithProp(prop, value) {
  const table = SIZE;
  console.log(`  CALLED: prop=${prop}, value=${JSON.stringify(value)}`);
  return value.replace(/(\d+)px/g, (m, num) => {
    const n = parseInt(num, 10);
    console.log(`    Replace ${m} → ${table[n] || m}`);
    return table[n] || m;
  });
}

const value = '80px';
console.log('Direct test:');
const r = replacePxInValueWithProp('max-height', value);
console.log('Result:', r);

console.log('\n\nMulti-value test:');
const v2 = '0 22px';
const r2 = replacePxInValueWithProp('padding', v2);
console.log('Result:', r2);
