import { createRoot } from 'react-dom/client';
import { AppProvider } from './context/app-context';
import App from './App';
import './app.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppProvider>
    <App />
  </AppProvider>
);
