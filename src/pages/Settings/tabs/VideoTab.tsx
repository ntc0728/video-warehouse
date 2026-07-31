import { List, Switch, Button, HelpPopover, Select, toast } from '@/components/ui';
import { Film, RadioTower } from 'lucide-react';
import type { VideoSourceConfig } from '@/types/source';
import { Icon } from "@/components/ui/Icon";

interface VideoTabProps {
  tmdbAccessToken: string;
  tmdbLanguage: string;
  setTMDBLanguage: (l: string) => void;
  videoSourceIndices: number[];
  corsProxy: string;
  rememberVolume: boolean;
  setRememberVolume: (v: boolean) => void;
  autoTranslate: boolean;
  setAutoTranslate: (v: boolean) => void;
  translationAppId: string;
  translationApiKey: string;
  videoSources: VideoSourceConfig[];
  handleVideoSourcesChange: (indices: string[]) => void;
  onEditTMDBToken: () => void;
  onEditCorsProxy: () => void;
  onEditBaiduApi: () => void;
}

const TMDB_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
];

export default function VideoTab({
  tmdbAccessToken, tmdbLanguage, setTMDBLanguage,
  videoSourceIndices, corsProxy,
  rememberVolume, setRememberVolume,
  autoTranslate, setAutoTranslate,
  translationAppId, translationApiKey,
  videoSources,
  handleVideoSourcesChange,
  onEditTMDBToken, onEditCorsProxy, onEditBaiduApi,
}: VideoTabProps) {
  return (
    <>
      <section>
        <List header={<span className="settings-section-header"><Icon icon={Film} size="md" /> TMDB</span>}>
          <List.Item
            title="TMDB Access Token"
            description={tmdbAccessToken ? '已配置' : '未配置（首页 TMDB 发现将不可用）'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={onEditTMDBToken}>
                配置
              </Button>
            }
          />
          <List.Item
            title="TMDB 语言"
            description="影响影片标题、简介等信息的显示语言"
            extra={
              <Select
                options={TMDB_LANGUAGES}
                value={tmdbLanguage}
                onChange={setTMDBLanguage}
              />
            }
          />
        </List>
      </section>

      <section>
        <List header={<span className="settings-section-header"><Icon icon={RadioTower} size="md" /> 视频源</span>}>
          <List.Item
            title={
              <>
                视频数据源
                <HelpPopover title="视频数据源" content="选择视频采集API数据源。支持多选（最多6个），播放时会同时从多个源搜索匹配资源。" />
              </>
            }
            description="选择视频数据源（最多6个）"
            extra={
              <Select
                multiple
                options={videoSources.map((source, index) => ({ value: String(index), label: source.name }))}
                value={(videoSourceIndices || [0]).map(String)}
                onChange={handleVideoSourcesChange}
                maxSelected={6}
                onMaxReached={() => toast.show({ content: '最多选择6个数据源', duration: 2000 })}
              />
            }
          />
          <List.Item
            title={
              <>
                视频采集CORS 代理
                <HelpPopover title="CORS 代理" content="CORS（跨域资源共享）代理用于绕过浏览器的跨域限制，让应用能访问其他服务器的视频数据。如果遇到跨域错误，请配置代理地址。留空则使用默认代理。" />
              </>
            }
            description={corsProxy || '默认: 不使用代理'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={onEditCorsProxy}>
                配置
              </Button>
            }
          />
          <List.Item
            title={
              <>
                音量记忆
                <HelpPopover title="音量记忆" content="开启后会记住上次播放时的音量大小，下次打开播放器时自动恢复。" />
              </>
            }
            description="记住上次播放时的音量大小"
            extra={<Switch checked={rememberVolume} onChange={setRememberVolume} />}
          />
          <List.Item
            title={
              <>
                自动翻译字幕
                <HelpPopover title="自动翻译字幕" content="开启后会自动调用百度翻译API将字幕翻译成目标语言。需要先配置百度翻译API。" />
              </>
            }
            description="开启后自动将字幕翻译成目标语言"
            extra={<Switch checked={autoTranslate} onChange={setAutoTranslate} />}
          />
          <List.Item
            title={
              <>
                百度翻译 API
                <HelpPopover title="百度翻译 API" content="配置百度翻译开放平台的App ID和密钥，用于自动翻译字幕功能。" />
              </>
            }
            description={translationAppId && translationApiKey ? '已配置' : '未配置'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={onEditBaiduApi}>
                {translationAppId && translationApiKey ? '修改' : '配置'}
              </Button>
            }
          />
        </List>
      </section>
    </>
  );
}
