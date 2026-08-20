import type { LucideIcon } from 'lucide-react';
import { Icon, SIZE_VAR, type IconSize } from './Icon';

interface DuoIconProps {
  primary: LucideIcon;
  secondary: LucideIcon;
  size?: IconSize;
}

/**
 * 双图标层叠组件：hover 时主图标淡出、近似变体副图标淡入（纯 opacity/transform 过渡，
 * GPU 合成不卡顿），形成「图标跳动」效果。尺寸由 --icon-* token 驱动，与 Icon 规范一致。
 * 使用处需在父级容器 CSS 中提供 button:hover 切换规则（见 UniversalPlayer.css .up-icon-duo）。
 */
export function DuoIcon({ primary, secondary, size = 'md' }: DuoIconProps) {
  return (
    <span className="up-icon-duo" style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }}>
      <span className="up-icon-duo__primary">
        <Icon icon={primary} size={size} />
      </span>
      <span className="up-icon-duo__secondary">
        <Icon icon={secondary} size={size} />
      </span>
    </span>
  );
}
