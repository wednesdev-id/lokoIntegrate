/// <reference types="vite/client" />
import axios from 'axios';

// Use relative path to automatically use the same host and port as the frontend, or env var for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Log API configuration for debugging
console.log('API Configuration:', {
  baseURL: API_BASE_URL,
  environment: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
});

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 70000, // 70 seconds - buffer untuk backend timeout 60 detik
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor untuk menambahkan auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('API Request:', {
        method: config.method,
        url: config.url,
        hasToken: true,
        tokenPrefix: token.substring(0, 10) + '...',
      });
    } else {
      console.warn('API Request without token:', {
        method: config.method,
        url: config.url,
      });
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor untuk handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear all auth data and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');

      // Avoid infinite loop if already on login page
      if (window.location.pathname !== '/login') {
        console.error('Authentication failed. Redirecting to login...');
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      console.error('Access forbidden. You don\'t have permission to access this resource.');
    } else if (error.response?.status === 500) {
      console.error('Server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

export default api;