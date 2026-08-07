import { useCallback, useRef } from 'react';
import { List } from '@/components/ui';
import { Info, ScrollText } from 'lucide-react';
import pkg from '../../../../package.json';
import { Icon } from "@/components/ui/Icon";
import { useCustomNavigate } from '@/lib/navigation';
import { toast } from '@/components/ui/toastBus';

interface AboutTabProps {
  onVersionClick: () => void;
  onChangelogClick: () => void;
}

const isAndroid = import.meta.env.CAPACITOR === 'true';
const isDev = import.meta.env.DEV;

/** 隐藏入口：连续点击 "KinoTV" 3 次进入「一键配置代理」页 */
const HIDDEN_ENTRY_TAPS = 3;

/** 设置页「关于」标签：动态展示版本号 + 平台/构建通道，并提供更新日志入口 */
export default function AboutTab({ onVersionClick, onChangelogClick }: AboutTabProps) {
  const navigate = useCustomNavigate();
  const version = pkg.version;
  const platform = isAndroid ? 'Android' : 'Web';
  const channel = isDev ? '开发版' : '正式版';

  // 隐藏入口：连续点击 KinoTV 3 次（800ms 内）触发跳转
  const tapCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHiddenEntryClick = useCallback(() => {
    tapCountRef.current += 1;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    const remaining = HIDDEN_ENTRY_TAPS - tapCountRef.current;
    if (remaining > 0) {
      // 与「版本」点击提示保持一致
      toast.replace({ content: `再点击${remaining} 次进入一键配置代理页` });
      resetTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 3000);
    } else {
      tapCountRef.current = 0;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      navigate('/proxy-setup');
    }
  }, [navigate]);

  return (
    <section className="about-tab">
      <List header={<span className="settings-section-header"><Icon icon={Info} size="md" /> 关于</span>}>
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
          extra={<Icon icon={ScrollText} size="sm" className="settings-item-icon" />}
          onClick={onChangelogClick}
          clickable
        />
        <List.Item title="KinoTV" description="聚合影视剧和IPTV资源" onClick={handleHiddenEntryClick} clickable />
      </List>
      {/* 免责声明：关于页常驻展示，带标题、占整行、超宽换行 */}
      <div className="about-tab__disclaimer">
        <h3 className="about-tab__disclaimer-title">免责声明</h3>
        <p className="about-tab__disclaimer-text">
          本项目为开源学习项目，仅用于技术交流。影视资源与播放地址来自网络公开渠道（CMS 采集站 / IPTV 直播源），版权归原权利人所有；TMDB 数据版权归 TMDB 所有。请勿用于商业用途，下载后请在 24 小时内删除。
        </p>
      </div>
    </section>
  );
}
