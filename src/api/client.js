const API_PREFIX = '/api/v1';

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || controller.signal,
    });
  } catch (requestError) {
    if (requestError.name === 'AbortError') {
      throw new Error('请求超时，请检查后端服务和数据库连接');
    }
    throw new Error('无法连接服务器，请检查后端服务是否已启动');
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('mh-auth-expired'));
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resolveErrorMessage(response.status, body));
  }

  return body.data;
}

/**
 * 下载后端返回的文件流（例如会话导出）。
 * 只把后端给出的文件名用于本地保存，错误处理与 JSON 接口保持一致。
 */
export async function downloadFile(path) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method: 'GET',
      headers: { Accept: '*/*' },
      credentials: 'include',
    });
  } catch {
    throw new Error('无法连接服务器，请检查后端服务是否已启动');
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('mh-auth-expired'));
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(resolveErrorMessage(response.status, body));
  }

  const filename = resolveFilename(response.headers.get('Content-Disposition')) || 'export';
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);

  return filename;
}

/** 解析 Content-Disposition，优先使用 filename* 里的 UTF-8 文件名。 */
function resolveFilename(disposition) {
  if (!disposition) {
    return '';
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch ? plainMatch[1] : '';
}

/** 按 HTTP 状态码给出稳定且不泄露后端细节的前端提示。 */
function resolveErrorMessage(status, body) {
  if (status === 403) {
    return '没有权限执行此操作';
  }

  if (status === 404) {
    return body.message || '资源不存在或已被删除';
  }

  if (status === 429) {
    return body.message || '操作过于频繁，请稍后重试';
  }

  if (status === 500) {
    return body.message || '服务器异常，请稍后重试';
  }

  return body.message || `请求失败（${status}）`;
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