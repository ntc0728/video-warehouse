import AppLayout from './components/Layout/AppLayout';
import { HeaderProvider } from './components/Layout/HeaderContext';
import { usePrefetch } from './hooks/usePrefetch';

function App() {
  // 启动时预取首页 + IPTV 数据(仅在数据为空时,requestIdleCallback 调度,不阻塞首屏)
  usePrefetch();
  return (
    <HeaderProvider>
      <AppLayout />
    </HeaderProvider>
  );
}

export default App;
