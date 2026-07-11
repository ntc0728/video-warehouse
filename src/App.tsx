import { useEffect, useState } from 'react';
import AppLayout from './components/Layout/AppLayout';
import { HeaderProvider } from './components/Layout/HeaderContext';
import { ToastProvider } from './components/ui/Toast';
import { usePrefetch } from './hooks/usePrefetch';
import { useUserStore } from './stores';

function App() {
  // 启动时预取首页 + IPTV 数据(仅在数据为空时,requestIdleCallback 调度,不阻塞首屏)
  usePrefetch();

  // 初始化用户数据（从 IndexedDB 加载），加载完成前显示 loading
  const [dbReady, setDbReady] = useState(false);
  const loadFromDB = useUserStore((s) => s._loadFromDB);
  useEffect(() => {
    loadFromDB().then(() => setDbReady(true));
  }, [loadFromDB]);

  if (!dbReady) return null;

  return (
    <ToastProvider>
      <HeaderProvider>
        <AppLayout />
      </HeaderProvider>
    </ToastProvider>
  );
}

export default App;
