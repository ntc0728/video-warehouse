// 应用入口文件，挂载 React 根组件并初始化路由
import ReactDOM from 'react-dom/client';
import Routes from './routes';
import './assets/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Routes />
);