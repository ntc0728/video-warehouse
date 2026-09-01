import { Modal } from '@/components/ui';
import Switch from '@/components/ui/Switch';
import { mobileSettingsToast } from '../PlayerToast';

interface SubtitleSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  /** 双语字幕（百度翻译追加双语行） */
  autoTranslate: boolean;
  onAutoTranslateChange: (on: boolean) => void;
  /** 字幕大字号开关（映射 subtitleSettings.fontSize 24 ↔ 40） */
  bigFont: boolean;
  onBigFontChange: (on: boolean) => void;
  /** 翻译目标语言（zh / en） */
  targetLang: string;
  onTargetLangChange: (lang: string) => void;
  /** 是否已配置百度翻译 API（无密钥时隐藏翻译区块） */
  translationConfigured: boolean;
  /**
   * Portal 容器（全屏场景必传，否则 body 下的弹窗被全屏盖住）
   */
  portalContainer?: HTMLElement | null;
}

/** 字幕设置二级弹窗（移动端更多设置 → 字幕设置）：
 *  双语字幕 / 字幕大字号 / 翻译语言（百度翻译 AI）。 */
export default function SubtitleSettingsModal({
  visible, onClose,
  portalContainer,
  autoTranslate, onAutoTranslateChange,
  bigFont, onBigFontChange,
  targetLang, onTargetLangChange,
  translationConfigured,
}: SubtitleSettingsModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="字幕设置" className="up-subsettings-modal" portalContainer={portalContainer}>
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label">双语字幕</div>
          <Switch
            checked={autoTranslate}
            onChange={(on) => {
              onAutoTranslateChange(on);
              mobileSettingsToast(on ? '双语字幕已开启' : '双语字幕已关闭', 1800);
            }}
          />
        </div>
        <div className="up-ms-row">
          <div className="up-ms-label">字幕大字号</div>
          <Switch
            checked={bigFont}
            onChange={(on) => {
              onBigFontChange(on);
              mobileSettingsToast(on ? '字幕大字号已开启' : '字幕大字号已关闭', 1800);
            }}
          />
        </div>
      </div>

      {translationConfigured && (
        <>
          <div className="up-ms-group-label">
            翻译语言 <span className="up-ms-badge">百度翻译 AI</span>
          </div>
          <div className="up-ms-card">
            <div className="up-ms-row">
              <div className="up-ms-label">目标语言</div>
              <div className="up-ms-chips">
                {(['zh', 'en'] as const).map(lang => (
                  <button
                    key={lang}
                    className={`up-ms-chip${targetLang === lang ? ' up-ms-chip--on' : ''}`}
                    onClick={() => {
                      onTargetLangChange(lang);
                      mobileSettingsToast(`翻译语言 → ${lang === 'zh' ? '中文' : 'English'}（百度翻译 AI）`, 1800);
                    }}
                  >
                    {lang === 'zh' ? '中文' : 'English'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!translationConfigured && (
        <div className="up-ms-hint">未配置翻译 API，双语翻译暂不可用（可在设置 → 视频设置 中配置百度翻译）</div>
      )}
    </Modal>
  );
}