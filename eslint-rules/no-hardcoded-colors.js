// 设计 token 护栏：禁止在 className 中使用 Tailwind 默认调色板与裸 hex 颜色，
// 强制走项目设计 token（bg-primary / text-text-inverse / bg-danger 等），
// 防止移动端/App 质感劣化复发。
//
// 注意：本项目硬编码颜色大多在 .css 文件里（ESLint 不覆盖），本规则仅兜住
// .tsx 的 className 层；真正的 .css 清理见方案 C2 全量替换。

const TAILWIND_DEFAULT =
  /\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|accent|decoration)-(?:white|black|gray|grey|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\b/;

const HEX = /#[0-9a-fA-F]{3,8}\b/;

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
    function check(node, raw) {
      if (typeof raw !== 'string') return;
      const violations = new Set();
      let m;
      const reT = new RegExp(TAILWIND_DEFAULT.source, 'g');
      while ((m = reT.exec(raw))) violations.add(m[0]);
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

    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'className') return;
        const val = node.value;
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
    };
  },
};
