import { List } from '@/components/ui';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';

interface AppearanceTabProps {
  theme: string;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  skin: string;
  setSkin: (s: 'default' | 'cartoon' | 'mechanical' | 'retro') => void;
}

export default function AppearanceTab({ theme, setTheme, skin, setSkin }: AppearanceTabProps) {
  return (
    <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
      <List header={<span className="settings-section-header"><Palette size={20} /> 外观</span>}>
        <List.Item
          title="主题模式"
          extra={
            <div className="theme-switcher">
              <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} aria-label="浅色模式">
                <Sun size={18} />
              </button>
              <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} aria-label="深色模式">
                <Moon size={18} />
              </button>
              <button className={`theme-btn ${theme === 'system' ? 'active' : ''}`} onClick={() => setTheme('system')} aria-label="跟随系统">
                <Monitor size={18} />
              </button>
            </div>
          }
        />
        <List.Item
          title="皮肤"
          description="为页面叠加美术资源"
          extra={
            <div className="skin-switcher">
              {([
                { value: 'default', label: '默认', bg: '' },
                { value: 'cartoon', label: '卡通', bg: '/art-skins/cartoon/bg.svg' },
                { value: 'mechanical', label: '机械', bg: '/art-skins/mechanical/bg.svg' },
                { value: 'retro', label: '复古', bg: '/art-skins/retro/bg.svg' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`skin-btn ${skin === opt.value ? 'active' : ''}`}
                  onClick={() => setSkin(opt.value)}
                  aria-label={opt.label}
                >
                  <span className="skin-btn__swatch"
                    style={opt.bg ? { backgroundImage: `url(${opt.bg})` } : undefined}
                  />
                  <span className="skin-btn__label">{opt.label}</span>
                </button>
              ))}
            </div>
          }
        />
      </List>
    </section>
  );
}
