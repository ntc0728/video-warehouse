import { useCallback, useRef } from 'react';
import { Subtitles } from 'lucide-react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { Icon } from "@/components/ui/Icon";

interface SubtitleControlProps {
  onImportSubtitle: (file: File) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'subtitle';

export default function SubtitleControl({ onImportSubtitle, activePopover, onPopoverChange }: SubtitleControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleUrl = usePlayerStore(s => s.subtitleUrl);
  const setSubtitleUrl = usePlayerStore(s => s.setSubtitleUrl);
  const { autoTranslate, setAutoTranslate, targetLang, setTargetLang, translationAppId, translationApiKey } = useSettingsStore();

  const isOpen = activePopover === POPOVER_ID;

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
    onPopoverChange(null);
  }, [onPopoverChange]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSubtitle(file);
    e.target.value = '';
  }, [onImportSubtitle]);

  const handleClose = useCallback(() => {
    const url = usePlayerStore.getState().subtitleUrl;
    if (url) URL.revokeObjectURL(url);
    setSubtitleUrl(null);
    onPopoverChange(null);
  }, [setSubtitleUrl, onPopoverChange]);

  const handleButtonTouch = useCallback(() => {
    if (isOpen) {
      onPopoverChange(null);
    } else {
      onPopoverChange(POPOVER_ID);
    }
  }, [isOpen, onPopoverChange]);

  return (
    <div
      className="up-popover-control"
      onMouseEnter={() => onPopoverChange(POPOVER_ID)}
      onMouseLeave={() => onPopoverChange(null)}
    >
      <button
        title="字幕"
        onTouchStart={handleButtonTouch}
      >
        <Icon icon={Subtitles} size="md" />
      </button>
      {isOpen && (
        <div className="up-popover up-subtitle-popover" onMouseEnter={() => onPopoverChange(POPOVER_ID)} onMouseLeave={() => onPopoverChange(null)}>
          <button className="up-popover-item" onClick={handleImport}>导入字幕</button>
          {translationAppId && translationApiKey && (
            <>
              <button className="up-popover-item" onClick={() => { setAutoTranslate(!autoTranslate); }}>
                翻译: {autoTranslate ? '开' : '关'}
              </button>
              <button className="up-popover-item" onClick={() => { setTargetLang(targetLang === 'zh' ? 'en' : 'zh'); }}>
                →{targetLang === 'zh' ? '英文' : '中文'}
              </button>
            </>
          )}
          {subtitleUrl && (
            <button className="up-popover-item" onClick={handleClose}>关闭字幕</button>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
