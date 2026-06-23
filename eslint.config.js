import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'build', '**/build/**', 'backups/**', 'output/**', 'scripts/**', 'docs/**', '*.config.js', '*.config.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // 多端适配相关规则
      // 精确匹配形如 [isMobile, setIsMobile] = useState(...) 的重复检测模式。
      // 不再对所有 useState(true) 触发警告（避免误报合法的 UI 状态、网络、收藏、加载等场景）。
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'VariableDeclarator[id.type="ArrayPattern"][id.elements.0.name=/^isMobile$|^isTablet$|^isDesktop$/][init.callee.name="useState"]',
          message: '避免在多个组件中重复实现响应式断点检测，请使用 useMediaQuery.ts 中的 useIsMobile/useIsTablet/useIsDesktop Hook',
        },
      ],
      // 移除 no-restricted-imports(useState) 规则 — 该规则对所有 useState 导入
      // 触发警告（包括合法的 UI 状态、网络状态跟踪等），与 no-restricted-syntax
      // 的精确模式重复且过宽。isMobile 检测场景已由上述 syntax 规则覆盖。
      // 允许下划线前缀的参数（接口实现、catch 块、回调忽略等场景）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  }
);
