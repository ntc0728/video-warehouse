import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import AppLayout from './components/Layout/AppLayout';
import { HeaderProvider } from './components/Layout/HeaderContext';
import { usePrefetch } from './hooks/usePrefetch';
import { useUserStore } from './stores';

function App() {
  // 启动时预取首页 + IPTV 数据(仅在数据为空时,requestIdleCallback 调度,不阻塞首屏)
  usePrefetch();

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
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border-light)',
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
