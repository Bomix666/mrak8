import { API_BASE_URL, STATIC_MODE } from '../config.js';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function csrfToken() {
  return document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1];
}

export async function apiFetch(path, { method = 'GET', body, params } = {}) {
  if (STATIC_MODE) return staticFetch(path, { method, params });

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (query) url += `?${query}`;
  }

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  // A signed-in session (e.g. staff previewing a draft) makes DRF enforce
  // CSRF on writes; send the token whenever the cookie exists.
  if (method !== 'GET' && csrfToken()) headers['X-CSRFToken'] = csrfToken();

  let response;
  try {
    response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (networkError) {
    throw new ApiError('Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.', 0, null);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(data?.detail || 'Запрос не выполнен.', response.status, data);
  }
  return data;
}

// Static export: every GET the storefront makes exists as a JSON file
// written by `manage.py build_pages`. The only parameter that changes the
// answer there is ?product= on the journal; the rest is filtered in the
// browser already.
async function staticFetch(path, { method, params }) {
  if (method !== 'GET') throw new ApiError('Это витрина: оформление заказа здесь недоступно.', 503, null);
  const file = params?.product ? `${path}product-${params.product}/` : path;
  const response = await fetch(`${API_BASE_URL}${file}index.json`).catch(() => null);
  if (!response) throw new ApiError('Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.', 0, null);
  if (!response.ok) throw new ApiError('Не найдено.', 404, null);
  return response.json();
}
