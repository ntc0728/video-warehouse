import { List, Switch, Button, HelpPopover, Select, toast } from '@/components/ui';
import { Tv } from 'lucide-react';
import type { IPTVSourceConfig, EPGSourceConfig } from '@/types';
import { Icon } from "@/components/ui/Icon";

interface IptvTabProps {
  iptvSettings: {
    proxyUrl: string;
    proxyPattern: string;
    autoRefresh: boolean;
    refreshIntervalHours: number;
  };
  setIPTVSettings: (s: Partial<IptvTabProps['iptvSettings']>) => void;
  iptvSourceIndices: number[];
  epgUrls: string[];
  epgUpdateInterval: number;
  setEpgUpdateInterval: (v: number) => void;
  iptvSources: IPTVSourceConfig[];
  epgSources: EPGSourceConfig[];
  handleIptvSourcesChange: (indices: string[]) => void;
  handleEpgChange: (urls: string[]) => void;
  onEditIptvProxy: () => void;
  onEditIptvPattern: () => void;
}

export default function IptvTab({
  iptvSettings, setIPTVSettings,
  iptvSourceIndices, epgUrls, epgUpdateInterval, setEpgUpdateInterval,
  iptvSources, epgSources,
  handleIptvSourcesChange, handleEpgChange,
  onEditIptvProxy, onEditIptvPattern,
}: IptvTabProps) {
  return (
    <section>
      <List header={<span className="settings-section-header"><Icon icon={Tv} size="md" /> IPTV</span>}>
        <List.Item
          title={<>IPTV 数据源<HelpPopover title="IPTV 数据源" content="选择IPTV M3U播放列表数据源。支持多选（最多3个），可同时加载多个源的频道。" /></>}
          description="选择IPTV数据源（支持多选，最多3个）"
          extra={
            <Select
              multiple
              options={iptvSources.map((source, index) => ({ value: String(index), label: source.name }))}
              value={(iptvSourceIndices || [0]).map(String)}
              onChange={handleIptvSourcesChange}
              maxSelected={3}
              onMaxReached={() => toast.show({ content: '最多选择3个数据源', type: 'warning' })}
            />
          }
        />
        <List.Item
          title={<>节目单源<HelpPopover title="节目单源" content="EPG（电子节目单）用于显示频道当前播放的节目信息。选择节目单数据源，支持多选，可从多个源获取节目数据。" /></>}
          description="选择节目单数据源（支持多选）"
          extra={
            <Select
              multiple
              options={epgSources.map((source) => ({ value: source.url, label: source.name }))}
              value={epgUrls}
              onChange={handleEpgChange}
              maxSelected={3}
              onMaxReached={() => toast.show({ content: '最多选择3个节目单源', type: 'warning' })}
            />
          }
        />
        <List.Item
          title={<>节目单更新间隔<HelpPopover title="节目单更新间隔" content="设置节目单数据的自动更新间隔时间。建议6-12小时更新一次，避免频繁请求。" /></>}
          description={`${epgUpdateInterval} 小时`}
          extra={
            <div className="settings-counter">
              <button className="settings-counter-btn" onClick={() => setEpgUpdateInterval(Math.max(1, epgUpdateInterval - 1))} disabled={epgUpdateInterval <= 1}>-</button>
              <span className="settings-counter-value">{epgUpdateInterval}</span>
              <button className="settings-counter-btn" onClick={() => setEpgUpdateInterval(Math.min(24, epgUpdateInterval + 1))} disabled={epgUpdateInterval >= 24}>+</button>
            </div>
          }
        />
        <List.Item
          title={<>IPTV代理服务器地址<HelpPopover title="流代理地址" content="IPTV 播放依赖此代理绕过浏览器跨域限制，未配置将可能无法播放。部署 Cloudflare Worker 后填入地址，格式如 https://your-worker.workers.dev" /></>}
          description={iptvSettings.proxyUrl || '未配置'}
          extra={
            <Button size="sm" className="settings-btn-mini" onClick={onEditIptvProxy}>配置</Button>
          }
        />
        <List.Item
          title={<>代理规则<HelpPopover title="代理规则" content="设置代理规则正则表达式。匹配正则的URL不走代理，其余走代理。留空则所有地址都走代理。用于区分需要代理和不需要代理的流地址。" /></>}
          description={iptvSettings.proxyPattern || '默认: 内置直连白名单（咪咕/腾讯云/阿里 CDN 等直连，其余走代理）'}
          extra={
            <Button size="sm" className="settings-btn-mini" onClick={onEditIptvPattern}>配置</Button>
          }
        />
        <List.Item
          title={<>自动刷新频道<HelpPopover title="自动刷新频道" content="开启后会定期从数据源拉取最新的频道列表并更新缓存。" /></>}
          description="定期自动更新频道列表"
          extra={<Switch checked={iptvSettings.autoRefresh} onChange={(v) => setIPTVSettings({ autoRefresh: v })} />}
        />
        <List.Item
          title={<>刷新间隔<HelpPopover title="刷新间隔" content="设置频道列表的自动刷新间隔时间。建议6-24小时更新一次，避免频繁请求。" /></>}
          description={`${iptvSettings.refreshIntervalHours} 小时`}
          extra={
            <div className="settings-counter">
              <button className="settings-counter-btn" onClick={() => setIPTVSettings({ refreshIntervalHours: Math.max(1, iptvSettings.refreshIntervalHours - 1) })} disabled={iptvSettings.refreshIntervalHours <= 1}>-</button>
              <span className="settings-counter-value">{iptvSettings.refreshIntervalHours}</span>
              <button className="settings-counter-btn" onClick={() => setIPTVSettings({ refreshIntervalHours: Math.min(72, iptvSettings.refreshIntervalHours + 1) })} disabled={iptvSettings.refreshIntervalHours >= 72}>+</button>
            </div>
          }
        />
      </List>
    </section>
  );
}
