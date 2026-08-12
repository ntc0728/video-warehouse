/**
 * SourceManager — 设置页源管理通用组件（视频源 / IPTV 源 / EPG 源共用）
 *
 * [2026-08-07 源管理整改]
 * - 列表：类型图标 + 名称 + 延迟徽章 + 爬建/自建徽章 + 添加时间 + 启用滑块 + 编辑/删除
 * - 工具栏（右侧）：测速 / 按延迟排序 / 全部启用停用
 * - "添加源"下拉：手动添加 / 导入(文件|URL|文本) / 导出(文件|文本)
 * - builtin 可停用不可删除；custom 可删除
 * - 测速只测启用源；批量并发 6
 * - 移动端友好
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Download,
  Edit3,
  FileText,
  Film,
  GripVertical,
  ListVideo,
  Plus,
  Radio,
  Trash2,
  Upload,
  Wifi,
} from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { HelpPopover } from '@/components/ui';
import { useSourceManagerStore, formatLatency } from '@/stores/useSourceManagerStore';
import { measureBatch } from '@/services/sourceLatency';
import { toast } from '@/components/ui/toastBus';
import type { SourceScene, ManagedSourceBase } from '@/types/source';
import './SourceManager.css';

/** 场景配置 */
const SCENE_CONFIG: Record<
  SourceScene,
  { title: string; hint: string; desc: string; addLabel: string; icon: typeof Film }
> = {
  video: {
    title: '视频源列表',
    hint: '在这里添加、编辑、导入、导出并控制视频源启用状态。启用的源将用于视频检索（最多 6 个）。',
    desc: '在这里添加、编辑、导入、导出并控制视频源启用状态。',
    addLabel: '添加视频源',
    icon: Film,
  },
  iptv: {
    title: 'IPTV 源列表',
    hint: '在这里添加、编辑、导入、导出并控制 IPTV 源启用状态。启用的源将用于频道加载（最多 3 个）。',
    desc: '在这里添加、编辑、导入、导出并控制 IPTV 源启用状态。',
    addLabel: '添加 IPTV 源',
    icon: Radio,
  },
  epg: {
    title: '节目单源列表',
    hint: '在这里添加、编辑、导入、导出并控制节目单源启用状态。启用的源将用于节目单匹配（最多 3 个）。',
    desc: '在这里添加、编辑、导入、导出并控制节目单源启用状态。',
    addLabel: '添加节目单源',
    icon: ListVideo,
  },
};

/** 通用 props */
export interface SourceManagerProps<T extends ManagedSourceBase> {
  scene: SourceScene;
  items: T[];
  onAdd: (input: { name: string; url: string; detail?: string }) => T | void;
  onUpdate: (id: string, patch: { name?: string; url?: string; detail?: string }) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  /** 达到启用上限时的提示（父组件可 toast） */
  getLatencyUrl: (item: T) => string;
  onLatencies: (map: Record<string, number | null>) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (item: T) => void;
  onImportFromFile: () => void;
  onImportFromUrl: () => void;
  onImportFromText: () => void;
  onExportToFile: () => void;
  onExportToText: () => void;
}

export default function SourceManager<T extends ManagedSourceBase>(props: SourceManagerProps<T>) {
  const { scene, items, onToggle, onOpenAddModal, onOpenEditModal, getLatencyUrl, onLatencies, onImportFromFile, onImportFromUrl, onImportFromText, onExportToFile, onExportToText } = props;

  const cfg = SCENE_CONFIG[scene];
  const TypeIcon = cfg.icon;
  const sortByLatency = useSourceManagerStore((s) => s.sortByLatency);
  const reorder = useSourceManagerStore((s) => s.reorder);
  const setMeasuringStore = useSourceManagerStore((s) => s.setMeasuring);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measureProgress, setMeasureProgress] = useState({ done: 0, total: 0 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);

  // 外部点击关闭下拉
  useEffect(() => {
    if (!isAddOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setIsAddOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isAddOpen]);

  const enabledCount = useMemo(() => items.filter((s) => s.status.enabled).length, [items]);

  /** 分批测速（前 3 个 → 300ms → 后 3 个，减少源站瞬时压力；只测启用源） */
  const handleMeasure = async () => {
    if (measuring) return;
    const targets = items.filter((s) => s.status.enabled);
    if (targets.length === 0) {
      toast.show({ content: '没有已启用的源可测速', type: 'warning' });
      return;
    }
    setMeasuring(true);
    setMeasureProgress({ done: 0, total: targets.length });
    // 第一批：标记 measuring 并测前 3 个
    const BATCH = 3;
    const BATCH_GAP_MS = 300;
    try {
      let doneCount = 0;
      const updateProgress = () => setMeasureProgress({ done: doneCount, total: targets.length });
      for (let i = 0; i < targets.length; i += BATCH) {
        const batch = targets.slice(i, i + BATCH);
        // 标记本批 measuring
        setMeasuringStore(scene, batch.map((s) => s.id), true);
        const map = await measureBatch(
          batch.map((s) => ({ id: s.id, url: getLatencyUrl(s) })),
          { concurrency: BATCH, onProgress: (p) => setMeasureProgress({ done: doneCount + p.done, total: targets.length }) },
        );
        const obj: Record<string, number | null> = {};
        map.forEach((v, k) => {
          obj[k] = v;
        });
        onLatencies(obj);
        doneCount += batch.length;
        updateProgress();
        // 批次间隔（最后一批不等待）
        if (i + BATCH < targets.length) {
          await new Promise((r) => setTimeout(r, BATCH_GAP_MS));
        }
      }
      // 全部完成，清除剩余 measuring（onLatencies 已清，但保险再清一次）
      setMeasuringStore(scene, targets.map((s) => s.id), false);
      toast.show({ content: '测速完成', type: 'success' });
    } catch (e) {
      setMeasuringStore(scene, items.filter((s) => s.status.enabled).map((s) => s.id), false);
      toast.show({ content: `测速失败：${(e as Error).message ?? '未知错误'}`, type: 'error' });
    } finally {
      setMeasuring(false);
    }
  };

  /** 拖拽开始：记录源项下标 */
  const handleDragStart = (index: number) => {
    setDragIndex(index);
    setOverIndex(index);
  };

  /** 拖拽经过：更新悬停目标（同项忽略） */
  const handleDragOver = (index: number) => {
    if (dragIndex === null) return;
    if (overIndex !== index) setOverIndex(index);
  };

  /** 放置：调用 store 重排 */
  const handleDrop = (index: number) => {
    if (dragIndex === null) return;
    if (dragIndex !== index) reorder(scene, dragIndex, index);
    setDragIndex(null);
    setOverIndex(null);
  };

  /** 拖拽结束/取消：清空状态 */
  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className={`source-manager-block${collapsed ? ' is-collapsed' : ''}`} data-scene={scene}>
      {/* 标题：单独拆解出来，位于卡片外，始终显示（不随折叠隐藏） */}
      <h3 className="source-manager__title">
        <Icon icon={TypeIcon} size="md" className="source-manager__title-icon" />
        {cfg.title}
        <HelpPopover title={cfg.title} content={cfg.hint} />
      </h3>

      {/* 卡片：Header（折叠展开按钮，含描述 + 徽章 + 箭头）+ 主体（Toolbar + List） */}
      <div className="source-manager">
      <button
        type="button"
        className="source-manager__header"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? '展开' : '折叠'}${cfg.title}`}
      >
        <p className="source-manager__desc">{cfg.desc}</p>
        <div className="source-manager__badge">已启用 {enabledCount}/{items.length}</div>
        <Icon icon={ChevronDown} size="sm" className="source-manager__collapse-chev" />
      </button>
      <div className="source-manager__body">
      <div className="source-manager__body-inner">
      <div className="source-manager__toolbar">
        <div className="source-manager__toolbar-right">
          <button type="button" className="source-manager__toolbar-btn" onClick={handleMeasure} disabled={measuring} aria-label="测速">
            {measuring ? <Icon icon={Activity} size="sm" className="spin" /> : <Icon icon={Wifi} size="sm" />}
            <span>{measuring ? `测速中 ${measureProgress.done}/${measureProgress.total}` : '测速'}</span>
          </button>
          {!measuring && (
            <button type="button" className="source-manager__toolbar-btn" onClick={() => sortByLatency(scene)} aria-label="按延迟排序">
              <Icon icon={Activity} size="sm" />
              <span>按延迟排序</span>
            </button>
          )}

          {/* 添加源下拉：手动添加 / 导入 / 导出 */}
          <div className="source-manager__popover-wrap" ref={addRef}>
            <button type="button" className="source-manager__add-btn" onClick={() => setIsAddOpen((v) => !v)} aria-expanded={isAddOpen} aria-haspopup="menu">
              <Icon icon={Plus} size="sm" />
              <span>添加</span>
              <Icon icon={ChevronDown} size="xs" />
            </button>
            {isAddOpen && (
              <div className="source-manager__popover source-manager__popover--right" role="menu">
                <button type="button" className="source-manager__popover-item" onClick={() => { setIsAddOpen(false); onOpenAddModal(); }}>
                  <Icon icon={Plus} size="sm" />
                  <span>手动添加</span>
                </button>
                <div className="source-manager__popover-group">
                  <span className="source-manager__popover-group-label"><Icon icon={Upload} size="xs" /> 导入</span>
                  <button type="button" className="source-manager__popover-item" onClick={() => { setIsAddOpen(false); onImportFromFile(); }}>从文件导入</button>
                  <button type="button" className="source-manager__popover-item" onClick={() => { setIsAddOpen(false); onImportFromUrl(); }}>从 URL 导入</button>
                  <button type="button" className="source-manager__popover-item" onClick={() => { setIsAddOpen(false); onImportFromText(); }}>从文本导入</button>
                </div>
                <div className="source-manager__popover-group">
                  <span className="source-manager__popover-group-label"><Icon icon={Download} size="xs" /> 导出</span>
                  <button type="button" className="source-manager__popover-item" onClick={() => { setIsAddOpen(false); onExportToFile(); }}>导出为文件</button>
                  <button type="button" className="source-manager__popover-item" onClick={() => { setIsAddOpen(false); onExportToText(); }}>导出为文本</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <ul className="source-manager__list">
        {items.length === 0 && (
          <li className="source-manager__empty">暂无源，点击「添加」开始</li>
        )}
        {items.map((item, index) => (
          <li
            key={item.id}
            className={`source-manager__item${!item.status.enabled ? ' is-disabled' : ''}${dragIndex === index ? ' is-dragging' : ''}${overIndex === index && dragIndex !== null && dragIndex !== index ? ' is-drop-target' : ''}`}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(index); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; handleDragOver(index); }}
            onDrop={(e) => { e.preventDefault(); handleDrop(index); }}
            onDragEnd={handleDragEnd}
          >
            <div className="source-manager__item-drag" title="拖拽排序" aria-label="拖拽排序">
              <Icon icon={GripVertical} size="md" />
            </div>
            <div className="source-manager__item-main">
              <div className="source-manager__item-title">
                <span className="source-manager__name">{item.name}</span>
                {/* 延迟状态：测速中显示旋转图标；测速完成按延迟分级显示颜色文字；超时红色「超时」 */}
                {item.status.measuring ? (
                  <span className="source-manager__latency source-manager__latency--measuring" aria-label="测速中">
                    <Icon icon={Activity} size="sm" className="spin" />
                  </span>
                ) : item.status.latency == null && item.status.latencyCheckedAt != null ? (
                  <span className="source-manager__latency source-manager__latency--error" title="测速失败/超时">超时</span>
                ) : item.status.latency != null ? (
                  <span className={`source-manager__latency source-manager__latency--${latencyTone(item.status.latency)}`}>
                    {formatLatency(item.status.latency)}
                  </span>
                ) : null}
              </div>
              <div className="source-manager__item-meta">
                {/* 爬建/自建徽章放原 time 位置；时间移到右侧 */}
                <span className={`source-manager__kind source-manager__kind--${item.kind}`}>
                  {item.kind === 'builtin' ? '爬建源' : '自建源'}
                </span>
                <span className="source-manager__time">{formatTime(item.addedAt)}</span>
              </div>
            </div>
            {/* 启用滑块（在前） */}
            <label className="source-manager__switch" title={item.status.enabled ? '停用' : '启用'}>
              <input
                type="checkbox"
                checked={item.status.enabled}
                onChange={(e) => onToggle(item.id, e.target.checked)}
              />
              <span className="source-manager__switch-track" />
            </label>
            <div className="source-manager__item-actions">
              <button type="button" className="source-manager__icon-btn" onClick={() => onOpenEditModal(item)} aria-label="编辑" title="编辑">
                <Icon icon={Edit3} size="md" />
              </button>
              {item.kind === 'custom' && (
                <button
                  type="button"
                  className="source-manager__icon-btn source-manager__icon-btn--danger"
                  onClick={() => {
                    if (confirm(`确认删除「${item.name}」？该操作不可撤销。`)) {
                      props.onDelete(item.id);
                      toast.show({ content: `已删除「${item.name}」`, type: 'success' });
                    }
                  }}
                  aria-label="删除"
                  title="删除"
                >
                  <Icon icon={Trash2} size="md" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      </div>
      </div>
    </div>
    </div>
  );
}

/** 时间戳 → "MM-DD HH:mm" */
function formatTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 延迟分级色调：
 * - <300ms  优（绿色，--success）
 * - 300-1000ms 中（黄色，--warning）
 * - >1000ms 差（红色，--error）
 * 返回 CSS modifier 名（fast/medium/slow），由 SourceManager.css 着色
 */
function latencyTone(ms: number): 'fast' | 'medium' | 'slow' {
  if (ms < 300) return 'fast';
  if (ms < 1000) return 'medium';
  return 'slow';
}

/* 抑制未用符号告警 */
void FileText;
void Download;
void Upload;
