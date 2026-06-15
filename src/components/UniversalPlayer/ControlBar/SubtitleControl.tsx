import { useCallback, useRef } from 'react';
import { Subtitles } from 'lucide-react';
import { usePlayerStore, useSubtitleStore } from '@/stores';

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
  const { autoTranslate, setAutoTranslate, targetLang, setTargetLang, translationAppId, translationApiKey } = useSubtitleStore();

  const isOpen = activePopover === POPOVER_ID;

  const handleToggle = useCallback(() => {
    onPopoverChange(isOpen ? null : POPOVER_ID);
  }, [isOpen, onPopoverChange]);

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

  return (
    <div className="up-popover-control">
      <button
        className={`up-control-btn ${subtitleUrl ? 'up-control-btn-active' : ''}`}
        onClick={handleToggle}
        title="字幕"
      >
        <Subtitles size={20} />
      </button>
      {isOpen && (
        <div className="up-popover up-subtitle-popover">
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
