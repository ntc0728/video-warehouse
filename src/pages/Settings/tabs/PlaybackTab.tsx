import { List, Switch, HelpPopover } from '@/components/ui';
import { PlayCircle } from 'lucide-react';

interface PlaybackTabProps {
  skipIntro: boolean;
  setSkipIntro: (v: boolean) => void;
  skipIntroDuration: number;
  setSkipIntroDuration: (v: number) => void;
  skipOutro: boolean;
  setSkipOutro: (v: boolean) => void;
  skipOutroDuration: number;
  setSkipOutroDuration: (v: number) => void;
  autoPlay: boolean;
  setAutoPlay: (v: boolean) => void;
}

export default function PlaybackTab({
  skipIntro, setSkipIntro, skipIntroDuration, setSkipIntroDuration,
  skipOutro, setSkipOutro, skipOutroDuration, setSkipOutroDuration,
  autoPlay, setAutoPlay,
}: PlaybackTabProps) {
  return (
    <section>
      <List header={<span className="settings-section-header"><PlayCircle size={20} /> 播放设置</span>}>
        <List.Item
          title={<>跳过片头<HelpPopover title="跳过片头" content="开启后播放视频时自动跳过片头部分。可在下方设置跳过时长。" /></>}
          description="播放时自动跳过片头"
          extra={<Switch checked={skipIntro} onChange={setSkipIntro} />}
        />
        <List.Item
          title="片头跳过时长"
          description={`${skipIntroDuration} 秒`}
          extra={
            <div className="settings-counter">
              <button className="settings-counter-btn" onClick={() => setSkipIntroDuration(Math.max(10, skipIntroDuration - 10))} disabled={skipIntroDuration <= 10}>-</button>
              <span className="settings-counter-value">{skipIntroDuration}</span>
              <button className="settings-counter-btn" onClick={() => setSkipIntroDuration(Math.min(300, skipIntroDuration + 10))} disabled={skipIntroDuration >= 300}>+</button>
            </div>
          }
        />
        <List.Item
          title={<>跳过片尾<HelpPopover title="跳过片尾" content="开启后播放视频接近结尾时自动跳转到下一集或结束播放。可在下方设置提前多少秒触发。" /></>}
          description="播放时自动跳过片尾"
          extra={<Switch checked={skipOutro} onChange={setSkipOutro} />}
        />
        <List.Item
          title="片尾跳过时长"
          description={`${skipOutroDuration} 秒`}
          extra={
            <div className="settings-counter">
              <button className="settings-counter-btn" onClick={() => setSkipOutroDuration(Math.max(10, skipOutroDuration - 10))} disabled={skipOutroDuration <= 10}>-</button>
              <span className="settings-counter-value">{skipOutroDuration}</span>
              <button className="settings-counter-btn" onClick={() => setSkipOutroDuration(Math.min(300, skipOutroDuration + 10))} disabled={skipOutroDuration >= 300}>+</button>
            </div>
          }
        />
        <List.Item
          title={<>自动连播<HelpPopover title="自动连播" content="剧集播放结束后自动播放下一集。关闭后需要手动点击播放下一集。" /></>}
          description="剧集播放结束后自动播放下一集"
          extra={<Switch checked={autoPlay} onChange={setAutoPlay} />}
        />
      </List>
    </section>
  );
}
