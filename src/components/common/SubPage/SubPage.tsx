/**
 * SubPage — 移动端独立路由子页全屏容器（对齐设置页 SettingsSubPage）
 *
 * 用于从设置页进入的独立路由子页（源检测 / 一键配置代理）。
 * createPortal 挂到 document.body（脱离滚动容器 .app-shell__scroll 的
 * contain: layout 包含块），position:fixed inset:0 覆盖全视口：
 * 顶栏（返回 / 居中标题 / 右占位）与全局导航栏同高（--header-height-compact），
 * 视觉上替代顶部导航栏；children 置于 .sub-page__body，在顶栏下方独立滚动，
 * 无需对全局滚动容器做任何 padding 补偿。
 *
 * 返回按钮缺省走历史后退，无历史记录（直接输入 URL / 刷新首进）时回退到设置页。
 * 仅由调用方在移动端（≤767px）条件渲染；桌面端保持页面常规布局。
 *
 * 方案 B（无 Keep-Alive）：页面只在激活时挂载，portal 随页面销毁，
 * 不再需要「激活路由判断」防隐藏页残留遮挡（原 ActiveRouteContext /
 * SelfRouteContext 已删除）。
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCustomNavigate } from '@/lib/navigation';
import { Icon } from '@/components/ui/Icon';
import './SubPage.css';

interface SubPageProps {
  /** 顶栏标题（如「源检测」「一键配置代理」） */
  title: string;
  /** 自定义返回行为；缺省：历史后退，无历史时回设置页 */
  onBack?: () => void;
  /** 子页内容（渲染在顶栏下方的独立滚动区域） */
  children: ReactNode;
}

export default function SubPage({ title, onBack, children }: SubPageProps) {
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

  return createPortal(
    <div className="sub-page">
      <div className="sub-page__header">
        <button
          type="button"
          className="sub-page__back"
          onClick={handleBack}
          aria-label="返回"
        >
          <Icon icon={ArrowLeft} size="lg" />
        </button>
        <h2 className="sub-page__title">{title}</h2>
        {/* 右侧占位：保持标题居中（与 iOS 导航栏左返回右菜单的对称结构） */}
        <span className="sub-page__spacer" aria-hidden="true" />
      </div>
      <div className="sub-page__body">
        {children}
      </div>
    </div>,
    document.body,
  );
}
