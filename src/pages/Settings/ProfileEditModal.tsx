import { useState, useRef, ChangeEvent } from 'react'
import { User } from 'lucide-react'
import { Modal, Button, toast } from '@/components/ui'
import { useSettingsStore } from '@/stores'
import { Icon } from "@/components/ui/Icon";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB

interface ProfileEditModalProps {
  currentName: string
  currentAvatar: string
  onClose: () => void
}

export default function ProfileEditModal({
  currentName,
  currentAvatar,
  onClose,
}: ProfileEditModalProps) {
  const setUsername = useSettingsStore((s) => s.setUsername)
  const setAvatar = useSettingsStore((s) => s.setAvatar)
  const [name, setName] = useState(currentName)
  const [avatar, setAvatarLocal] = useState(currentAvatar)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('图片大小不能超过 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarLocal(reader.result as string)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    setUsername(name.trim())
    setAvatar(avatar)
    toast.success('个人资料已保存')
    onClose()
  }

  return (
    <Modal visible title="编辑个人资料" onClose={onClose} className="settings-modal">
      <div className="profile-edit__avatar-row">
        <span className="profile-edit__avatar-preview">
          {avatar ? <img src={avatar} alt="" /> : <Icon icon={User} size="2xl" />}
        </span>
        <div className="profile-edit__avatar-actions">
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => fileRef.current?.click()}>
            上传头像
          </Button>
          {avatar && (
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setAvatarLocal('')}>
              使用默认头像
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      <div className="profile-edit__field">
        <label className="profile-edit__label" htmlFor="profile-username">
          昵称
        </label>
        <input
          id="profile-username"
          className="settings-input"
          value={name}
          maxLength={20}
          placeholder="请输入昵称"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {error && <p className="profile-edit__error">{error}</p>}

      <div className="settings-modal__footer">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
          取消
        </Button>
        <Button variant="default" size="sm" className="rounded-full" onClick={handleSave}>
          保存
        </Button>
      </div>
    </Modal>
  )
}
