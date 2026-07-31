import { User } from 'lucide-react';
import { useSettingsStore } from '@/stores';
import { Icon } from "@/components/ui/Icon";

/**
 * 移动端设置页顶部资料区（居中展示头像 + 用户名）
 * 编辑入口在「个人设置」整页内的设置项中。
 */
export default function SettingsMobileProfile() {
  const username = useSettingsStore((s) => s.username);
  const avatar = useSettingsStore((s) => s.avatar);

  return (
    <div className="settings-mobile-profile">
      <span className="settings-mobile-profile__avatar">
        {avatar ? <img src={avatar} alt="头像" /> : <Icon icon={User} size="2xl" />}
      </span>
      <span className="settings-mobile-profile__name">{username.trim() || '未设置昵称'}</span>
    </div>
  );
}
