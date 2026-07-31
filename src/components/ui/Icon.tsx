import type { LucideIcon, LucideProps } from 'lucide-react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export const SIZE_VAR: Record<IconSize, string> = {
  xs: 'var(--icon-xs)',
  sm: 'var(--icon-sm)',
  md: 'var(--icon-md)',
  lg: 'var(--icon-lg)',
  xl: 'var(--icon-xl)',
  '2xl': 'var(--icon-2xl)',
  '3xl': 'var(--icon-3xl)',
};

export interface IconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: IconSize;
}

/**
 * 统一图标入口：尺寸由 --icon-* token 经 CSS var 注入，源码零像素硬编码。
 * TV 模式下 [data-device="tv"] 覆盖 --icon-* 后自动放大。
 */
export function Icon({ icon: IconCmp, size = 'lg', className, style, ...rest }: IconProps) {
  const dimension = SIZE_VAR[size];
  return (
    <IconCmp
      {...rest}
      className={className}
      style={{ width: dimension, height: dimension, ...style }}
    />
  );
}
