import type { FC } from 'react';

export type SettingsStatusTone = 'ok' | 'warn' | 'neutral';

interface SettingsStatusTagProps {
  /** 状态语义：ok=已配置/已开启（绿），warn=未配置/未开启（橙），neutral=中性（灰） */
  tone?: SettingsStatusTone;
  children: React.ReactNode;
}

/**
 * 设置页状态标签（对应 html 示例 .tag/.tag--ok/.tag--warn + .dot）：
 * 胶囊形态 + 前置圆点，用于「已配置/未配置/已开启」等状态语义的紧凑展示。
 * 样式见 Settings.css .settings-status-tag。
 */
export const SettingsStatusTag: FC<SettingsStatusTagProps> = ({ tone = 'neutral', children }) => (
  <span className={`settings-status-tag settings-status-tag--${tone}`}>
    <span className="settings-status-tag__dot" aria-hidden="true" />
    {children}
  </span>
);
