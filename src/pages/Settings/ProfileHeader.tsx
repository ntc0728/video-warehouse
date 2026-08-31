import { useState } from 'react'
import { User } from 'lucide-react'
import { useSettingsStore } from '@/stores'
import ProfileEditModal from './ProfileEditModal'
import { Icon } from "@/components/ui/Icon";

export default function ProfileHeader() {
  const username = useSettingsStore((s) => s.username)
  const avatar = useSettingsStore((s) => s.avatar)
  const [editing, setEditing] = useState(false)

  return (
    <>
      {/* 个人资料标题：移出卡片，与「配置管理」「恢复默认配置」标题同行样式 */}
      <h3 className="settings-card__title">
        <Icon icon={User} size="md" className="settings-card__title-icon" />
        <span>个人资料</span>
      </h3>
      {/* 外层卡片（.settings-profile-card）：与设置页 .list-item 同卡片化；
          button 本体去卡片化，仅保留内容布局与点击交互 */}
      <div className="settings-profile-card">
        <button
          type="button"
          className="settings-profile"
          onClick={() => setEditing(true)}
          aria-label="编辑个人资料"
        >
          <span className="settings-profile__avatar">
            {avatar ? <img src={avatar} alt="" /> : <Icon icon={User} size="xl" />}
          </span>
          <span className="settings-profile__meta">
            <span className="settings-profile__name">{username.trim() || '未设置昵称'}</span>
            <span className="settings-profile__hint">点击编辑头像与昵称</span>
          </span>
        </button>
      </div>
      {editing && (
        <ProfileEditModal
          currentName={username}
          currentAvatar={avatar}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
