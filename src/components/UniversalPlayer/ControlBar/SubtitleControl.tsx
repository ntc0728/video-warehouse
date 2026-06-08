import { useState, useCallback, useRef } from 'react';
import { Subtitles } from 'lucide-react';
import { usePlayerStore, useSubtitleStore } from '@/stores';

interface SubtitleControlProps {
  onImportSubtitle: (file: File) => void;
}

export default function SubtitleControl({ onImportSubtitle }: SubtitleControlProps) {
  const [showPopover, setShowPopover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleUrl = usePlayerStore(s => s.subtitleUrl);
  const setSubtitleUrl = usePlayerStore(s => s.setSubtitleUrl);
  const { autoTranslate, setAutoTranslate, targetLang, setTargetLang, translationAppId, translationApiKey } = useSubtitleStore();

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
    setShowPopover(false);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSubtitle(file);
    e.target.value = '';
  }, [onImportSubtitle]);

  const handleClose = useCallback(() => {
    const url = usePlayerStore.getState().subtitleUrl;
    if (url) URL.revokeObjectURL(url);
    setSubtitleUrl(null);
    setShowPopover(false);
  }, [setSubtitleUrl]);

  return (
    <div className="up-popover-control">
      <button
        className={`up-control-btn ${subtitleUrl ? 'up-control-btn-active' : ''}`}
        onClick={() => setShowPopover(!showPopover)}
        title="字幕"
      >
        <Subtitles size={20} />
      </button>
      {showPopover && (
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
