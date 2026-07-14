import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Fetch Interceptor to support Vercel hosting with remote Render backend
const getApiBaseUrl = () => {
  return (import.meta.env.VITE_API_URL as string) || "";
};

const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = typeof input === "string" ? input : input.toString();
  if (url.startsWith("/api/")) {
    const base = getApiBaseUrl();
    if (base) {
      url = base.replace(/\/$/, "") + url;
    }
  }
  return originalFetch(url, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
