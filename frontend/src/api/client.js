import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL
});

apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Диагностика: показать, какой код запускает те или иные запросы.
        // В консоли браузера:  window.__apiTrace = true
        if (
            typeof window !== 'undefined' &&
            window.__apiTrace &&
            typeof config.url === 'string' &&
            /(online|settings\/public|conversations|conversation|members|messages|calls|roles|users|departments)\b/.test(
                config.url
            )
        ) {
            try { throw new Error('trace'); } catch (e) {
                const src = (e.stack || e.stackTrace || '')
                    .split('\n')
                    .filter((l) => /\/src\/(hooks|api|components|pages|context|lib)\//.test(l) && !/node_modules/.test(l));
                console.log('▸ API', config.method?.toUpperCase(), config.url, '\n', src.slice(0, 8).join('\n'));
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.config?.url?.includes('/auth/login')) {
            return Promise.reject(error);
        }
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;