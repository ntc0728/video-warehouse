/**
 * Select — 通用下拉选择器（单选 / 多选）
 *
 * 基于 @radix-ui/react-dropdown-menu 封装：
 *   - 单选：RadioItem（选中即收起）
 *   - 多选：CheckboxItem（选中保持展开，可连续勾选）
 * 自带 Portal + 视口翻转 + 碰撞检测，无需手写定位逻辑。
 * 样式使用 Tailwind arbitrary value + 项目 CSS 变量，组件自包含、可复用。
 */
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface BaseSelectProps {
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  emptyLabel?: string;
}

interface SingleSelectProps extends BaseSelectProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultipleSelectProps extends BaseSelectProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  maxSelected?: number;
  onMaxReached?: () => void;
}

export type SelectProps = SingleSelectProps | MultipleSelectProps;

const triggerBase =
  'group inline-flex items-center gap-1 min-h-[var(--comp-tab-height)] min-w-[var(--layout-select-w)] px-[14px] py-1 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text)] text-sm whitespace-nowrap cursor-pointer outline-none transition-colors hover:bg-[var(--color-surface-hover)] data-[state=open]:border-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed source-multi-trigger';

/* 层级体系（见 variables.css --z-*）：
   固定导航 sticky header 55 / sidebar-overlay 90 / sidebar 100
   局部浮层 --z-popover (200)  ← 本下拉归此档：高于固定导航（不再被侧边栏遮挡），
                                  低于 Modal(1000/1001)（弹窗打开时浮层被正常压住，不冲突）
   —— 下拉经 Radix Portal 挂 body，z-index 必须高于固定层才会显示，但绝不可抬到与弹窗同档。
   注意：portal-dropdown / source-multi-* 是 E2E 选择器钩子（collections.spec.ts / settings.spec.ts），勿删。 */
const contentBase =
  'z-[var(--z-popover)] mt-1 p-1 min-w-[var(--layout-select-w)] max-h-[320px] overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-md shadow-[var(--shadow-card)] portal-dropdown';

const itemBase =
  'relative flex items-center gap-2 pl-8 pr-3 py-2 text-sm text-[var(--color-text)] rounded-sm cursor-pointer outline-none select-none hover:bg-[var(--color-surface-hover)] data-[state=checked]:bg-[var(--color-surface-hover)] source-multi-option';

export function Select(props: SelectProps) {
  const { options, placeholder = '请选择', disabled, className, contentClassName, emptyLabel = '暂无选项' } = props;

  if (props.multiple === true) {
    const p = props;
    const triggerLabel = p.value.length > 0 ? `已选 ${p.value.length} 项` : placeholder;
    return (
      <div className="source-multi-dropdown inline-flex flex-shrink-0">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild disabled={disabled}>
            <button className={`${triggerBase} ${className ?? ''}`} type="button">
              <span className="flex-1 truncate text-left">{triggerLabel}</span>
              <Icon icon={ChevronDown} size="xs" className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={`${contentBase} ${contentClassName ?? ''}`}
              sideOffset={6}
              collisionPadding={8}
              style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[var(--color-text-tertiary)]">{emptyLabel}</div>
              ) : (
                options.map((opt) => {
                  const checked = p.value.includes(opt.value);
                  return (
                    <DropdownMenu.CheckboxItem
                      key={opt.value}
                      className={itemBase}
                      checked={checked}
                      onCheckedChange={(checkedState) => {
                        if (checkedState) {
                          if (p.maxSelected && p.value.length >= p.maxSelected) {
                            p.onMaxReached?.();
                            return;
                          }
                          p.onChange([...p.value, opt.value]);
                        } else {
                          p.onChange(p.value.filter((v) => v !== opt.value));
                        }
                      }}
                      onSelect={(event) => event.preventDefault()}
                    >
                      <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                        <Icon icon={Check} size="xs" />
                      </DropdownMenu.ItemIndicator>
                      <span className="flex-1 truncate">{opt.label}</span>
                    </DropdownMenu.CheckboxItem>
                  );
                })
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  }

  const p = props;
  const triggerLabel = options.find((o) => o.value === p.value)?.label ?? placeholder;
  return (
    <div className="source-multi-dropdown inline-flex flex-shrink-0">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild disabled={disabled}>
          <button className={`${triggerBase} ${className ?? ''}`} type="button">
            <span className="flex-1 truncate text-left">{triggerLabel}</span>
            <Icon icon={ChevronDown} size="xs" className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={`${contentBase} ${contentClassName ?? ''}`}
              sideOffset={6}
              collisionPadding={8}
              style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[var(--color-text-tertiary)]">{emptyLabel}</div>
            ) : (
              <DropdownMenu.RadioGroup value={p.value} onValueChange={(v) => p.onChange(v)}>
                {options.map((opt) => (
                  <DropdownMenu.RadioItem key={opt.value} value={opt.value} className={itemBase}>
                    <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                      <Icon icon={Check} size="xs" />
                    </DropdownMenu.ItemIndicator>
                    <span className="flex-1 truncate">{opt.label}</span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export default Select;
