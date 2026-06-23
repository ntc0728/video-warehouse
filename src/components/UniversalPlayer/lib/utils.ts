const VOLUME_POPUP_DELAY = 3000;

export function getAutoHideDelay(): number {
  return 3000;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function srtToVtt(srt: string): string {
  let vtt = 'WEBVTT\n\n';
  const blocks = srt.trim().replace(/\r\n/g, '\n').split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1].replace(/,/g, '.');
      const text = lines.slice(2).join('\n');
      vtt += `${timeLine}\n${text}\n\n`;
    }
  }
  return vtt;
}

export { VOLUME_POPUP_DELAY };
