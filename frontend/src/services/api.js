import axios from 'axios';

const PRIMARY_URL = import.meta.env.VITE_API_URL || '/api/v1';
const DIRECT_BACKEND_URL = 'https://veerashaiva-hostel-api.onrender.com/api/v1';

const api = axios.create({
  baseURL: PRIMARY_URL,
  timeout: 30000, // 30s timeout so mobile networks never disconnect prematurely
  headers: {
    'Content-Type': 'application/json',
  },
});

// Warm up backend immediately in the background so it's awake before user clicks login
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

// Response interceptor: handle 401 and automatic retry on network/gateway errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized (session expired or invalid token)
    if (error.response && error.response.status === 401) {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Automatically retry if it was a network drop, 502 Bad Gateway, 503, or 504 Gateway Timeout
    const isNetworkOrTimeout = !error.response || [502, 503, 504].includes(error.response.status);
    
    if (isNetworkOrTimeout && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      
      // If Vercel proxy rewrite timed out, failover directly to Render backend
      if (!originalRequest.baseURL || originalRequest.baseURL === '/api/v1') {
        originalRequest.baseURL = DIRECT_BACKEND_URL;
      }
      
      // Wait 1.5 seconds and retry transparently
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
