import { useLayoutEffect, useRef, useState } from 'react';
import './MarqueeText.css';

export interface MarqueeTextProps {
  /** 内容签名：变化时重新检测是否溢出（通常传纯文本；children 可能是复合 JSX） */
  signature: string;
  children: React.ReactNode;
  /** 附加 class（调用方用它接管宽度 / flex 分配） */
  className?: string;
  /** false = 只裁剪不滚动（默认溢出即滚动） */
  scroll?: boolean;
  /** 原生 title 提示（可选，滚动已能看全时一般不需要） */
  title?: string;
}

/**
 * 单行文本溢出跑马灯：`scrollWidth > clientWidth` 时循环滚动完整内容，
 * 否则静态显示。溢出才插入 `aria-hidden` 副本文案，`translateX(-50%)` 无缝衔接
 * （每份尾部 padding 充当循环间距）。
 *
 * 用途：播放器 header 标题、播放页折叠面板 tab（源名 / 季名 / 集名）——
 * 换源后信息型集名很长（「元旦特辑：戴立克的革命·HD中字」），任何固定宽度
 * 都会截断，滚动比省略号更能保住信息。
 */
export function MarqueeText({ signature, children, className = '', scroll = true, title }: MarqueeTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [signature]);

  const scrolling = scroll && overflows;

  return (
    <span ref={rootRef} className={`mq-root${className ? ` ${className}` : ''}`} title={title}>
      <span className={`mq-track${scrolling ? ' mq-track--scrolling' : ''}`}>
        <span className="mq-text">{children}</span>
        {scrolling && <span className="mq-text" aria-hidden="true">{children}</span>}
      </span>
    </span>
  );
}

export default MarqueeText;
