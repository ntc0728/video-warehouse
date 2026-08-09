import { List, Switch, Slider } from '@/components/ui';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

interface AppearanceTabProps {
  theme: string;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  skin: string;
  setSkin: (s: 'default' | 'cartoon' | 'mechanical' | 'retro') => void;
  tvMode: boolean;
  setTvMode: (v: boolean) => void;
  tvOverscan: number;
  setTvOverscan: (v: number) => void;
}

export default function AppearanceTab({ theme, setTheme, skin, setSkin, tvMode, setTvMode, tvOverscan, setTvOverscan }: AppearanceTabProps) {
  return (
    <section>
      <List header={<span className="settings-section-header"><Icon icon={Palette} size="lg" /> 外观</span>}>
        <List.Item
          title="主题模式"
          description="浅色 / 深色 / 跟随系统自动切换"
          extra={
            <div className="theme-switcher">
              <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} aria-label="浅色模式">
                <Icon icon={Sun} size="sm" />
              </button>
              <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} aria-label="深色模式">
                <Icon icon={Moon} size="sm" />
              </button>
              <button className={`theme-btn ${theme === 'system' ? 'active' : ''}`} onClick={() => setTheme('system')} aria-label="跟随系统">
                <Icon icon={Monitor} size="sm" />
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
        <List.Item
          title="TV 模式"
          description="启用方向键/数字键遥控器导航"
          extra={<Switch checked={tvMode} onChange={setTvMode} />}
        />
        {/* TV 过扫描安全区：仅 TV 模式生效时显示 */}
        {tvMode && (
          <List.Item
            title="TV 过扫描安全区"
            description="为电视边缘裁切预留安全边距（仅 TV 模式生效，0 = 铺满）"
            extra={
              <div className="overscan-control">
                <span className="overscan-value">{tvOverscan === 0 ? '铺满' : `${tvOverscan}%`}</span>
                <Slider
                  value={tvOverscan}
                  min={0}
                  max={20}
                  step={5}
                  onChange={setTvOverscan}
                  aria-label="TV 过扫描安全区大小"
                  className="overscan-slider"
                />
              </div>
            }
          />
        )}
      </List>
    </section>
  );
}
