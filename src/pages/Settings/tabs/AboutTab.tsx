import { List } from '@/components/ui';
import { Info, ScrollText } from 'lucide-react';
import pkg from '../../../../package.json';

interface AboutTabProps {
  onVersionClick: () => void;
  onChangelogClick: () => void;
}

const isAndroid = import.meta.env.CAPACITOR === 'true';
const isDev = import.meta.env.DEV;

/** 设置页「关于」标签：动态展示版本号 + 平台/构建通道，并提供更新日志入口 */
export default function AboutTab({ onVersionClick, onChangelogClick }: AboutTabProps) {
  const version = pkg.version;
  const platform = isAndroid ? 'Android' : 'Web';
  const channel = isDev ? '开发版' : '正式版';

  return (
    <section className="about-tab">
      <List header={<span className="settings-section-header"><Info size={20} /> 关于</span>}>
        <List.Item
          title="版本"
          extra={
            <span className="version-extra">
              <span className="version-number">v{version}</span>
              <span className="version-meta">{platform} · {channel}</span>
            </span>
          }
          onClick={onVersionClick}
          clickable
        />
        <List.Item
          title="更新日志"
          extra={<ScrollText size={16} className="settings-item-icon" />}
          onClick={onChangelogClick}
          clickable
        />
        <List.Item title="KinoTV" description="聚合影视剧和IPTV资源" />
      </List>
    </section>
  );
}
