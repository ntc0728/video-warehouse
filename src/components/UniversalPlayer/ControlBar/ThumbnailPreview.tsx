import { useMemo } from 'react';

export interface ThumbnailSource {
  /** 缩略图地址（精灵图时为单帧图 URL；由 timeToUrl 计算） */
  url: string;
  /** 由 hover 时间点解析出该时刻的缩略图 URL（无则整体降级为时间戳 tooltip） */
  timeToUrl?: (time: number) => string;
}

interface ThumbnailPreviewProps {
  source?: ThumbnailSource;
  time: number;
  /** 无缩略图源时的回退文本（如 `1:23`），与 ProgressBar 时间 tooltip 语义一致 */
  fallback: string;
}

/**
 * G1：进度条 hover 缩略图预览。
 * 提供缩略图源时展示该时刻的预览图；无源时回退显示时间戳文本。
 * 精灵图（vtt 列表）解析暂不实现——接入真实缩略图源时扩展 timeToUrl。
 */
export default function ThumbnailPreview({ source, time, fallback }: ThumbnailPreviewProps) {
  const thumbUrl = useMemo(() => {
    if (!source?.url) return null;
    if (source.timeToUrl) return source.timeToUrl(time);
    return source.url;
  }, [source, time]);

  if (!thumbUrl) {
    return <span className="up-thumbnail-preview__fallback">{fallback}</span>;
  }

  return (
    <img
      className="up-thumbnail-preview__img"
      src={thumbUrl}
      alt=""
      loading="lazy"
      draggable={false}
    />
  );
}