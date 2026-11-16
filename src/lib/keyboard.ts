/** 软键盘主动收起工具（浮层关闭 / 点击非输入区 / 下拉关闭手势） */

/** 焦点在文本类控件上时 blur（键盘随浮层一起收起） */
export function blurActiveEditable(): void {
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.matches('input, textarea, select, [contenteditable="true"]')
  ) {
    active.blur();
  }
}

/** 事件目标是否落在文本类控件内（是则保留键盘） */
export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  );
}
