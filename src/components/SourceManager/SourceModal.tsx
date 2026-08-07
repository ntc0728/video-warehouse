/**
 * SourceModal — 源添加/编辑弹窗（受控组件）
 *
 * [2026-08-07 源管理整改]
 * - 视频源：名称 / 视频源 URL（api）/ 详情 URL（detail，可选，留空使用 api）/ 启用
 * - IPTV 源：名称 / URL / 启用
 * - EPG 源：名称 / URL / 启用
 * - 高级选项（超时/重试/视频源 ID 随机）目前保留 UI 占位（与图 1 一致），但 httpClient
 *   暂未提供按源级超时/重试配置，保存时忽略；视频源 ID 由 store 自动生成（避免与 builtin id 冲突）
 */
import { useEffect } from 'react';
import { Shuffle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import type { SourceScene } from '@/types/source';
import './SourceModal.css';

export interface SourceModalFormValue {
  name: string;
  url: string;
  detail: string;
  enabled: boolean;
  /** 高级选项展开状态 */
  showAdvanced: boolean;
  /** 自定义 id（高级 - 视频源 ID） */
  customId: string;
  /** 超时时间 ms（仅视频源；可编辑并应用） */
  timeoutMs: number;
  /** 重试次数（仅视频源；可编辑并应用） */
  retries: number;
}

export const EMPTY_FORM: SourceModalFormValue = {
  name: '',
  url: '',
  detail: '',
  enabled: true,
  showAdvanced: false,
  customId: '',
  timeoutMs: 3000,
  retries: 3,
};

export interface SourceModalProps {
  visible: boolean;
  scene: SourceScene;
  mode: 'add' | 'edit';
  value: SourceModalFormValue;
  onChange: (patch: Partial<SourceModalFormValue>) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function SourceModal(props: SourceModalProps) {
  const { visible, scene, mode, value, onChange, onClose, onSubmit } = props;
  const isVideo = scene === 'video';

  const title = mode === 'add'
    ? isVideo ? '添加视频源' : scene === 'iptv' ? '添加 IPTV 源' : '添加节目单源'
    : isVideo ? '编辑视频源' : scene === 'iptv' ? '编辑 IPTV 源' : '编辑节目单源';

  // 关闭时复位（父组件可重置 EMPTY_FORM；这里只保证动画态时父 key 触发重挂载）
  useEffect(() => {
    if (!visible) return;
    // nothing
  }, [visible]);

  const handleSubmit = () => {
    if (!value.name.trim() || !value.url.trim()) return;
    onSubmit();
  };

  return (
    <Modal visible={visible} title={title} onClose={onClose} className="source-modal-wrap">
      <div className="source-modal">
        <p className="source-modal__hint">
          {mode === 'add' ? '填写源基本信息后点击保存。' : '修改源信息后点击保存。'}
        </p>

        <Field label={isVideo ? '视频源名称' : '源名称'}>
          <input
            type="text"
            className="source-modal__input"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={isVideo ? '例如：新增源' : '例如：我的 IPTV'}
            autoFocus
          />
        </Field>

        <Field label={isVideo ? '视频源 URL' : 'URL'}>
          <input
            type="text"
            className="source-modal__input"
            value={value.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder={isVideo ? 'https://example.com/api' : 'https://example.com/playlist.m3u'}
          />
        </Field>

        {isVideo && (
          <Field label="详情 URL" hint="（可选，留空使用视频源 URL）">
            <input
              type="text"
              className="source-modal__input"
              value={value.detail}
              onChange={(e) => onChange({ detail: e.target.value })}
              placeholder="https://example.com/detail"
            />
          </Field>
        )}

        {/* 高级选项（仅视频源；与图 1 一致占位，httpClient 未提供按源配置前不写入） */}
        {isVideo && (
          <div className="source-modal__advanced">
            <button
              type="button"
              className="source-modal__advanced-toggle"
              onClick={() => onChange({ showAdvanced: !value.showAdvanced })}
              aria-expanded={value.showAdvanced}
            >
              <span className={`source-modal__chevron${value.showAdvanced ? ' is-open' : ''}`}>›</span>
              <span>高级选项</span>
            </button>
            {value.showAdvanced && (
              <div className="source-modal__advanced-body">
                <div className="source-modal__row">
                  <Field label="超时时间 (ms)">
                    <input
                      type="number"
                      className="source-modal__input"
                      value={value.timeoutMs}
                      min={500}
                      step={500}
                      onChange={(e) => onChange({ timeoutMs: Math.max(500, Number(e.target.value) || 3000) })}
                    />
                  </Field>
                  <Field label="重试次数">
                    <input
                      type="number"
                      className="source-modal__input"
                      value={value.retries}
                      min={0}
                      max={10}
                      onChange={(e) => onChange({ retries: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}
                    />
                  </Field>
                </div>
                <Field label="视频源 ID" hint="系统自动生成，保持唯一稳定">
                  <div className="source-modal__id-row">
                    <input
                      type="text"
                      className="source-modal__input"
                      value={value.customId}
                      onChange={(e) => onChange({ customId: e.target.value })}
                      placeholder="自动生成"
                    />
                    <button
                      type="button"
                      className="source-modal__id-toggle"
                      onClick={() => onChange({ customId: genId() })}
                    >
                      <Icon icon={Shuffle} size="sm" />
                      <span>随机</span>
                    </button>
                  </div>
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="source-modal__enable">
          <span className="source-modal__enable-label">启用</span>
          <label className="source-modal__switch">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
            />
            <span className="source-modal__switch-track" />
          </label>
        </div>

        <div className="source-modal__actions">
          <button type="button" className="source-modal__btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="source-modal__btn source-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!value.name.trim() || !value.url.trim()}
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}
function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="source-modal__field">
      <span className="source-modal__label">
        {label}
        {hint && <span className="source-modal__hint-inline">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
