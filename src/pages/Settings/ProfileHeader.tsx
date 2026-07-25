import { useState } from 'react'
import { User } from 'lucide-react'
import { useSettingsStore } from '@/stores'
import ProfileEditModal from './ProfileEditModal'

export default function ProfileHeader() {
  const username = useSettingsStore((s) => s.username)
  const avatar = useSettingsStore((s) => s.avatar)
  const [editing, setEditing] = useState(false)

  return (
    <>
      <button
        type="button"
        className="settings-profile"
        onClick={() => setEditing(true)}
        aria-label="编辑个人资料"
      >
        <span className="settings-profile__avatar">
          {avatar ? <img src={avatar} alt="" /> : <User size={28} />}
        </span>
        <span className="settings-profile__meta">
          <span className="settings-profile__name">{username.trim() || '未设置昵称'}</span>
          <span className="settings-profile__hint">点击编辑头像与昵称</span>
        </span>
      </button>
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
