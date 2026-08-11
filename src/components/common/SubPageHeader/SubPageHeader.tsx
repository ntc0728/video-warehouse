/**
 * SubPageHeader — 移动端子页顶栏（返回按钮 + 居中标题）
 *
 * 用于从设置页进入的独立路由子页（源检测 / 一键配置代理），
 * 与设置页 SettingsSubPage 顶栏视觉一致：fixed 固定在视口顶部、
 * z-index 高于全局 sticky-header(50)，视觉上替代顶部导航栏；
 * 返回按钮走历史后退，无历史记录（直接输入 URL / 刷新首进）时回退到设置页。
 *
 * 仅由调用方在移动端（≤767px）条件渲染；桌面端不渲染。
 */
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCustomNavigate } from '@/lib/navigation';
import { Icon } from '@/components/ui/Icon';
import './SubPageHeader.css';

interface SubPageHeaderProps {
  /** 顶栏标题（如「源检测」「一键配置代理」） */
  title: string;
  /** 自定义返回行为；缺省：历史后退，无历史时回设置页 */
  onBack?: () => void;
}

export default function SubPageHeader({ title, onBack }: SubPageHeaderProps) {
  const navigate = useCustomNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // react-router 首次进入（直接输入 URL / 刷新）key 为 'default'，此时后退会离开应用
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/settings');
    }
  };

  return (
    <div className="sub-page-header">
      <button
        type="button"
        className="sub-page-header__back"
        onClick={handleBack}
        aria-label="返回"
      >
        <Icon icon={ArrowLeft} size="lg" />
      </button>
      <h2 className="sub-page-header__title">{title}</h2>
      {/* 右侧占位按钮：保持标题居中（与 iOS 导航栏左返回右菜单的对称结构） */}
      <span className="sub-page-header__spacer" aria-hidden="true" />
    </div>
  );
}
