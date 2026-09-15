import { get, post, put, remove } from './client';

export const userApi = {
  current: () => get('/users/me'),
  login: (data) => post('/auth/login', data),
  register: (data) => post('/auth/register', data),
  logout: () => post('/auth/logout'),
  updateProfile: (data) => put('/users/me', data),
  updatePassword: (data) => put('/users/me/password', data),
};

export const chatApi = {
  list: () => get('/chat/sessions'),
  create: (data) => post('/chat/sessions', data),
  history: (id) => get(`/chat/sessions/${id}/messages`),
  clearContext: (id) => remove(`/chat/sessions/${id}/context`),
  remove: (id) => remove(`/chat/sessions/${id}`),
  rename: (id, name) => put(`/chat/sessions/${id}/name`, { name }),
  updateSettings: (id, mode) => put(`/chat/sessions/${id}/settings`, { mode }),
  favoriteMessage: (id, favorite) => put(`/chat/messages/${id}/favorite`, { favorite }),
  favorites: () => get('/chat/messages/favorites'),
};

export const assessmentApi = {
  scales: () => get('/assessments/scales'),
  detail: (id) => get(`/assessments/scales/${id}`),
  submit: (data) => post('/assessments', data),
  analyze: (resultId) => post('/assessments/analysis', { resultId }),
  history: () => get('/assessments'),
};

export const articleApi = {
  list: (keyword = '') => get(`/articles${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  detail: (id) => get(`/articles/${id}`),
};

export const diaryApi = {
  list: () => get('/diaries'),
  get: (id) => get(`/diaries/${id}`),
  create: (data) => post('/diaries', data),
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
