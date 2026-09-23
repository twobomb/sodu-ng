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

// Синхронная трассировка источника запроса (в отличие от интерцептора,
// здесь стек сохраняет реального вызывающего — useQuery/хук).
// Включить:  window.__apiTrace = true
const TRACE_RE = /(online|settings\/public|conversations\/?\b|conversation\/?|members|messages\/?|calls|roles|users|departments)/;
const traceStack = () => {
    try { throw new Error('t'); } catch (e) {
        return (e.stack || e.stackTrace || '')
            .split('\n')
            .filter((l) => /[\\/]src[\\/](hooks|components|pages|context|lib)[\\/]/.test(l) && !/node_modules/.test(l));
    }
};
const wrapTrace = (method) => (...args) => {
    const url = args[0];
    if (
        typeof window !== 'undefined' &&
        window.__apiTrace &&
        typeof url === 'string' &&
        TRACE_RE.test(url)
    ) {
        console.log('▸▲', method === apiClient.post ? 'POST' : 'GET', url, '\n' + traceStack().slice(1, 9).join('\n'));
    }
    return method(...args);
};
apiClient.get = wrapTrace(apiClient.get.bind(apiClient));
apiClient.post = wrapTrace(apiClient.post.bind(apiClient));
apiClient.put = wrapTrace(apiClient.put.bind(apiClient));
apiClient.patch = wrapTrace(apiClient.patch.bind(apiClient));
apiClient.delete = wrapTrace(apiClient.delete.bind(apiClient));

// Дедупликация GET: один и тот же запрос (метод+URL), выполняющийся в течение
// GET_DEDUP_MS, не уходит на сервер повторно — повторные вызовы получают тот же
// Promise. Это стабилизатор на уровне HTTP: разрывает «пачки» одинаковых GET
// (перемонтирование / async-дубли / повторные refetch), когда одно событие
// инициирует несколько идентичных запросов. POST/PUT/... не трогаем (мутации).
// Окно 2000 мс: волны одинаковых запросов после чат-события идут с шагом ~1 с
// (по сокет-событию), поэтому 1000 мс их не схлопывало, а 2000 — сворачивает в
// один реальный запрос на burst.
const GET_DEDUP_MS = 2000;
const getDedup = new Map();
const _origGet = apiClient.get.bind(apiClient);
apiClient.get = (url, config) => {
    // Чатовые эндпоинты (messages/conversation/conversations/members) НЕ дедуплицируем:
    // они меняются на каждое сообщение, и отдача старого Promise (с данными без
    // только что отправленного сообщения) приводила к «потере» быстрых сообщений.
    // Для них свежесть управляется дебаунсом инвалидаций (250 мс + throttle 2 с).
    //
    // ДИАГНОСТИКА цикла refetch у получателя:
    //   window.__apiTrace = true   (в консоли получателя)
    // затем 1 сообщение и пришли первый блок "▸SRC <url>" подряд идущих одинаковых
    // запросов — по стеку (src/hooks, src/components) станет видно, кто циклит.
    if (typeof window !== 'undefined' && window.__apiTrace && typeof url === 'string' && url.includes('/chat/')) {
        let st;
        try { throw new Error('x'); } catch (e) { st = e.stack || e.stackTrace || String(e); }
        console.log('▸SRC', url, '\nUSER-STACK\n' + (st || '(нет стека)') + '\n---');
    }
    if (typeof url === 'string' && url.includes('/chat/')) {
        return _origGet(url, config);
    }
    // Ключ = полный URL с параметрами (путь + page/filters/...). Без этого axios
    // присылает в url только "/calls", а параметры лежат в config.params, и все
    // страницы/фильтры получали ОДИН ключ "GET /calls": быстрый клик по пагинации
    // возвращал Promise предыдущей страницы, пока не истекал GET_DEDUP_MS.
    const fullUrl = apiClient.getUri({ url, params: config?.params });
    const k = 'GET ' + fullUrl;
    const now = Date.now();
    const prev = getDedup.get(k);
    if (prev && now - prev.at < GET_DEDUP_MS) {
        return prev.promise;
    }
    const p = _origGet(url, config);
    if (getDedup.size > 200) getDedup.clear();
    getDedup.set(k, { at: now, promise: p });
    return p;
};

export default apiClient;