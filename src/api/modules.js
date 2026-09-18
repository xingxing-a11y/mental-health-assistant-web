import { get, post, put, remove, request, downloadFile } from './client';

/** 把可选参数拼成查询串，空值不参与拼接。 */
export function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, value);
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export const userApi = {
  current: () => get('/users/me'),
  login: (data) => post('/auth/login', data),
  register: (data) => post('/auth/register', data),
  logout: () => post('/auth/logout'),
  updateProfile: (data) => put('/users/me', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/users/me/avatar', { method: 'POST', body: formData });
  },
  updatePassword: (data) => put('/users/me/password', data),
};

export const chatApi = {
  list: () => get('/chat/sessions'),
  archived: () => get('/chat/sessions/archived'),
  create: (data) => post('/chat/sessions', data),
  history: (id) => get(`/chat/sessions/${id}/messages`),
  clearContext: (id) => remove(`/chat/sessions/${id}/context`),
  remove: (id) => remove(`/chat/sessions/${id}`),
  rename: (id, name) => put(`/chat/sessions/${id}/name`, { name }),
  togglePin: (id) => put(`/chat/sessions/${id}/pin`),
  archive: (id) => put(`/chat/sessions/${id}/archive`),
  unarchive: (id) => put(`/chat/sessions/${id}/unarchive`),
  updateSettings: (id, mode) => put(`/chat/sessions/${id}/settings`, { mode }),
  favoriteMessage: (id, favorite) => put(`/chat/messages/${id}/favorite`, { favorite }),
  favorites: (params = {}) => get(`/chat/messages/favorites${buildQuery(params)}`),
  removeFavorite: (messageId) => remove(`/chat/messages/favorites/${messageId}`),
  sensitiveCheck: (content) => post('/chat/sensitive-check', { content }),
  exportSession: (sessionId, format) => downloadFile(
    `/chat/sessions/${sessionId}/export${buildQuery({ format })}`,
  ),
};

export const assessmentApi = {
  scales: () => get('/assessments/scales'),
  detail: (id) => get(`/assessments/scales/${id}`),
  submit: (data) => post('/assessments', data),
  analyze: (resultId) => post('/assessments/analysis', { resultId }),
  history: () => get('/assessments'),
  favorites: () => get('/assessments/favorites'),
  updateFavorite: (scaleId, favorite) => put(`/assessments/scales/${scaleId}/favorite`, { favorite }),
  scaleHistory: (scaleId) => get(`/assessments/scales/${scaleId}/history`),
  recommendations: () => get('/assessments/recommendations'),
};

export const articleApi = {
  list: (keyword = '') => get(`/articles${buildQuery({ keyword })}`),
  detail: (id) => get(`/articles/${id}`),
};

export const diaryApi = {
  create: (data) => post('/diaries', data),
  list: () => get('/diaries/recent'),
  all: (page = 0, size = 10, startDate = '', endDate = '') => {
    const params = new URLSearchParams({ page, size });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return get(`/diaries?${params.toString()}`);
  },
  get: (id) => get(`/diaries/${id}`),
  update: (id, data) => put(`/diaries/${id}`, data),
  remove: (id) => remove(`/diaries/${id}`),
  analyze: (id) => post(`/diaries/${id}/analysis`),
  trend: (startDate = '', endDate = '') => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return get(`/emotions/trend${query ? `?${query}` : ''}`);
  },
};

export const relaxApi = {
  overview: () => get('/relax/overview'),
  meditations: () => get('/relax/meditations'),
  records: (page = 0, size = 20, type = '') => get(`/relax/records${buildQuery({ page, size, type })}`),
  createRecord: (data) => post('/relax/records', data),
  stressLogs: (page = 0, size = 20) => get(`/relax/stress-logs${buildQuery({ page, size })}`),
  createStressLog: (data) => post('/relax/stress-logs', data),
  stressTrend: (days = 30) => get(`/relax/stress-trend${buildQuery({ days })}`),
};

export const notificationApi = {
  list: (page = 0, size = 20) => get(`/notifications${buildQuery({ page, size })}`),
  unreadCount: () => get('/notifications/unread-count'),
  markRead: (id) => put(`/notifications/${id}/read`),
  markAllRead: () => put('/notifications/read-all'),
};

export const settingsApi = {
  get: () => get('/users/me/settings'),
  update: (data) => put('/users/me/settings', data),
  deactivate: () => post('/users/me/deactivate'),
};

export const systemApi = {
  policy: () => get('/system/policy'),
};

export const feedbackApi = {
  submit: (data) => post('/feedbacks', data),
};

export const adminApi = {
  users: (page = 0, size = 20, nickname = '') => {
    const params = new URLSearchParams({ page, size });
    if (nickname.trim()) {
      params.set('nickname', nickname.trim());
    }
    return get(`/admin/users?${params.toString()}`);
  },
  updateUserStatus: (id, status) => put(`/admin/users/${id}/status`, { status }),
  documents: () => get('/admin/knowledge-documents'),
  createDocument: (data) => post('/admin/knowledge-documents', data),
  updateDocument: (id, data) => put(`/admin/knowledge-documents/${id}`, data),
  deleteDocument: (id) => remove(`/admin/knowledge-documents/${id}`),
  vectorize: (id) => post(`/admin/knowledge-documents/${id}/vectorize`),
  reVectorize: (id) => post(`/admin/knowledge-documents/${id}/re-vectorize`),
  scales: () => get('/admin/scales'),
  createScale: (data) => post('/admin/scales', data),
  updateScale: (id, data) => put(`/admin/scales/${id}`, data),
  publishScale: (id) => put(`/admin/scales/${id}/publish`),
  deleteScale: (id) => remove(`/admin/scales/${id}`),
  updateQuestions: (id, data) => put(`/admin/scales/${id}/questions`, data),
  articles: () => get('/admin/articles'),
  createArticle: (data) => post('/admin/articles', data),
  updateArticle: (id, data) => put(`/admin/articles/${id}`, data),
  deleteArticle: (id) => remove(`/admin/articles/${id}`),
  highRiskAudits: () => get('/admin/audits/high-risk'),
  statistics: () => get('/admin/statistics/overview'),
  announcements: () => get('/admin/announcements'),
  createAnnouncement: (data) => post('/admin/announcements', data),
  updateAnnouncement: (id, data) => put(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id) => remove(`/admin/announcements/${id}`),
  notifications: (page = 0, size = 20) => get(`/admin/notifications${buildQuery({ page, size })}`),
  pushNotification: (data) => post('/admin/notifications', data),
  revokeNotification: (id) => remove(`/admin/notifications/${id}`),
  sensitiveWords: () => get('/admin/sensitive-words'),
  createSensitiveWord: (data) => post('/admin/sensitive-words', data),
  updateSensitiveWord: (id, data) => put(`/admin/sensitive-words/${id}`, data),
  deleteSensitiveWord: (id) => remove(`/admin/sensitive-words/${id}`),
  feedbacks: (page = 0, size = 20, status = '') => get(`/admin/feedbacks${buildQuery({ page, size, status })}`),
  handleFeedback: (id, data) => put(`/admin/feedbacks/${id}`, data),
  operationLogs: (params = {}) => get(`/admin/operation-logs${buildQuery(params)}`),
  knowledgeSettings: () => get('/admin/knowledge-settings'),
  updateKnowledgeSettings: (data) => put('/admin/knowledge-settings', data),
};

export const announcementApi = {
  list: () => get('/announcements'),
};

export async function streamChat(sessionId, content, onEvent) {
  const response = await fetch(`/api/v1/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`流式请求失败（${response.status}）`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    events.forEach((rawEvent) => {
      const lines = rawEvent.split('\n');
      const name = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');

      onEvent(name, data);
    });
  }
}