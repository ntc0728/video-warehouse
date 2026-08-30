import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import noHardcodedColors from './eslint-rules/no-hardcoded-colors.js';

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
      'no-hardcoded-colors': { rules: { 'no-hardcoded-colors': noHardcodedColors } },
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
      // 导航 API 强约束：禁止业务层直接引入 react-router-dom 的 useNavigate，
      // 必须从 @/lib/navigation 使用 useCustomNavigate（二次进入的闪烁由 AppLayout 的
      // data-revisit 门控统一处理，与导航入口保持一致）。
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react-router-dom',
          importNames: ['useNavigate'],
          message: '请使用 @/lib/navigation 的 useCustomNavigate，禁止直接引入 react-router-dom 的 useNavigate（避免绕过统一的导航入口与重进门控）。',
        }],
      }],
      // 设计 token 护栏：禁止在 className 使用 Tailwind 默认调色板与裸 hex，
      // 强制走项目设计 token（bg-primary / text-text-inverse / bg-danger 等），
      // 防止移动端/App 质感劣化复发。仅 warn，不阻断 CI。
      'no-hardcoded-colors/no-hardcoded-colors': 'warn',
    },
  },
  {
    // 封装层自身需要原生 useNavigate，豁免此规则
    files: ['src/lib/navigation.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  }
);
