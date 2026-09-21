#!/usr/bin/env node
/**
 * 设计基线审计（B7.2 护栏）
 *
 * 补 ESLint 覆盖不到的盲区：CSS 文件里的硬编码色 / 语义色误用 / 裸 z-index 等。
 * ESLint 侧只管 .tsx 的 className、style={{}} 与颜色常量（见 eslint-rules/no-hardcoded-colors.js）。
 *
 * 机制：**基线棘轮（ratchet）**。存量违规快照进 baseline，只拦截「新增」违规，
 * 这样护栏第一天就有牙、又不用先清完数百处历史债。
 *
 * 用法：
 *   node scripts/design-audit.mjs                  # 报告（含新增/已清），始终 exit 0
 *   node scripts/design-audit.mjs --strict         # 有「新增」违规即 exit 1（CI / pre-push）
 *   node scripts/design-audit.mjs --update-baseline  # 把当前违规快照为基线
 *   node scripts/design-audit.mjs --json           # 机器可读
 *   node scripts/design-audit.mjs --list           # 打印全部命中位置（默认只打前几条）
 *
 * 基线键用「文件 + 归一化内容」而非行号，行号漂移不会误判为新增。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(ROOT, 'scripts', 'design-audit-baseline.json');

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const JSON_OUT = args.has('--json');
const LIST_ALL = args.has('--list');
const UPDATE = args.has('--update-baseline');

/** token 定义文件：颜色/层级的唯一真源，允许出现裸值。 */
const TOKEN_FILES = [
  'src/assets/styles/variables.css',
  'src/assets/styles/skins.css',
];

/**
 * 沙盒（调研 demo）目录排除钩子：与 .stylelintrc.json 的 ignoreFiles 同源。
 * 2026-09-21：PlayerLab / PlayerMobileLab demo 已整体删除，当前无排除对象。
 */
const EXCLUDE_DIRS = [];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

/** 逐行剥离注释，跨行块注释由状态机跟踪。返回 {text, lineNo} 数组（只保留有效代码行）。 */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  src.split(/\r?\n/).forEach((line, i) => {
    let s = line;
    if (inBlock) {
      const end = s.indexOf('*/');
      if (end === -1) return;
      s = s.slice(end + 2);
      inBlock = false;
    }
    let text = '';
    let rest = s;
    for (;;) {
      const start = rest.indexOf('/*');
      if (start === -1) {
        text += rest;
        break;
      }
      text += rest.slice(0, start);
      const end = rest.indexOf('*/', start + 2);
      if (end === -1) {
        inBlock = true;
        rest = '';
        break;
      }
      rest = rest.slice(end + 2);
    }
    if (text.trim()) out.push({ text, lineNo: i + 1 });
  });
  return out;
}

const files = walk(SRC)
  .map((abs) => ({
    abs,
    rel: path.relative(ROOT, abs).replace(/\\/g, '/'),
  }))
  .filter((f) => !EXCLUDE_DIRS.some((d) => f.rel === d || f.rel.startsWith(d + '/')))
  .map((f) => ({ ...f, code: codeLines(fs.readFileSync(f.abs, 'utf8')) }));

/** 语义色 fill 档 token 名（不得直接当文字色）。 */
const FILL_ONLY = ['success', 'warning', 'error', 'info'];
const TEXT_PROP = /^\s*(?:color|-webkit-text-fill-color|fill|stroke|caret-color)\s*:/;

const CHECKS = [
  {
    id: 'css-hardcoded-hex',
    enforce: true,
    desc: 'CSS 里的裸 hex 颜色（应走 --color-* token）',
    match: (raw) => raw.match(/#[0-9a-fA-F]{3,8}\b/g),
    tokens: TOKEN_FILES,
  },
  {
    id: 'fill-token-as-text',
    enforce: true,
    desc: 'fill 档语义色（--color-success/warning/error/info）被用作文字/图标色',
    match: (raw) => {
      if (!TEXT_PROP.test(raw)) return null;
      const m = raw.match(
        new RegExp(`var\\(\\s*--color-(${FILL_ONLY.join('|')})\\s*(?:,|\\))`),
      );
      return m ? [m[0]] : null;
    },
  },
  {
    id: 'raw-z-index',
    enforce: true,
    desc: '页级裸 z-index（≥100 必须走 --z-* token；50–99 为组件局部抬升过渡带）',
    /**
     * 阈值口径（2026-09-15 D5 校准）：
     *   ≥100  = 页级覆盖层起点（--z-overlay），必检 —— 落在这一带的裸数字会与
     *           侧边栏 / 抽屉 / 弹窗 / toast / 幕布等页级浮层互相打架，必须走 token。
     *   <100  = 组件自身 stacking context 内的相对层梯（播放器 chrome 的 20/25/60/70/95，
     *           图表的 flex 子项等），只在本组件内部比较大小，不参与页级层叠。
     *           契约与 §5.3「触碰 <50 的 z-index 无收益」一致，故不再逐条报警，
     *           否则 93 处合法局部值会淹没真正的页级冲突（原实现连 1/2/3 也报）。
     */
    match: (raw) => {
      const m = raw.match(/z-index\s*:\s*(-?\d+)/);
      return m && Number(m[1]) >= 100 ? [m[0]] : null;
    },
    tokens: TOKEN_FILES,
  },
  {
    id: 'font-weight-literal',
    enforce: true,
    desc: '字重 800/900 字面量（应收敛到 --fw-bold 700）',
    match: (raw) => raw.match(/font-weight\s*:\s*(?:800|900)\b/),
    /* 主题/令牌层排除：skins.css 与 variables.css 属于主题层，其字重是**皮肤自身契约**
       （如 cartoon 皮肤统一 700）与 @font-face 资源声明（orbitron-900 的 weight 描述符，
       并非文字粗细），不属于组件级字重债。组件层出现 800/900 仍会被拦下。 */
    tokens: TOKEN_FILES,
  },
  {
    id: 'timing-literal',
    enforce: true,
    desc: 'transition/animation 内联时长字面量（新代码应走 --dur-* token）',
    /**
     * 2026-09-15 D6 起由 observe 转 enforce：
     * 新增 --dur-2xs/xs/sm/md/lg 五档交互阶梯（值取自既有字面量频次前 5 名）
     * 与 --dur-shimmer/pulse/marquee 三个装饰循环档后，存量 426 处已降 156 处，
     * 其余为**刻意保留**的两类（见 docs/design/BASELINE.md §时长）：
     *   ① animation-delay 的错峰值（列表逐项进场 0.15/0.18/0.20s…）——是「第几个出场」，
     *      不是「动多快」，套 --dur-* 会把节奏语义搞混；
     *   ② 一次性微调与特定循环（30/60/88/…/390ms 与 1s/1.4s/2.4s/8s/25s 等）——
     *      归档会改变观感节奏（§5.3 明确不做）。
     * 现在的 enforce 语义 = 「不许再新增字面量」：存量已快照进基线，只拦新增。
     */
    match: (raw) => {
      const m = raw.match(/(?:transition|animation)[^:]*:\s*[^;]*?\b\d*\.?\d+m?s\b/);
      return m ? [m[0].trim().slice(0, 48)] : null;
    },
  },
  /**
   * 盒尺寸 / 定位类裸 px —— 2026-09-15 D5 从 stylelint 的 unit-disallowed 规则移出后，
   * 在此以 observe 模式保留度量（不阻塞提交）。
   *
   * 移出理由：这些属性承载的是**刻意固定**的尺寸，而非流体语言：
   *   ① 结构细线 1–2px（分隔线 / 进度轨 / 负 margin 描边）
   *   ② 装饰圆点 ≤12px（token 文档已明确豁免「圆点 / 圆角 / 滚动条」）
   *   ③ 媒体比例盒（封面 160×90 / 112×168，尺寸由比例与网格决定，流体化会让行高跳动）
   *   ④ 运行时变量兜底 var(--js 注入, Npx)（如 --player-toast-top / --detail-hero-h）
   * 改成 token 会引入无收益的观感漂移；而在 stylelint 里逐行 disable 会生成
   * 上百条注释噪音（该规则的 ignore:["inside-function"] 在 17.x 实测无效）。
   * 故：enforce 交给「间距/字号/圆角」，盒尺寸保留本 observe 指标，便于后续收紧。
   */
  {
    id: 'raw-px-box-size',
    enforce: false,
    desc: '盒尺寸/定位类属性里的裸 px（多为刻意固定值，见上方说明）',
    match: (raw) => {
      const m = raw.match(
        /^\s*(?:width|min-width|max-width|height|min-height|max-height|flex-basis|top|right|bottom|left|inset|inset-block|inset-inline)\s*:\s*[^;]*\d+(?:\.\d+)?px/,
      );
      return m ? [m[0].trim().slice(0, 48)] : null;
    },
  },
];

const keyOf = (rel, text) =>
  `${rel}|${crypto.createHash('sha1').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 10)}`;

const results = [];
for (const check of CHECKS) {
  const hits = [];
  for (const f of files) {
    if (check.tokens?.includes(f.rel)) continue;
    for (const { text, lineNo } of f.code) {
      const m = check.match(text);
      if (!m) continue;
      hits.push({ key: keyOf(f.rel, text), file: f.rel, line: lineNo, text: text.trim().slice(0, 90) });
    }
  }
  results.push({ ...check, hits });
}

/* ── 基线棘轮 ─────────────────────────────────────────────────────── */
const snapshot = {};
for (const r of results) {
  snapshot[r.id] = [...new Set(r.hits.map((h) => h.key))].sort();
}

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + '\n');
  const total = Object.values(snapshot).reduce((a, v) => a + v.length, 0);
  console.log(`基线已更新 → scripts/design-audit-baseline.json（${total} 条唯一基线）`);
  process.exit(0);
}

let baseline = {};
if (fs.existsSync(BASELINE)) baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

const summary = results.map((r) => {
  const base = new Set(baseline[r.id] ?? []);
  const newHits = r.hits.filter((h) => !base.has(h.key));
  const nowKeys = new Set(r.hits.map((h) => h.key));
  const resolved = [...base].filter((k) => !nowKeys.has(k));
  return {
    id: r.id,
    enforce: r.enforce,
    desc: r.desc,
    total: r.hits.length,
    baseline: base.size,
    newHits,
    resolved: resolved.length,
    hits: r.hits,
  };
});

const enforceNew = summary.filter((s) => s.enforce && s.newHits.length);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      summary.map(({ id, enforce, desc, total, baseline: b, newHits, resolved }) => ({
        id, enforce, desc, total, baseline: b, new: newHits.length, resolved, newHits,
      })),
      null,
      2,
    ),
  );
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n设计基线审计 · design-audit（基线棘轮）\n' + '─'.repeat(76));
  for (const s of summary) {
    const mark = !s.enforce ? '·' : s.newHits.length ? '✗' : '✓';
    const scope = s.enforce ? 'enforce' : 'observe';
    console.log(
      `${mark} ${pad(s.id, 22)} [${pad(scope, 7)}] 新增 ${pad(s.newHits.length, 4)} / 基线 ${pad(s.baseline, 4)} / 现存 ${pad(s.total, 4)}  ${s.desc}`,
    );
    const show = s.newHits.length ? s.newHits : s.hits;
    if (s.newHits.length || LIST_ALL) {
      for (const h of show.slice(0, LIST_ALL ? show.length : 8)) {
        console.log(`    ${s.newHits.length ? '＋' : ' '} ${h.file}:${h.line}  ${h.text}`);
      }
      if (!LIST_ALL && show.length > 8) console.log(`    … 其余 ${show.length - 8} 处`);
    }
  }
  const resolvedTotal = summary.reduce((a, s) => a + s.resolved, 0);
  console.log('─'.repeat(76));
  console.log(
    enforceNew.length
      ? `${enforceNew.length} 项检查出现新增违规（共 ${enforceNew.reduce((a, s) => a + s.newHits.length, 0)} 处）`
      : `无新增违规${resolvedTotal ? `（本次还清掉基线 ${resolvedTotal} 条）` : ''}`,
  );
  if (!fs.existsSync(BASELINE)) console.log('提示：基线文件不存在，首次请先跑 --update-baseline');
  console.log('');
}

process.exit(STRICT && enforceNew.length ? 1 : 0);
