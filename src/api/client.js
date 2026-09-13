const API_PREFIX = '/api/v1';

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('mh-auth-expired'));
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = response.status === 403
      ? '没有权限执行此操作'
      : body.message || `请求失败（${response.status}）`;
    throw new Error(message);
  }

  return body.data;
}

export function get(path) {
  return request(path);
}

export function post(path, data) {
  return request(path, {
    method: 'POST',
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function put(path, data) {
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function remove(path) {
  return request(path, {
    method: 'DELETE',
  });
}
