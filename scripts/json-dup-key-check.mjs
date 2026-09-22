#!/usr/bin/env node
/**
 * JSON 配置重复 key 检测（护栏，方案 §5.2 第 3 项）。
 *
 * 背景：JSON.parse 对同一对象内的重复 key **静默保留最后一个**，无警告无报错——
 * 与 A1（--ui-scale 同块重复定义）/ B7（JSON 重复 key）同属「静默失效」家族根因。
 * 编辑器 diff 看不出、构建不报错，直到运行时行为诡异才暴露。
 *
 * 实现：字符级扫描（支持 JSONC 注释，tsconfig 系列带注释），逐对象层级记录
 * key 首次出现的行号；同层级二次出现即报错并 exit 1。
 * 不用 JSON.parse + reviver：reviver 在解析后才被调用，重复 key 已被折叠，无法检出。
 *
 * 用法：node scripts/json-dup-key-check.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXCLUDE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|.*\.min\.json)$/;

/**
 * 异步 spawn 收集 stdout。
 * 为什么不用 execFileSync：受限沙箱（WorkBuddy safe-delete shim）会拦截**同步**子进程创建，
 * `execFileSync('git', ...)` 直接抛 `spawnSync git EBUSY`，导致本检查必然失败；
 * 异步 `spawn` 不受影响（同一环境下实测 exit 0）。
 */
function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      out += c;
    });
    child.stderr.on('data', (c) => {
      err += c;
    });
    child.on('error', (e) => reject(new Error(`无法执行 ${cmd}：${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args.join(' ')} 退出码 ${code}${err.trim() ? `\n${err.trim()}` : ''}`));
    });
  });
}

async function trackedJsonFiles() {
  const out = await runCapture('git', ['ls-files', '*.json']);
  return out.split('\n').filter(Boolean).filter((f) => !EXCLUDE.test(f.replace(/\\/g, '/')));
}

/**
 * 扫描单个文件，返回重复 key 列表 [{ key, line, firstLine }]。
 * 状态机：inString / escape / lineComment / blockComment / depth。
 * key 判定：字符串结束后下一个非空白字符是 `:` → 该字符串是 key（记在当前深度）。
 */
function scan(text, file) {
  const dups = [];
  /** 每层对象一个 Map：key → 首次出现行号 */
  const stack = [new Map()];
  let line = 1;
  let inString = false;
  let escape = false;
  let lineComment = false;
  let blockComment = false;
  /** 刚闭合的字符串内容；若随后紧跟 `:` 则为 key */
  let closedString = null;
  const errors = [];

  const push = (ch) => {
    if (ch === '\n') line++;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      push(ch);
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      push(ch);
      continue;
    }
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
        closedString = { value: strSoFar(text, i), line: strLine };
      } else if (ch === '\n') {
        line++; // JSON 规范不允许，容错处理
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      strLine = line;
      strStart = i + 1;
      push(ch);
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }

    if (closedString) {
      if (ch === ':') {
        // closedString 是 key
        const key = closedString.value;
        const top = stack[stack.length - 1];
        if (top.has(key)) {
          dups.push({ key, line: closedString.line, firstLine: top.get(key) });
        } else {
          top.set(key, closedString.line);
        }
        closedString = null;
      } else if (!/\s/.test(ch)) {
        closedString = null; // 值字符串或其它 token，非 key
      }
    }

    if (ch === '{') stack.push(new Map());
    if (ch === '}') {
      if (stack.length > 1) stack.pop();
    }
    push(ch);
  }
  if (inString || blockComment) {
    errors.push(`${file}: 文件在字符串/注释中意外结束（解析器状态异常）`);
  }
  return { dups, errors };
}

/** 闭合字符串的起始位置是 strStart，闭合引号在 i */
let strStart = 0;
let strLine = 0;
function strSoFar(text, closeQuoteIdx) {
  return text.slice(strStart, closeQuoteIdx);
}

const argFiles = process.argv.slice(2);
const files = argFiles.length ? argFiles : await trackedJsonFiles();
const problems = [];
let scanned = 0;

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const { dups, errors } = scan(text, f);
  scanned++;
  for (const d of dups) {
    problems.push(
      `${f}:${d.line} 重复 key "${keyOf(text, d)}"（首次出现在第 ${d.firstLine} 行，本行覆盖了它）`
    );
  }
  problems.push(...errors);
}

function keyOf(text, d) {
  // d.line 是 key 所在行；从该行提取 "xxx" 形式的 key 用于展示
  const lineText = text.split('\n')[d.line - 1] ?? '';
  const m = lineText.match(/"((?:[^"\\]|\\.)*)"\s*:/);
  return m ? m[1] : d.key;
}

console.log(`已扫描 ${scanned} 个 JSON 文件${argFiles.length ? '' : '（git 跟踪，排除 lockfile）'}`);
if (problems.length) {
  console.error(`\n❌ 发现 ${problems.length} 处问题：`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('✅ 无重复 key');
