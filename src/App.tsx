import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { TOAST_DURATION } from './components/ui/toastBus';
import AppLayout from './components/Layout/AppLayout';
import { HeaderProvider } from './components/Layout/HeaderContext';
import { useUserStore } from './stores';

function App() {
  // 首页 TMDB 数据不再在 App 层无条件预取（避免非首页刷新时也调用首页接口），
  // 改由 HomePage 挂载/显示时按需拉取（store 内有空数据判断 + in-flight 去重）。

  // 初始化用户数据（从 IndexedDB 加载）。
  //
  // ⚠️ 2026-09-18 用户拍板「gate 下沉」：App 层不再整页阻塞等待本地库。
  // 旧实现（9.1）在 dbReady 前 `return <AppLoading fullScreen tip="正在加载本地数据…"/>`，
  // 带来两个问题：
  //  1. 收藏 / 历史页的**页级骨架永远没有可见窗口** —— App 层已经把等待吃掉了，
  //     页面挂载时 store._loading 已是 false，骨架被跳过（用户实测「整改过但始终未实现」）；
  //  2. 整站（含完全不依赖本地数据的首页 / Browse / IPTV）白等 IndexedDB 最长 6s。
  // 现在恒定渲染 AppLayout，把「本地数据是否就绪」交给各自的消费方：
  //  - Collections / History：`useUserStore._loading` → 骨架 → 内容；
  //  - Home 的「继续观看」行：`userDataLoading || continueItems.length > 0`；
  //  - 其余页面不消费本地数据，直接渲染自身骨架 / 内容。
  const loadFromDB = useUserStore((s) => s._loadFromDB);
  useEffect(() => {
    // _loadFromDB 内部已 try/catch（失败写入 store.loadError，由页面渲染错误态 + 重试），
    // 这里只需吞掉可能的上游 rejection，避免 unhandled rejection。
    void loadFromDB().catch(() => { /* 失败态见 useUserStore.loadError */ });
  }, [loadFromDB]);

  return (
    <>
      <Toaster
        position="top-center"
        offset={0}
        toastOptions={{
          duration: TOAST_DURATION,
          classNames: {
            toast: 'app-toast',
          },
          style: {
            // 全局 sonner 统一黑色透明 + 圆角 + 文本撑开，与播放器内提示视觉一致
            background: 'rgba(0, 0, 0, 0.72)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            maxWidth: 'min(22rem, calc(100vw - 2rem))',
            // 宽度必须用 fit-content：auto 在绝对定位 + left/right 双边界下会被拉伸到
            // 容器宽度（最长 22rem），短文本 toast 也会撑满固定宽度；
            // fit-content 让宽高都由文本内容撑开 + 下方 padding
            width: 'fit-content',
            height: 'auto',
            textAlign: 'center',
            padding: 'var(--space-sm) var(--space-md)',
          },
        }}
      />
      <HeaderProvider>
        <AppLayout />
      </HeaderProvider>
    </>
  );
}

export default App;
