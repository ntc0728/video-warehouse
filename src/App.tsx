import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { TOAST_DURATION } from './components/ui/toastBus';
import AppLayout from './components/Layout/AppLayout';
import { HeaderProvider } from './components/Layout/HeaderContext';
import { useUserStore } from './stores';

function App() {
  // 首页 TMDB 数据不再在 App 层无条件预取（避免非首页刷新时也调用首页接口），
  // 改由 HomePage 挂载/显示时按需拉取（store 内有空数据判断 + in-flight 去重）。

  // 初始化用户数据（从 IndexedDB 加载），加载完成前显示 loading
  const [dbReady, setDbReady] = useState(false);
  const loadFromDB = useUserStore((s) => s._loadFromDB);
  useEffect(() => {
    // 用 finally 保证无论 DB 加载成功/失败，dbReady 都会置 true，
    // 避免数据库异常（如升级被旧连接阻塞）导致整页永久卡在 loading
    loadFromDB().finally(() => setDbReady(true));
  }, [loadFromDB]);

  if (!dbReady) return null;

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
            width: 'auto',
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
