import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

const LIVE_BACKEND_ORIGIN = 'https://ics-academy-manhappatta.vercel.app';

if (
  typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port))
) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${LIVE_BACKEND_ORIGIN}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(<App />);

