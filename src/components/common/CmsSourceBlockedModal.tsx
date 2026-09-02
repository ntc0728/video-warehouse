import { useNavigate } from 'react-router-dom';
import Modal from '@/components/ui/Modal';
import './CmsSourceBlockedModal.css';

interface CmsSourceBlockedModalProps {
  visible: boolean;
  sourceName: string;
  onClose: () => void;
}

/**
 * 居中的「视频源未启用」提示弹窗。
 * 历史/收藏页点击未启用 CMS 源的记录时弹出，引导用户去设置启用。
 */
export default function CmsSourceBlockedModal({ visible, sourceName, onClose }: CmsSourceBlockedModalProps) {
  const navigate = useNavigate();

  return (
    <Modal visible={visible} title="视频源未启用" onClose={onClose}>
      <div className="cms-blocked-modal">
        <p className="cms-blocked-modal__text">
          该播放记录关联的视频源「<strong>{sourceName}</strong>」当前未在设置中启用，无法继续播放。
          请先在设置中启用该视频源后再试。
        </p>
        <div className="cms-blocked-modal__actions">
          <button type="button" className="cms-blocked-modal__btn cms-blocked-modal__btn--ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="cms-blocked-modal__btn cms-blocked-modal__btn--primary"
            onClick={() => {
              onClose();
              navigate('/settings');
            }}
          >
            前往设置
          </button>
        </div>
      </div>
    </Modal>
  );
}
