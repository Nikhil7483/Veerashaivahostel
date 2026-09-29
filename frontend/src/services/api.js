import axios from 'axios';

// On production or custom domains (e.g. veerashaivaboyshostel.in, vercel.app),
// ALWAYS use same-origin '/api/v1'.
// This routes requests through the reverse proxy (vercel.json / caddy / vite proxy),
// which completely prevents CORS preflight drops, 400 Bad Request, and cross-origin blocking,
// even if VITE_API_URL is configured in Vercel project environment variables.
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return '/api/v1';
    }
  }
  return import.meta.env.VITE_API_URL || '/api/v1';
};

const defaultBaseURL = getBaseURL();

const api = axios.create({
  baseURL: defaultBaseURL,
  timeout: 50000, // 50s timeout to comfortably accommodate Render cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Warm up backend immediately in background
export const warmUpBackend = () => {
  try {
    fetch('https://veerashaiva-hostel-api.onrender.com/health', { mode: 'no-cors' }).catch(() => {});
    fetch('/health', { mode: 'no-cors' }).catch(() => {});
  } catch (e) {
    // silently ignore warmup errors
  }
};
warmUpBackend();

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and auto-retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response && error.response.status === 401) {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Auto-retry once on network or 502/503/504 gateway timeout (gives Render time to wake up)
    const isNetworkOrTimeout = !error.response || [502, 503, 504].includes(error.response.status);
    if (isNetworkOrTimeout && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      if (originalRequest.baseURL && originalRequest.baseURL.includes('onrender.com')) {
        originalRequest.baseURL = '/api/v1';
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
