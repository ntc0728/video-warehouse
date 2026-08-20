import { useCallback, useRef, useEffect } from 'react';
import { useSettingsStore, usePlayerStore } from '@/stores';
import { srtToVtt } from '../lib/utils';

export function useSubtitleImport() {
  const blobUrlRef = useRef<string | null>(null);

  // 清理 blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleImportSubtitle = useCallback(async (file: File) => {
    const { autoTranslate, translationAppId, translationApiKey, targetLang } = useSettingsStore.getState();
    const { setSubtitleUrl } = usePlayerStore.getState();

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      let finalText = text;

      if (autoTranslate && translationAppId && translationApiKey) {
        try {
          const { translate } = await import('@/services/translator');
          const blocks = text.trim().replace(/\r\n/g, '\n').split('\n\n');
          const translatedBlocks: string[] = [];

          for (let i = 0; i < blocks.length; i += 10) {
            const batch = blocks.slice(i, i + 10);
            const textsToTranslate = batch.map(b => {
              const lines = b.split('\n');
              return lines.length >= 3 ? lines.slice(2).join('\n') : '';
            }).filter(t => t);

            if (textsToTranslate.length === 0) {
              translatedBlocks.push(...batch);
              continue;
            }

            const combined = textsToTranslate.join('\n');
            const translated = await translate({
              text: combined,
              from: 'auto',
              to: targetLang,
              appId: translationAppId,
              key: translationApiKey,
            });

            const translatedLines = translated.split('\n');
            let transIdx = 0;

            for (const b of batch) {
              const lines = b.split('\n');
              if (lines.length >= 3) {
                const translatedText = translatedLines[transIdx] || lines.slice(2).join('\n');
                lines.push('', translatedText);
                transIdx++;
              }
              translatedBlocks.push(lines.join('\n'));
            }
          }

          finalText = translatedBlocks.join('\n\n');
        } catch (err) {
          console.error('Subtitle translation failed:', err);
        }
      }

      let blob: Blob;
      if (file.name.endsWith('.srt')) {
        const vttContent = srtToVtt(finalText);
        blob = new Blob([vttContent], { type: 'text/vtt' });
      } else {
        blob = new Blob([finalText], { type: 'text/vtt' });
      }

      // 撤销旧的 blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setSubtitleUrl(blobUrl);
    };
    reader.readAsText(file);
  }, []);

  return { handleImportSubtitle };
}
