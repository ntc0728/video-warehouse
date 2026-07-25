import { List } from '@/components/ui';
import { Info } from 'lucide-react';

interface AboutTabProps {
  onVersionClick: () => void;
}

export default function AboutTab({ onVersionClick }: AboutTabProps) {
  return (
    <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
      <List header={<span className="settings-section-header"><Info size={20} /> 关于</span>}>
        <div className="version-item">
          <List.Item title="版本" extra="1.0.0" onClick={onVersionClick} clickable />
        </div>
        <List.Item title="KinoTV" description="聚合影视剧和IPTV资源" />
      </List>
    </section>
  );
}
