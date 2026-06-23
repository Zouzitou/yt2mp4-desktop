import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';
import './app.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element — check index.html');
ReactDOM.createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
