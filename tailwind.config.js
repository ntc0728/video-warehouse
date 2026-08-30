/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // App 暗色切换走 [data-theme="dark"] 属性（variables.css 据此翻转 token），
  // 而非系统 prefers-color-scheme。未配置时 dark: 变体只响应系统媒体查询，
  // 导致 Button/Switch 等组件在 App 内切暗色时纹丝不动（死代码）。
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1920px',
        '3xl': '2560px',
        '4xl': '3840px',
      },
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-light': 'var(--color-primary-light)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'text-primary': 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        'text-inverse': 'var(--color-text-inverse)',
        border: 'var(--color-border)',
        'border-light': 'var(--color-border-light)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
      },
      spacing: {
        '3xs': 'var(--space-3xs)',
        '2xs': 'var(--space-2xs)',
        'xs':  'var(--space-xs)',
        'sm':  'var(--space-sm)',
        'md':  'var(--space-md)',
        'lg':  'var(--space-lg)',
        'xl':  'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      fontSize: {
        'xs':   ['var(--text-xs)',   { lineHeight: '1.4' }],
        'sm':   ['var(--text-sm)',   { lineHeight: '1.4' }],
        'base': ['var(--text-base)', { lineHeight: '1.5' }],
        'lg':   ['var(--text-lg)',   { lineHeight: '1.5' }],
        'xl':   ['var(--text-xl)',   { lineHeight: '1.4' }],
        '2xl':  ['var(--text-2xl)',  { lineHeight: '1.3' }],
        '3xl':  ['var(--text-3xl)',  { lineHeight: '1.2' }],
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
}
