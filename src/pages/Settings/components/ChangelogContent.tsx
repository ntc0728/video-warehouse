import type { ReactNode } from 'react';

interface ChangelogContentProps {
  raw: string;
}

/** 将 release-please 生成的 CHANGELOG.md 渲染为结构化、可滚动的更新日志 */
export default function ChangelogContent({ raw }: ChangelogContentProps) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];

  const formatInline = (text: string): string =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(
        /\[(.+?)\]\((.+?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      );

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') {
      nodes.push(<div key={i} className="cl-gap" />);
      return;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h3 key={i} className="cl-version">
          {line.slice(3)}
        </h3>,
      );
      return;
    }
    if (line.startsWith('### ')) {
      nodes.push(
        <h4 key={i} className="cl-sub">
          {line.slice(4)}
        </h4>,
      );
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(
        <div
          key={i}
          className="cl-item"
          dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }}
        />,
      );
      return;
    }
    if (line.startsWith('# ')) {
      // 顶层标题降级处理，避免与弹窗标题重复
      nodes.push(
        <p key={i} className="cl-title">
          {line.slice(2)}
        </p>,
      );
      return;
    }
    const isNote = line.startsWith('>');
    nodes.push(
      <p key={i} className={isNote ? 'cl-note' : 'cl-p'}>
        {isNote ? line.replace(/^>\s?/, '') : line}
      </p>,
    );
  });

  return <div className="changelog-content">{nodes}</div>;
}
