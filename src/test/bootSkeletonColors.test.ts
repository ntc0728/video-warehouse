import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 启动骨架（index.html 内联 CSS）与运行期骨架色源的一致性护栏。
 *
 * 启动骨架在 bundle CSS/JS 加载前就要绘制，颜色只能硬编码；它必须在
 * #boot-splash 上集中成 --bs-* 变量，并与 variables.css 的
 * --color-placeholder-shimmer-a/b（全站骨架唯一色源）保持同步。
 * 本测试在任一色源变更但启动骨架未跟随时失败。
 */
function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

function stripCssComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

function shimmerValues(css: string, token: string): [string, string] {
  const matches = [...css.matchAll(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, 'gi'))].map((m) => m[1].toLowerCase());
  expect(matches.length, `--${token} 应只有浅/暗两处定义`).toBe(2);
  return [matches[0], matches[1]];
}

describe('boot skeleton 色源', () => {
  const variables = read('src/assets/styles/variables.css');
  const html = read('index.html');
  const bootCss = stripCssComments(
    html.slice(html.indexOf('<style>'), html.indexOf('</style>')),
  );

  it('--bs-skeleton-a/b 与 variables.css 的 shimmer-a/b 浅暗两档完全一致', () => {
    const [lightA, darkA] = shimmerValues(variables, 'color-placeholder-shimmer-a');
    const [lightB, darkB] = shimmerValues(variables, 'color-placeholder-shimmer-b');

    expect(bootCss).toContain(`--bs-skeleton-a: ${lightA}`);
    expect(bootCss).toContain(`--bs-skeleton-b: ${lightB}`);
    expect(bootCss).toContain(`--bs-skeleton-a: ${darkA}`);
    expect(bootCss).toContain(`--bs-skeleton-b: ${darkB}`);
  });

  it('不再残留旧色值（#f3f4f7 / #e8ebf1 / #2a2a2a）', () => {
    expect(bootCss).not.toMatch(/#f3f4f7|#e8ebf1|#2a2a2a/i);
  });

  it('骨架块统一读变量，首页 hero 卡壳保持透明（真实页已去卡片化）', () => {
    expect(bootCss).toMatch(/background:\s*var\(--bs-skeleton-a\)/);
    expect(bootCss).toMatch(/background:\s*var\(--bs-skeleton-b\)/);
    expect(bootCss).toMatch(/\.bs-herobili\s*\{[^}]*background:\s*transparent/);
    expect(bootCss).toMatch(/\.bs-herocard\s*\{[^}]*background:\s*transparent/);
  });
});
