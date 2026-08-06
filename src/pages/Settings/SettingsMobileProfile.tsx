import { User } from 'lucide-react';
import { useSettingsStore } from '@/stores';
import { Icon } from "@/components/ui/Icon";

/**
 * 移动端设置页顶部资料区（居中展示头像 + 用户名）
 * 点击头像/昵称 → 进入「个人设置」子页（编辑资料入口）。
 */
interface SettingsMobileProfileProps {
  /** 点击资料区进入个人设置页 */
  onProfileClick: () => void;
}

export default function SettingsMobileProfile({ onProfileClick }: SettingsMobileProfileProps) {
  const username = useSettingsStore((s) => s.username);
  const avatar = useSettingsStore((s) => s.avatar);

  return (
    <button
      type="button"
      className="settings-mobile-profile"
      onClick={onProfileClick}
      aria-label="进入个人设置"
    >
      <span className="settings-mobile-profile__avatar">
        {avatar ? <img src={avatar} alt="头像" /> : <Icon icon={User} size="2xl" />}
      </span>
      <span className="settings-mobile-profile__name">{username.trim() || '未设置昵称'}</span>
    </button>
  );
}
