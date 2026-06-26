/**
 * 输入设备检测 Hook
 * 返回当前的输入设备类型
 * - 'coarse': 触摸设备（手机/平板）
 * - 'fine':   鼠标/触控板（桌面端）
 * - 'tv':     TV 遥控器（data-device="tv"）
 */
import { useState, useEffect } from 'react';

type PointerType = 'coarse' | 'fine' | 'tv';

/** 检测当前输入设备类型，支持触摸、鼠标和电视遥控器 */
export function usePointerType(): PointerType {
  const [pointerType, setPointerType] = useState<PointerType>(() => {
    if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-device') === 'tv') {
      return 'tv';
    }
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      return 'coarse';
    }
    return 'fine';
  });

  useEffect(() => {
    // TV 状态通过 data-device 属性控制，由 AppLayout 设置
    const observer = new MutationObserver(() => {
      if (document.documentElement.getAttribute('data-device') === 'tv') {
        setPointerType('tv');
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-device'] });

    // 检测指针类型变化（如外接鼠标/触控板）
    const coarseMql = window.matchMedia('(pointer: coarse)');
    const fineMql = window.matchMedia('(pointer: fine)');

    const updatePointer = () => {
      // TV 优先
      if (document.documentElement.getAttribute('data-device') === 'tv') {
        setPointerType('tv');
        return;
      }
      if (coarseMql.matches) {
        setPointerType('coarse');
      } else if (fineMql.matches) {
        setPointerType('fine');
      }
    };

    coarseMql.addEventListener('change', updatePointer);
    fineMql.addEventListener('change', updatePointer);

    return () => {
      observer.disconnect();
      coarseMql.removeEventListener('change', updatePointer);
      fineMql.removeEventListener('change', updatePointer);
    };
  }, []);

  return pointerType;
}
