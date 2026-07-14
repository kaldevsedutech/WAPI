import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Fetch Interceptor to support Vercel hosting with remote Render backend
const getApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_URL as string) || "";
  if (configured) return configured;
  if (window.location.hostname.endsWith(".vercel.app")) {
    return "https://wapi-saas.onrender.com";
  }
  return "";
};

const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = typeof input === "string" ? input : input.toString();
  const isApiRequest = url.startsWith("/api/");
  if (url.startsWith("/api/")) {
    const base = getApiBaseUrl();
    if (base) {
      url = base.replace(/\/$/, "") + url;
    }
  }

  try {
    return await originalFetch(url, init);
  } catch (err) {
    const shouldRetryRender =
      isApiRequest &&
      !url.startsWith("https://wapi-saas.onrender.com") &&
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1");

    if (shouldRetryRender) {
      return originalFetch(`https://wapi-saas.onrender.com${typeof input === "string" ? input : input.toString()}`, init);
    }

    throw err;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
