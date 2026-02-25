import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1`,
  timeout: 30000,
});

// Request interceptor — add JWT token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('pa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pa_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
