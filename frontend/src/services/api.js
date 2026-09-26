import axios from 'axios';

// Direct production backend URL eliminates Vercel's 10s edge proxy timeout
const DIRECT_BACKEND_URL = 'https://veerashaiva-hostel-api.onrender.com/api/v1';
const PROXY_URL = '/api/v1';

// In production, use DIRECT_BACKEND_URL to prevent Vercel 504 timeouts
const defaultBaseURL = import.meta.env.PROD ? DIRECT_BACKEND_URL : (import.meta.env.VITE_API_URL || PROXY_URL);

const api = axios.create({
  baseURL: defaultBaseURL,
  timeout: 35000, // 35s timeout to comfortably accommodate Render cold starts
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

    // Auto-retry once on network/gateway error (failover between direct and proxy)
    const isNetworkOrTimeout = !error.response || [502, 503, 504].includes(error.response.status);
    if (isNetworkOrTimeout && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      // Flip between direct backend and proxy
      if (originalRequest.baseURL === DIRECT_BACKEND_URL) {
        originalRequest.baseURL = PROXY_URL;
      } else {
        originalRequest.baseURL = DIRECT_BACKEND_URL;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
