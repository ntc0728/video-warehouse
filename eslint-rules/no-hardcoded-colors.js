// 设计 token 护栏：禁止在 className 中使用 Tailwind 默认调色板与裸 hex 颜色，
// 强制走项目设计 token（bg-primary / text-text-inverse / bg-danger 等），
// 防止移动端/App 质感劣化复发。
//
// 覆盖三层（2026-09-15 B7.2 扩展）：
//   ① className 字面量 / 模板串 —— Tailwind 默认调色板 + 裸 hex
//   ② style={{ ... }} 内联样式 —— 裸 hex（Tailwind class 在此不生效，只查 hex）
//   ③ TS 颜色常量（const XXX_COLOR = '#fff'）—— 裸 hex
//
// 注意：本项目 CSS 文件里的硬编码色 ESLint 覆盖不到，由
// `scripts/design-audit.mjs`（pnpm run lint:design）兜住。

const TAILWIND_DEFAULT =
  /\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|accent|decoration)-(?:white|black|gray|grey|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\b/;

const HEX = /#[0-9a-fA-F]{3,8}\b/;

/** 颜色语义标识符：用于识别 TS 颜色常量（如 `const DANGER_COLOR = '#cf1322'`）。 */
const COLOR_NAME = /color|colour|hex|tint|shade|bg|background/i;

/** 从 AST 节点提取字符串值（Literal / TemplateLiteral），非字符串返回 null。 */
function stringOf(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((q) => q.value.cooked ?? '').join('');
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '禁止使用 Tailwind 默认调色板与裸 hex 颜色，强制走项目设计 token',
    },
    messages: {
      noHardcoded:
        '避免使用硬编码颜色 "{{val}}"，请改用项目设计 token（如 bg-primary / text-text-inverse / bg-danger 等）',
    },
    schema: [],
  },
  create(context) {
    function check(node, raw, opts = {}) {
      if (typeof raw !== 'string') return;
      const violations = new Set();
      let m;
      if (opts.tailwind !== false) {
        const reT = new RegExp(TAILWIND_DEFAULT.source, 'g');
        while ((m = reT.exec(raw))) violations.add(m[0]);
      }
      const reH = new RegExp(HEX.source, 'g');
      while ((m = reH.exec(raw))) violations.add(m[0]);
      if (violations.size) {
        context.report({
          node,
          messageId: 'noHardcoded',
          data: { val: [...violations].join(', ') },
        });
      }
    }

    /** style={{ color: '#fff' }} → 逐个属性值查 hex（不查 Tailwind 类名）。 */
    function checkStyleObject(obj) {
      if (!obj || obj.type !== 'ObjectExpression') return;
      for (const prop of obj.properties) {
        if (prop.type !== 'Property') continue;
        const raw = stringOf(prop.value);
        if (raw !== null) check(prop.value, raw, { tailwind: false });
      }
    }

    return {
      JSXAttribute(node) {
        if (!node.name) return;
        const val = node.value;

        if (node.name.name === 'style') {
          if (
            val &&
            val.type === 'JSXExpressionContainer' &&
            val.expression.type === 'ObjectExpression'
          ) {
            checkStyleObject(val.expression);
          }
          return;
        }

        if (node.name.name !== 'className') return;
        if (!val) return;
        if (val.type === 'Literal') {
          check(val, val.value);
        } else if (
          val.type === 'JSXExpressionContainer' &&
          val.expression.type === 'TemplateLiteral'
        ) {
          val.expression.quasis.forEach((q) => check(q, q.value.cooked));
        } else if (
          val.type === 'JSXExpressionContainer' &&
          val.expression.type === 'Literal'
        ) {
          check(val.expression, val.expression.value);
        }
      },

      VariableDeclarator(node) {
        if (!node.id || node.id.type !== 'Identifier') return;
        if (!COLOR_NAME.test(node.id.name)) return;
        const raw = stringOf(node.init);
        if (raw !== null) check(node.init, raw, { tailwind: false });
      },
    };
  },
};
