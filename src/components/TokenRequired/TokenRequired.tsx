/**
 * TokenRequired — 「TMDB Access Token 未配置」全页提示
 *
 * 用于 detail / play 页：未配置 TMDB Access Token 时整页展示，其余内容隐藏。
 * 视觉与交互对齐 Home 页 .home-token-required（图标 + 文案 + 跳转设置页）：
 * - 文案：TMDB Access Token 未配置，请在设置中「配置」
 * - 配置按钮点击跳转 /settings?tab=video
 *
 * 宿主容器需为 flex 容器（或至少给 min-height），组件以 flex:1 撑满并居中。
 */
import { AlertCircle } from 'lucide-react';
import { useCustomNavigate } from '@/lib/navigation';
import { Icon } from '@/components/ui/Icon';
import './TokenRequired.css';

export default function TokenRequired() {
  const navigate = useCustomNavigate();

  return (
    <div className="token-required" role="alert">
      <div className="token-required__main">
        <Icon icon={AlertCircle} size="3xl" className="token-required-icon" />
        <p className="token-required-text">
          TMDB Access Token 未配置，请在设置中
          <button
            className="token-required-link"
            onClick={() => navigate('/settings?tab=video')}
          >
            配置
          </button>
        </p>
      </div>
    </div>
  );
}
