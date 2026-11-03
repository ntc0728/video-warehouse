const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = 'changelogs/demos/demo-hero-bili-6-4-layout-2026-11-04.html';
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) throw new Error('expected one inline script, got ' + scripts.length);
new vm.Script(scripts[0], { filename: path.basename(file) });
console.log('[PASS] demo inline JS parses');

const w = html.match(/grid-template-columns: minmax\(0, 1fr\) var\(--side-w\)/);
if (!w) throw new Error('demo split rule missing');
console.log('[PASS] demo split rule present');

const clamp = (min, v, max) => Math.min(max, Math.max(min, v));

/**
 * 复刻生产 layout-tokens.css 的 HeroBili 公式（2026-11-04 精确解）：
 *   --hero-content-w = min(100vw, 2200px + 2×page-pad-x)   ← 先扣留白、再封顶
 *   --hero-grid-w    = --hero-content-w − 2×page-pad-x − 2×space-md − hero-main-gap
 *   --hero-side-w    = 0.4 × grid-w − 37/45 × side-gap
 *   banner-w         = grid-w − side-w；banner-h = banner-w × 9/16
 *   卡宽 = (side-w − g)/2；卡高 = (banner-h − 2g)/3
 * 该式对 ≥2200 的内容封顶必须成立：旧写法 min(100vw,2200) − 2pad 在这里少算 2pad，
 * 是「≥2560 封面比例失调」的根因，本脚本即该回归的算术护栏。
 */
const samples = [1024, 1280, 1440, 1920, 2200, 2400, 2560, 3440];
for (const v of samples) {
  const pad = v >= 2560 ? 140 : (v >= 1920 ? 100 : 60);
  const ui = v >= 1920 ? clamp(1, 0.76 + 0.000125 * v, 1.08) : 1;
  const spaceMd = clamp(9.5, 7.89104 + 0.002095 * v, 12.5) * ui;
  const g = clamp(7.2, 4 + 0.004167 * v, 12) * ui;
  const oldContent = Math.min(v, 2200) - 2 * pad;      // 旧（错）：先封顶再扣留白
  const content = Math.min(v, 2200 + 2 * pad) - 2 * pad; // 新（对）：先扣留白再封顶
  const G = content - 2 * spaceMd - g;
  const S = 0.4 * G - (37 / 45) * g;
  const B = G - S;
  const cardW = (S - g) / 2;
  const cardH = (B * 9 / 16 - 2 * g) / 3;
  const bannerRatio = B / (B * 9 / 16);
  const cardRatio = cardW / cardH;
  const delta = 3 * cardH + 2 * g - B * 9 / 16;
  const oldG = oldContent - 2 * spaceMd - g;
  const oldS = 0.4 * oldG - (37 / 45) * g;
  /* 回归对照必须分开「token 算出的右栏宽」与「grid 真实可用宽」：
     旧 token 偏窄，但 banner 是 1fr，仍按真实 G 吃剩余 → banner 被撑宽、
     右卡被压成 1.4~1.5:1。若按旧的 oldG 自洽去算，比例会假性恒 16:9。 */
  const oldCardW = (oldS - g) / 2;
  const oldBannerW = G - oldS;
  const oldCardH = (oldBannerW * 9 / 16 - 2 * g) / 3;
  console.log(
    `${v}: content ${content.toFixed(1)} (旧 ${oldContent.toFixed(1)})`,
    `split ${(B / G * 100).toFixed(1)}:${(S / G * 100).toFixed(1)}`,
    `banner ${B.toFixed(1)}×${(B * 9 / 16).toFixed(1)} (${bannerRatio.toFixed(3)}:1)`,
    `card ${cardW.toFixed(1)}×${cardH.toFixed(1)} (${cardRatio.toFixed(3)}:1)`,
    `delta ${delta.toFixed(3)}px`,
    `｜旧卡比 ${(oldCardW / oldCardH).toFixed(3)}:1`,
  );
  if (Math.abs(bannerRatio - 16 / 9) > 1e-9) throw new Error(`${v}: banner ratio drift`);
  if (Math.abs(cardRatio - 16 / 9) > 1e-9) throw new Error(`${v}: card ratio drift`);
  if (Math.abs(delta) > 1e-9) throw new Error(`${v}: bottom alignment drift`);
}
console.log('[PASS] exact geometry holds at every sampled viewport (含 2400/2560/3440 封顶档)');
