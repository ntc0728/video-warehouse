import type { ReactNode } from 'react';

interface ChangelogContentProps {
  raw: string;
}

/** 解析 CHANGELOG.md：`## [版本](链接) (日期)` → 版本块，`### 分组` → 组，`* 条目` → 日志条目 */
interface ChangelogVersion {
  title: string;       // 完整标题行（含日期）
  version: string;     // 版本号（如 1.1.0）
  date: string;        // 日期（如 2026-07-30）
  groups: { heading: string; items: string[] }[];
}

/** 提取版本号（[x.y.z] 或 x.y.z） */
function extractVersion(title: string): string {
  const m = title.match(/\[?v?(\d+\.\d+\.\d+[-\w.]*)\]?/);
  return m ? m[1] : title.replace(/^#+\s*/, '').trim().slice(0, 12);
}

/** 提取日期（YYYY-MM-DD） */
function extractDate(title: string): string {
  const m = title.match(/\((\d{4}-\d{2}-\d{2})\)/);
  return m ? m[1] : '';
}

const formatInline = (text: string): string =>
  text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );

/** 将 release-please 生成的 CHANGELOG.md 渲染为「左时间轴 + 右内容」双栏布局：
 *  左侧：垂直时间轴，每个轴点显示版本号；
 *  右侧：对应版本的日志内容（分组 + 条目）。 */
export default function ChangelogContent({ raw }: ChangelogContentProps) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  const versions: ChangelogVersion[] = [];
  let currentVersion: ChangelogVersion | null = null;
  let currentGroup: { heading: string; items: string[] } | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (line.startsWith('## ')) {
      currentVersion = {
        title: line.slice(3),
        version: extractVersion(line.slice(3)),
        date: extractDate(line.slice(3)),
        groups: [],
      };
      currentGroup = null;
      versions.push(currentVersion);
      return;
    }
    if (!currentVersion) return;
    if (line.startsWith('### ')) {
      currentGroup = { heading: line.slice(4), items: [] };
      currentVersion.groups.push(currentGroup);
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (currentGroup) {
        currentGroup.items.push(line.slice(2));
      } else {
        currentVersion.groups.push({ heading: '', items: [line.slice(2)] });
      }
      return;
    }
  });

  const nodes: ReactNode[] = [];
  if (versions.length === 0) {
    // 兜底：无结构化版本时原样渲染
    return <div className="changelog-content">{raw}</div>;
  }

  versions.forEach((v, vi) => {
    const isLast = vi === versions.length - 1;
    nodes.push(
      <div key={v.title + vi} className="cl-row">
        {/* 左列：时间轴轴点（版本号） */}
        <div className="cl-timeline">
          <div className={`cl-node${isLast ? ' cl-node--latest' : ''}`}>
            <span className="cl-node-version">{v.version}</span>
            {v.date && <span className="cl-node-date">{v.date}</span>}
          </div>
          {!isLast && <div className="cl-line" />}
        </div>
        {/* 右列：日志内容 */}
        <div className="cl-body">
          {v.groups.length === 0 && (
            <p className="cl-p">{formatInline(v.title)}</p>
          )}
          {v.groups.map((g, gi) => (
            <div key={gi} className="cl-group">
              {g.heading && <h4 className="cl-sub">{g.heading}</h4>}
              {g.items.map((item, ii) => (
                <div
                  key={ii}
                  className="cl-item"
                  dangerouslySetInnerHTML={{ __html: formatInline(item) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>,
    );
  });

  return <div className="changelog-content">{nodes}</div>;
}
