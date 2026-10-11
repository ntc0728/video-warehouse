/**
 * 错误日志「独立设置组 + 弹窗」（2026-10-11 新增，同日二次调整）
 * ─────────────────────────────────────────────
 * 个人设置页独立 section（用户要求：单独一个设置项，行内不带右箭头）。
 * 点击行主体打开弹窗（版式对齐「更新日志」：同 Modal 壳 + changelog-modal
 * 宽度 + cl-* 时间轴按天分组）；行最右「清除日志」按钮：hover/点击无黑框
 * （Settings.css 抑制焦点环）；两按钮均挂 .no-press 豁免全局「内容缩放」
 * 按压缩放——否则按下时文本子元素 scale 0.96 导致提示语「位移」（index.css，
 * 其 .settings-page 豁免类实际不存在于本页）。
 * 数据来源 errorLogService（JS/Promise/接口错误本地收集）。
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { Modal, toast } from '@/components/ui';
import {
  getErrorLogs,
  clearErrorLogs,
  subscribeErrorLogs,
  type ErrorLogEntry,
} from '@/services/errorLogService';
import { Icon } from "@/components/ui/Icon";
import { ScrollText } from 'lucide-react';

const KIND_LABEL: Record<ErrorLogEntry['kind'], string> = {
  js: '运行错误',
  promise: '异步错误',
  api: '接口错误',
};

/** ts → YYYY-MM-DD（分组键）与 MM-DD（轴点显示） */
function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 弹窗内容：与 ChangelogContent 同构的「左时间轴 + 右条目」，轴点=日期 */
function ErrorLogContent({ entries }: { entries: ErrorLogEntry[] }) {
  const groups = new Map<string, ErrorLogEntry[]>();
  entries.forEach((e) => {
    const k = dayKey(e.ts);
    const list = groups.get(k);
    if (list) list.push(e);
    else groups.set(k, [e]);
  });
  const days = [...groups.entries()];
  return (
    <div className="changelog-content">
      {days.map(([day, list], gi) => {
        const isLast = gi === days.length - 1;
        return (
          <div key={day} className="cl-row">
            <div className="cl-timeline">
              <div className={`cl-node${isLast ? ' cl-node--latest' : ''}`}>
                <span className="cl-node-version">{day.slice(5)}</span>
                <span className="cl-node-date">{day.slice(0, 4)}</span>
              </div>
              {!isLast && <div className="cl-line" />}
            </div>
            <div className="cl-body">
              {list.map((e) => {
                const d = new Date(e.ts);
                const p = (n: number) => String(n).padStart(2, '0');
                const time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
                return (
                  <div key={e.id} className="cl-item el-item">
                    <span className={`el-kind el-kind--${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                    <div className="el-main">
                      <div className="el-msg" title={e.message}>
                        {e.message}
                        {e.count > 1 && <span className="el-count">×{e.count}</span>}
                      </div>
                      <div className="el-src">{time} · {e.source}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ErrorLogRow() {
  const [entries, setEntries] = useState<ErrorLogEntry[]>(() => getErrorLogs());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeErrorLogs(() => setEntries(getErrorLogs())), []);

  const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
    // 行主体可点开弹窗，清除按钮阻止冒泡避免误开
    e.stopPropagation();
    if (entries.length === 0) return;
    clearErrorLogs();
    toast.success('日志已清除');
  };

  return (
    <>
      {/* 独立设置组（2026-10-11 用户要求：错误日志单独一个设置项，行内不带右箭头） */}
      <section className="settings-personal-section">
        <h3 className="settings-card__title">
          <Icon icon={ScrollText} size="md" className="settings-card__title-icon" />
          <span>错误日志</span>
        </h3>
        <div className="settings-card__body">
          <div className="settings-row settings-row--log">
            <button
              type="button"
              className="settings-row__main no-press"
              onClick={() => setOpen(true)}
              aria-label="查看错误日志"
            >
              <span className="settings-row__label">
                <span className="settings-row__title">查看日志</span>
                <small>
                  {entries.length > 0
                    ? `共 ${entries.length} 条 · 记录于本机，用于排查与改进`
                    : '暂无错误记录 · 自动收集 JS / 接口错误'}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="settings-row__clear no-press"
              onClick={handleClear}
              disabled={entries.length === 0}
              aria-label="清除日志"
            >
              清除日志
            </button>
          </div>
        </div>
      </section>

      {/* 与「更新日志」同款弹窗壳（settings-modal changelog-modal：同宽度档 + 时间轴版式） */}
      <Modal visible={open} title="错误日志" onClose={() => setOpen(false)} className="settings-modal changelog-modal">
        {entries.length === 0 ? (
          <p className="el-empty">暂无错误记录。应用运行期间的 JS 报错与接口报错会自动记录在这里（本机存储，最多保留最近 300 条）。</p>
        ) : (
          <ErrorLogContent entries={entries} />
        )}
      </Modal>
    </>
  );
}
