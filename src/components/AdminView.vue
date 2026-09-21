<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { formatDateTime } from '../utils/dateTime';
import { adminApi, assessmentApi } from '../api/modules';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps({
  section: { type: String, default: 'overview' },
});

const users = ref([]);
const userPage = ref({ page: 0, size: 20, total: 0, totalPages: 0 });
const userKeyword = ref('');
const documents = ref([]);
const scales = ref([]);
const articles = ref([]);
const error = ref('');
const documentForm = ref({ title: '', content: '' });
const editingId = ref(null);
const scaleForm = ref({ name: '', description: '', applicableScene: '' });
const editingScaleId = ref(null);
const questionScaleId = ref(null);
const questionForm = ref([]);
const viewingScale = ref(null);
const viewQuestions = ref([]);
const viewLoading = ref(false);
const saving = ref(false);
const audits = ref([]);
const statistics = ref(null);
const overviewChart = ref(null);
let overviewChartInstance;
const announcements = ref([]);
const announcementForm = ref({ title: '', content: '' });
const editingAnnouncementId = ref(null);
const articleForm = ref({ title: '', summary: '', content: '' });
const editingArticleId = ref(null);
const expandedEditorTarget = ref(null);
const pendingConfirm = ref(null);
const confirmBusy = ref(false);
let errorTimer = null;

const notifications = ref([]);
const notificationPage = ref({ page: 0, size: 20, total: 0, totalPages: 0 });
const notificationForm = ref({ scope: 'ALL', userId: '', title: '', content: '', permanent: false });
const sensitiveWords = ref([]);
const sensitiveWordForm = ref({ word: '', level: 'CARE', enabled: true });
const editingSensitiveWordId = ref(null);
const feedbacks = ref([]);
const feedbackPage = ref({ page: 0, size: 20, total: 0, totalPages: 0 });
const feedbackStatusFilter = ref('');
const operationLogs = ref([]);
const operationLogPage = ref({ page: 0, size: 20, total: 0, totalPages: 0 });
const operationLogTypeFilter = ref('');
const operationLogForm = ref({ startDate: '', endDate: '' });
const knowledgeSettings = ref({ chunkSize: 1000, chunkOverlap: 100 });
const knowledgeSettingsSaving = ref(false);

const expandedEditorTitle = computed(() => {
  if (expandedEditorTarget.value === 'scaleDescription') {
    return '编辑量表简介';
  }
  if (expandedEditorTarget.value === 'articleContent') {
    return '编辑文章正文';
  }
  return '';
});

const expandedEditorContent = computed({
  get() {
    if (expandedEditorTarget.value === 'scaleDescription') {
      return scaleForm.value.description;
    }
    if (expandedEditorTarget.value === 'articleContent') {
      return articleForm.value.content;
    }
    return '';
  },
  set(value) {
    if (expandedEditorTarget.value === 'scaleDescription') {
      scaleForm.value.description = value;
    }
    if (expandedEditorTarget.value === 'articleContent') {
      articleForm.value.content = value;
    }
  },
});

async function load() {
  try {
    const [
      userResult,
      documentResult,
      scaleResult,
      articleResult,
      auditResult,
      statsResult,
      announcementResult,
    ] = await Promise.all([
      adminApi.users(userPage.value.page, userPage.value.size, userKeyword.value),
      adminApi.documents(),
      adminApi.scales(),
      adminApi.articles(),
      adminApi.highRiskAudits(),
      adminApi.statistics(),
      adminApi.announcements(),
    ]);
    users.value = userResult.items || [];
    userPage.value = userResult;
    documents.value = documentResult;
    scales.value = scaleResult;
    articles.value = articleResult || [];
    audits.value = auditResult || [];
    statistics.value = statsResult || null;
    announcements.value = announcementResult || [];
  } catch (requestError) {
    setError(requestError.message);
  }
}

async function applyUserStatus(user, status) {
  user.status = (await adminApi.updateUserStatus(user.id, status)).status;
}

/** 用户状态展示文案，已注销账号仍保留业务数据可查。 */
function statusLabel(status) {
  if (status === 'CLOSED') {
    return '已注销';
  }
  if (status === 'DISABLED') {
    return '已禁用';
  }
  return '正常';
}

async function toggleUser(user) {
  if (user.status !== 'ACTIVE') {
    try {
      await applyUserStatus(user, 'ACTIVE');
    } catch (requestError) {
      setError(requestError.message || '用户状态更新失败');
    }
    return;
  }

  askConfirm({
    title: '禁用账号',
    message: `确定禁用账号「${user.username}」吗？禁用后该用户无法再登录，需要重新启用后才能继续使用。`,
    confirmText: '禁用账号',
    errorMessage: '用户状态更新失败',
    action: () => applyUserStatus(user, 'DISABLED'),
  });
}

async function changeUserPage(page) {
  userPage.value.page = page;
  await load();
}

async function searchUsers() {
  userPage.value.page = 0;
  await load();
}

async function clearUserSearch() {
  if (!userKeyword.value) {
    return;
  }
  userKeyword.value = '';
  await searchUsers();
}

async function vectorize(document) {
  const action = document.vectorStatus === 'VECTORIZED'
    ? adminApi.reVectorize
    : adminApi.vectorize;
  const updated = await action(document.id);
  document.vectorStatus = updated.vectorStatus;
}

async function saveDocument() {
  if (!documentForm.value.title.trim() || !documentForm.value.content.trim()) {
    setError('文档标题和正文不能为空');
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const saved = editingId.value
      ? await adminApi.updateDocument(editingId.value, documentForm.value)
      : await adminApi.createDocument(documentForm.value);
    if (editingId.value) {
      const index = documents.value.findIndex((item) => item.id === editingId.value);
      if (index >= 0) {
        documents.value[index] = saved;
      }
    } else {
      documents.value.unshift(saved);
    }
    documentForm.value = { title: '', content: '' };
    editingId.value = null;
  } catch (requestError) {
    setError(requestError.message || '知识库文档保存失败');
    if (requestError.message === '知识库文档不存在') {
      editingId.value = null;
    }
  } finally {
    saving.value = false;
  }
}

function editDocument(document) {
  editingId.value = document.id;
  documentForm.value = { title: document.title, content: document.content || '' };
}

function cancelDocumentEdit() {
  editingId.value = null;
  documentForm.value = { title: '', content: '' };
}

async function removeDocument(document) {
  await adminApi.deleteDocument(document.id);
  documents.value = documents.value.filter((item) => item.id !== document.id);
}

function deleteDocument(document) {
  askConfirm({
    title: '删除知识库文档',
    message: `确定删除《${document.title}》吗？文档记录与已生成的向量片段会一并删除，且无法恢复。`,
    confirmText: '删除文档',
    errorMessage: '知识库文档删除失败',
    action: () => removeDocument(document),
  });
}

async function saveScale() {
  if (!scaleForm.value.name.trim()) {
    setError('量表名称不能为空');
    return;
  }
  const saved = editingScaleId.value
    ? await adminApi.updateScale(editingScaleId.value, scaleForm.value)
    : await adminApi.createScale(scaleForm.value);
  if (editingScaleId.value) {
    const index = scales.value.findIndex((item) => item.id === editingScaleId.value);
    scales.value[index] = saved;
  } else {
    scales.value.unshift(saved);
  }
  scaleForm.value = { name: '', description: '', applicableScene: '' };
  editingScaleId.value = null;
}

/** 发布后前端会锁定量表信息和题目维护，属于不可逆操作，先弹窗确认再执行。 */
function requestPublish(scale) {
  askConfirm({
    title: '发布量表',
    message: `确定发布量表「${scale.name}」吗？发布后用户即可看到并作答，量表信息和题目将不能再修改。`,
    confirmText: '发布量表',
    errorMessage: '发布失败，请先添加题目',
    action: () => publishScale(scale),
  });
}

async function publishScale(scale) {
  const published = await adminApi.publishScale(scale.id);
  const index = scales.value.findIndex((item) => item.id === scale.id);
  if (index !== -1) {
    scales.value[index] = published;
  }
}

function editScale(scale) {
  editingScaleId.value = scale.id;
  scaleForm.value = {
    name: scale.name,
    description: scale.description || '',
    applicableScene: scale.applicableScene || '',
  };
}

function cancelScaleEdit() {
  editingScaleId.value = null;
  scaleForm.value = { name: '', description: '', applicableScene: '' };
}

async function removeScale(scale) {
  await adminApi.deleteScale(scale.id);
  scales.value = scales.value.filter((item) => item.id !== scale.id);
}

function deleteScale(scale) {
  askConfirm({
    title: '删除量表',
    message: `确定删除量表「${scale.name}」吗？该量表的题目和选项会一并删除，且无法恢复；若该量表已有测评记录，后端会拒绝删除。`,
    confirmText: '删除量表',
    errorMessage: '量表删除失败',
    action: () => removeScale(scale),
  });
}

const QUESTION_TYPE_LABELS = {
  SINGLE: '单选题',
  MULTIPLE: '多选题',
  JUDGE: '判断题',
  TEXT: '文字题',
  MATRIX: '矩阵题',
};

function questionTypeLabel(type) {
  return QUESTION_TYPE_LABELS[type] || '题目';
}

/** 只读查看问卷内容，不提供任何修改入口。 */
async function viewScale(scale) {
  viewLoading.value = true;
  viewingScale.value = scale;
  viewQuestions.value = [];
  try {
    const detail = await assessmentApi.detail(scale.id);
    viewQuestions.value = detail.questions || [];
  } catch (requestError) {
    setError(requestError.message || '问卷内容加载失败');
    viewingScale.value = null;
  } finally {
    viewLoading.value = false;
  }
}

function closeScaleView() {
  viewingScale.value = null;
  viewQuestions.value = [];
}

async function removeArticle(article) {
  await adminApi.deleteArticle(article.id);
  articles.value = articles.value.filter((item) => item.id !== article.id);
}

function deleteArticle(article) {
  askConfirm({
    title: '删除科普文章',
    message: `确定删除《${article.title}》吗？删除后用户将无法再看到这篇文章，且无法恢复。`,
    confirmText: '删除文章',
    errorMessage: '科普文章删除失败',
    action: () => removeArticle(article),
  });
}

function editArticle(article) {
  editingArticleId.value = article.id;
  articleForm.value = {
    title: article.title,
    summary: article.summary || '',
    content: article.content || '',
  };
}

function cancelArticleEdit() {
  editingArticleId.value = null;
  articleForm.value = { title: '', summary: '', content: '' };
}

function openExpandedEditor(target) {
  expandedEditorTarget.value = target;
}

function closeExpandedEditor() {
  expandedEditorTarget.value = null;
}

function setError(message) {
  error.value = message;
  // 清除之前的定时器
  if (errorTimer) {
    clearTimeout(errorTimer);
  }
  // 设置新的定时器，3秒后自动清除
  errorTimer = setTimeout(() => {
    error.value = '';
    errorTimer = null;
  }, 3000);
}

async function loadNotifications(page = 0) {
  try {
    const result = await adminApi.notifications(page, notificationPage.value.size);
    notifications.value = result.items || [];
    notificationPage.value = result;
  } catch (requestError) {
    setError(requestError.message);
  }
}

async function pushNotification() {
  const form = notificationForm.value;
  if (!form.title.trim() || !form.content.trim()) {
    setError('请填写推送标题与内容');
    return;
  }
  if (form.scope === 'USER' && !form.userId) {
    setError('定向推送需要填写目标用户 ID');
    return;
  }

  try {
    await adminApi.pushNotification({
      scope: form.scope,
      userId: form.scope === 'USER' ? Number(form.userId) : null,
      title: form.title.trim(),
      content: form.content.trim(),
      permanent: form.permanent,
    });
    notificationForm.value = { scope: 'ALL', userId: '', title: '', content: '', permanent: false };
    await loadNotifications(0);
  } catch (requestError) {
    setError(requestError.message);
  }
}

function changeNotificationPage(page) {
  if (page < 0 || page >= notificationPage.value.totalPages) {
    return;
  }
  loadNotifications(page);
}

function revokeNotification(notification) {
  askConfirm({
    title: '撤回推送',
    message: `撤回「${notification.title}」后，用户将不再看到该通知，已读记录会一并删除。`,
    confirmText: '撤回推送',
    errorMessage: '撤回推送失败',
    action: async () => {
      await adminApi.revokeNotification(notification.id);
      await loadNotifications(notificationPage.value.page);
    },
  });
}

async function loadSensitiveWords() {
  try {
    sensitiveWords.value = await adminApi.sensitiveWords() || [];
  } catch (requestError) {
    setError(requestError.message);
  }
}

async function saveSensitiveWord() {
  const form = sensitiveWordForm.value;
  if (!form.word.trim()) {
    setError('请填写敏感词');
    return;
  }

  const payload = { word: form.word.trim(), level: form.level, enabled: form.enabled };
  try {
    if (editingSensitiveWordId.value) {
      await adminApi.updateSensitiveWord(editingSensitiveWordId.value, payload);
    } else {
      await adminApi.createSensitiveWord(payload);
    }
    cancelSensitiveWordEdit();
    await loadSensitiveWords();
  } catch (requestError) {
    setError(requestError.message);
  }
}

function editSensitiveWord(item) {
  editingSensitiveWordId.value = item.id;
  sensitiveWordForm.value = { word: item.word, level: item.level, enabled: item.enabled };
}

function cancelSensitiveWordEdit() {
  editingSensitiveWordId.value = null;
  sensitiveWordForm.value = { word: '', level: 'CARE', enabled: true };
}

function deleteSensitiveWord(item) {
  askConfirm({
    title: '删除词条',
    message: `删除「${item.word}」后，该词条不再参与敏感内容判定。`,
    confirmText: '删除词条',
    errorMessage: '删除词条失败',
    action: async () => {
      await adminApi.deleteSensitiveWord(item.id);
      await loadSensitiveWords();
    },
  });
}

async function loadFeedbacks(page = 0) {
  try {
    const result = await adminApi.feedbacks(page, feedbackPage.value.size, feedbackStatusFilter.value);
    feedbacks.value = (result.items || []).map((item) => ({
      ...item,
      remarkDraft: item.remark || '',
    }));
    feedbackPage.value = result;
  } catch (requestError) {
    setError(requestError.message);
  }
}

function searchFeedbacks() {
  loadFeedbacks(0);
}

function changeFeedbackPage(page) {
  if (page < 0 || page >= feedbackPage.value.totalPages) {
    return;
  }
  loadFeedbacks(page);
}

async function handleFeedback(ticket, status) {
  try {
    const updated = await adminApi.handleFeedback(ticket.id, {
      status,
      remark: ticket.remarkDraft?.trim() || null,
    });
    const index = feedbacks.value.findIndex((item) => item.id === updated.id);
    if (index >= 0) {
      feedbacks.value[index] = { ...updated, remarkDraft: updated.remark || '' };
    }
  } catch (requestError) {
    setError(requestError.message);
  }
}

async function loadOperationLogs(page = 0) {
  try {
    const result = await adminApi.operationLogs({
      page,
      size: operationLogPage.value.size,
      type: operationLogTypeFilter.value,
      startDate: operationLogForm.value.startDate,
      endDate: operationLogForm.value.endDate,
    });
    operationLogs.value = result.items || [];
    operationLogPage.value = result;
  } catch (requestError) {
    setError(requestError.message);
  }
}

function searchOperationLogs() {
  loadOperationLogs(0);
}

function changeOperationLogPage(page) {
  if (page < 0 || page >= operationLogPage.value.totalPages) {
    return;
  }
  loadOperationLogs(page);
}

async function loadKnowledgeSettings() {
  try {
    knowledgeSettings.value = await adminApi.knowledgeSettings();
  } catch (requestError) {
    setError(requestError.message);
  }
}

async function saveKnowledgeSettings() {
  knowledgeSettingsSaving.value = true;
  try {
    knowledgeSettings.value = await adminApi.updateKnowledgeSettings({
      chunkSize: Number(knowledgeSettings.value.chunkSize),
      chunkOverlap: Number(knowledgeSettings.value.chunkOverlap),
    });
  } catch (requestError) {
    setError(requestError.message);
  } finally {
    knowledgeSettingsSaving.value = false;
  }
}

/** 新增子节的数据按需加载，避免每次进入后台都全量拉取。 */
async function loadSectionData(section) {
  if (section === 'push') {
    await loadNotifications(0);
  }
  if (section === 'sensitive') {
    await loadSensitiveWords();
  }
  if (section === 'feedbacks') {
    await loadFeedbacks(0);
  }
  if (section === 'logs') {
    await loadOperationLogs(0);
  }
  if (section === 'knowledge') {
    await loadKnowledgeSettings();
  }
}

/** 打开二次确认弹窗，用户确认后再执行具体操作。 */
function askConfirm(options) {
  pendingConfirm.value = {
    title: options.title,
    message: options.message,
    confirmText: options.confirmText || '确认',
    errorMessage: options.errorMessage || '操作失败，请稍后重试',
    action: options.action,
  };
}

function cancelConfirm() {
  if (confirmBusy.value) {
    return;
  }
  pendingConfirm.value = null;
}

async function runConfirmedAction() {
  if (!pendingConfirm.value || confirmBusy.value) {
    return;
  }

  const { action, errorMessage } = pendingConfirm.value;
  confirmBusy.value = true;
  try {
    await action();
  } catch (requestError) {
    setError(requestError.message || errorMessage);
  } finally {
    confirmBusy.value = false;
    pendingConfirm.value = null;
  }
}

async function saveArticle() {
  if (!articleForm.value.title.trim() || !articleForm.value.content.trim()) return;
  const saved = editingArticleId.value
    ? await adminApi.updateArticle(editingArticleId.value, articleForm.value)
    : await adminApi.createArticle(articleForm.value);
  if (editingArticleId.value) {
    const index = articles.value.findIndex((item) => item.id === editingArticleId.value);
    articles.value[index] = saved;
  } else {
    articles.value.unshift(saved);
  }
  articleForm.value = { title: '', summary: '', content: '' };
  editingArticleId.value = null;
}

async function saveAnnouncement() {
  if (!announcementForm.value.title.trim() || !announcementForm.value.content.trim()) return;
  const saved = editingAnnouncementId.value
    ? await adminApi.updateAnnouncement(editingAnnouncementId.value, announcementForm.value)
    : await adminApi.createAnnouncement(announcementForm.value);
  if (editingAnnouncementId.value) {
    const index = announcements.value.findIndex((item) => item.id === editingAnnouncementId.value);
    announcements.value[index] = saved;
  } else {
    announcements.value.unshift(saved);
  }
  announcementForm.value = { title: '', content: '' };
  editingAnnouncementId.value = null;
}

function editAnnouncement(announcement) {
  editingAnnouncementId.value = announcement.id;
  announcementForm.value = {
    title: announcement.title,
    content: announcement.content,
  };
}

function cancelAnnouncementEdit() {
  editingAnnouncementId.value = null;
  announcementForm.value = { title: '', content: '' };
}

async function removeAnnouncement(announcement) {
  await adminApi.deleteAnnouncement(announcement.id);
  announcements.value = announcements.value.filter((item) => item.id !== announcement.id);
}

function deleteAnnouncement(announcement) {
  askConfirm({
    title: '删除系统公告',
    message: `确定删除公告「${announcement.title}」吗？删除后用户首页不再展示该公告，且无法恢复。`,
    confirmText: '删除公告',
    errorMessage: '系统公告删除失败',
    action: () => removeAnnouncement(announcement),
  });
}

async function editQuestions(scale) {
  const detail = await assessmentApi.detail(scale.id);
  questionScaleId.value = scale.id;
  questionForm.value = (detail.questions || []).map((question, index) => ({
      order: question.questionOrder,
      content: question.content,
      type: question.type || 'SINGLE',
      options: (question.options || []).map((option) => ({
        label: option.label,
        score: option.score,
      })),
      matrixRows: question.matrixRows || '',
      matrixColumns: question.matrixColumns || '',
    }));
}

function addQuestion() {
  questionForm.value.push({
    order: questionForm.value.length + 1,
    content: '',
    type: 'SINGLE',
    options: [
      { label: '', score: 0 },
      { label: '', score: 0 },
    ],
    matrixRows: '',
    matrixColumns: '',
  });
}

function removeQuestion(index) {
  questionForm.value.splice(index, 1);
  questionForm.value.forEach((question, questionIndex) => {
    question.order = questionIndex + 1;
  });
}

function changeQuestionType(question) {
  if (question.type === 'TEXT') {
    question.options = [];
    // 清空矩阵相关字段
    question.matrixRows = '';
    question.matrixColumns = '';
    return;
  }

  if (question.type === 'MATRIX') {
    // 确保矩阵行和列有默认值
    if (!question.matrixRows || !question.matrixRows.trim()) {
      question.matrixRows = '项目一\n项目二';
    }
    if (!question.matrixColumns || !question.matrixColumns.trim()) {
      question.matrixColumns = '从不\n偶尔\n经常';
    }
    // 从矩阵列创建选项
    updateMatrixOptions(question);
    return;
  }

  if (question.type === 'JUDGE') {
    // 清空矩阵相关字段
    question.matrixRows = '';
    question.matrixColumns = '';
    question.options = [
      { label: '正确', score: 1 },
      { label: '错误', score: 0 },
    ];
    return;
  }

  // 对于 SINGLE 和 MULTIPLE 类型
  // 清空矩阵相关字段
  question.matrixRows = '';
  question.matrixColumns = '';

  // 如果没有选项或选项都来自矩阵类型，则重置为默认选项
  if (!question.options.length || question.options.some(opt => ['从不', '偶尔', '经常'].includes(opt.label))) {
    question.options = [
      { label: '', score: 0 },
      { label: '', score: 0 },
    ];
  }
}

function updateMatrixOptions(question) {
  if (question.type !== 'MATRIX') return;
  // 从矩阵列创建选项，保留用户之前设置的分值
  const columns = question.matrixColumns.split('\n').filter(Boolean);
  question.options = columns.map((label, index) => {
    const existingOption = question.options[index];
    return {
      label: label.trim(),
      score: existingOption ? (Number(existingOption.score) || index) : index,
    };
  });
}

function addOption(question) {
  if (question.type === 'JUDGE') {
    return;
  }
  question.options.push({ label: '', score: 0 });
}

function removeOption(question, optionIndex) {
  if (question.type === 'JUDGE' || question.options.length <= 1) {
    return;
  }
  question.options.splice(optionIndex, 1);
}

function cancelQuestions() {
  questionScaleId.value = null;
  questionForm.value = [];
}

async function saveQuestions() {
  if (questionForm.value.some((question) => !question.content.trim())) {
    setError('题目内容不能为空');
    return;
  }
  if (questionForm.value.some((question) => {
    if (question.type === 'TEXT') return false;
    if (question.type === 'MATRIX') {
      return !question.matrixRows.trim() || !question.matrixColumns.trim();
    }
    return question.options.every((option) => !option.label.trim());
  })) {
    setError('选择题至少需要一个有效选项');
    return;
  }

  const questions = questionForm.value.map((question) => {
    let finalOptions = [];
    
    if (question.type === 'TEXT') {
      finalOptions = [];
    } else if (question.type === 'MATRIX') {
      // 对于矩阵题，直接从 matrixColumns 生成选项，并保留用户设置的分值
      const columns = question.matrixColumns.split('\n').filter(Boolean);
      finalOptions = columns.map((label, index) => {
        const existingOption = question.options[index];
        return {
          label: label.trim(),
          score: existingOption ? (Number(existingOption.score) || 0) : index,
        };
      });
    } else {
      // 其他题型使用用户编辑的选项
      finalOptions = question.options
        .filter((option) => option.label.trim())
        .map((option) => ({
          label: option.label.trim(),
          score: Number(option.score) || 0,
        }));
    }

    return {
      order: question.order,
      content: question.content.trim(),
      type: question.type,
      matrixRows: question.type === 'MATRIX' ? question.matrixRows : null,
      matrixColumns: question.type === 'MATRIX' ? question.matrixColumns : null,
      options: finalOptions,
    };
  });

  await adminApi.updateQuestions(questionScaleId.value, questions);
  questionScaleId.value = null;
  questionForm.value = [];
}

async function renderOverviewChart() {
  await nextTick();
  if (props.section !== 'overview') {
    destroyOverviewChart();
    return;
  }

  if (!overviewChart.value || !statistics.value) {
    return;
  }

  if (overviewChartInstance && overviewChartInstance.getDom() !== overviewChart.value) {
    destroyOverviewChart();
  }

  if (!overviewChartInstance) {
    overviewChartInstance = echarts.init(overviewChart.value);
  }
  overviewChartInstance.setOption({
    animationDuration: 450,
    color: ['#2f6b58', '#dba95d', '#6f9f91'],
    tooltip: { trigger: 'axis' },
    grid: { top: 24, right: 24, bottom: 34, left: 48 },
    xAxis: {
      type: 'category',
      data: ['用户', '测评完成', '聊天会话'],
      axisLine: { lineStyle: { color: '#c8d8d0' } },
      axisLabel: { color: '#668078' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#e6eee9' } },
      axisLabel: { color: '#8aa097' },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 56,
      data: [
        statistics.value.registeredUsers || 0,
        statistics.value.assessmentCompletions || 0,
        statistics.value.chatSessions || 0,
      ],
      itemStyle: { borderRadius: [6, 6, 0, 0] },
    }],
  });
}

function resizeOverviewChart() {
  overviewChartInstance?.resize();
}

function destroyOverviewChart() {
  if (!overviewChartInstance) {
    return;
  }

  overviewChartInstance.dispose();
  overviewChartInstance = undefined;
}

onMounted(() => {
  load();
  loadSectionData(props.section);
  window.addEventListener('resize', resizeOverviewChart);
});

watch(
  () => [props.section, statistics.value],
  renderOverviewChart,
  { deep: true },
);

watch(
  () => props.section,
  (section) => {
    loadSectionData(section);
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeOverviewChart);
  destroyOverviewChart();
  // 清除错误提示的定时器
  if (errorTimer) {
    clearTimeout(errorTimer);
    errorTimer = null;
  }
});
</script>

<template>
  <section class="content admin-page">
    <p v-if="error" class="error-banner">{{ error }}</p>
    <div v-if="props.section === 'scales'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>测评量表</h2>
          <p>维护面向用户的心理测评内容和适用场景。</p>
        </div>
        <span class="management-count">{{ scales.length }} 个量表</span>
      </div>
      <form class="admin-form management-form" @submit.prevent="saveScale">
        <input v-model="scaleForm.name" placeholder="量表名称" />
        <input v-model="scaleForm.applicableScene" placeholder="适用场景" />
        <textarea
          v-model="scaleForm.description"
          class="expandable-editor"
          placeholder="量表简介"
          rows="3"
          title="双击打开大窗口编辑"
          @dblclick="openExpandedEditor('scaleDescription')"
        />
        <div class="management-actions">
          <button class="primary-button" type="submit">{{ editingScaleId ? '保存修改' : '新增量表' }}</button>
          <button v-if="editingScaleId" class="text-button" type="button" @click="cancelScaleEdit">取消编辑</button>
        </div>
      </form>
      <div v-if="!scales.length" class="empty-state">暂无量表。</div>
      <article v-for="scale in scales" :key="scale.id" class="management-item scale-item">
        <div class="management-item-copy">
          <strong>{{ scale.name }}</strong>
          <span>{{ scale.applicableScene || '未设置适用场景' }}</span>
          <p>{{ scale.description || '暂无量表简介。' }}</p>
        </div>
        <div class="management-actions">
          <button class="secondary" type="button" @click="viewScale(scale)">查看</button>
          <button
            v-if="!scale.published"
            class="secondary"
            type="button"
            @click="editQuestions(scale)"
          >维护题目</button>
          <button
            v-if="!scale.published"
            class="secondary publish-button"
            type="button"
            @click="requestPublish(scale)"
          >发布</button>
          <span v-else class="status-chip status-success">已发布</span>
          <button
            v-if="!scale.published"
            class="text-button"
            type="button"
            @click="editScale(scale)"
          >编辑</button>
          <button class="text-button danger-button" type="button" @click="deleteScale(scale)">删除</button>
        </div>
      </article>
      <div v-if="questionScaleId" class="admin-form management-form question-form">
        <div class="question-form-heading">
          <div>
            <h3>题目与选项</h3>
            <p>按问卷顺序添加题目，并为选择题配置选项和分值。</p>
          </div>
          <button class="secondary" type="button" @click="addQuestion">添加题目</button>
        </div>
        <div v-if="!questionForm.length" class="empty-state question-empty">
          暂无题目，请点击“添加题目”。
        </div>
        <article v-for="(question, questionIndex) in questionForm" :key="questionIndex" class="question-editor">
          <div class="question-editor-head">
            <strong>第 {{ questionIndex + 1 }} 题</strong>
            <button class="text-button danger-button" type="button" @click="removeQuestion(questionIndex)">删除题目</button>
          </div>
          <input v-model="question.content" maxlength="1000" placeholder="请输入题目内容" />
          <label class="question-type-field">
            题目类型
            <select v-model="question.type" @change="changeQuestionType(question)">
              <option value="SINGLE">单选题</option>
              <option value="MULTIPLE">多选题</option>
              <option value="TEXT">文字题</option>
              <option value="JUDGE">判断题</option>
              <option value="MATRIX">矩阵量表题</option>
            </select>
          </label>
          <div v-if="question.type !== 'TEXT'" class="option-editor">
            <div v-if="question.type === 'MATRIX'" class="matrix-editor-fields">
              <label>
                矩阵行（每行一个项目）
                <textarea v-model="question.matrixRows" rows="3" />
              </label>
              <label>
                矩阵列（每行一个选项）
                <textarea
                  v-model="question.matrixColumns"
                  rows="3"
                  @input="updateMatrixOptions(question)"
                />
              </label>
              <p class="matrix-hint">矩阵列会自动转换为选项，请直接编辑矩阵列内容</p>
            </div>
            <div v-if="question.type !== 'MATRIX'" class="option-editor-head">
              <span>选项与分值</span>
              <button class="text-button" type="button" @click="addOption(question)">添加选项</button>
            </div>
            <div
              v-if="question.type !== 'MATRIX'"
              v-for="(option, optionIndex) in question.options"
              :key="optionIndex"
              class="option-editor-row"
            >
              <input v-model="option.label" maxlength="500" placeholder="选项内容" />
              <input v-model.number="option.score" type="number" min="0" placeholder="分值" />
              <button
                class="text-button danger-button"
                type="button"
                @click="removeOption(question, optionIndex)"
              >
                删除
              </button>
            </div>
          </div>
          <p v-else class="question-type-hint">文字题由用户直接填写，不参与自动计分。</p>
        </article>
        <div class="management-actions">
          <button class="primary-button" type="button" @click="saveQuestions">保存题目</button>
          <button class="text-button" type="button" @click="cancelQuestions">取消</button>
        </div>
      </div>
    </div>

    <div v-if="props.section === 'overview'" class="admin-section">
      <h2>数据概览</h2>
      <div v-if="statistics" class="metric-grid">
        <article class="metric-card">
          <span>注册用户</span>
          <strong>{{ statistics.registeredUsers || 0 }}</strong>
          <small>当前系统用户总数</small>
        </article>
        <article class="metric-card metric-card-gold">
          <span>测评完成</span>
          <strong>{{ statistics.assessmentCompletions || 0 }}</strong>
          <small>已提交的测评结果</small>
        </article>
        <article class="metric-card metric-card-blue">
          <span>聊天会话</span>
          <strong>{{ statistics.chatSessions || 0 }}</strong>
          <small>累计创建的会话</small>
        </article>
      </div>
      <div class="overview-chart-panel">
        <div>
          <h3>核心指标对比</h3>
          <p>基于当前系统累计数据</p>
        </div>
        <div ref="overviewChart" class="overview-chart" aria-label="用户、测评和聊天会话数量对比图" />
      </div>
      <div class="audit-panel">
        <div class="section-title compact-title">
          <div><h3>高危审计</h3><p>需要关注的会话记录</p></div>
          <span class="audit-count">{{ audits.length }} 条</span>
        </div>
        <div v-if="!audits.length" class="empty-state">暂无高危审计记录。</div>
        <div v-else class="audit-table" role="table" aria-label="高危审计记录">
          <div class="audit-row audit-row-head" role="row">
            <span>会话</span>
            <span>触发内容</span>
            <span>时间</span>
          </div>
          <div v-for="audit in audits" :key="audit.sessionId" class="audit-row" role="row">
            <strong>#{{ audit.sessionId }}</strong>
            <span>{{ audit.summary }}</span>
            <time>{{ formatDateTime(audit.createdAt) }}</time>
          </div>
        </div>
      </div>
    </div>

    <div v-if="props.section === 'announcements'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>系统公告</h2>
          <p>发布需要向用户公开展示的通知和提醒。</p>
        </div>
        <span class="management-count">{{ announcements.length }} 条公告</span>
      </div>
      <form class="admin-form management-form" @submit.prevent="saveAnnouncement">
        <input v-model="announcementForm.title" placeholder="公告标题" maxlength="200" />
        <textarea v-model="announcementForm.content" placeholder="公告内容" maxlength="10000" rows="3" />
        <div class="management-actions">
          <button class="primary-button" type="submit">
            {{ editingAnnouncementId ? '保存公告' : '发布公告' }}
          </button>
          <button
            v-if="editingAnnouncementId"
            class="text-button"
            type="button"
            @click="cancelAnnouncementEdit"
          >
            取消编辑
          </button>
        </div>
      </form>
      <article v-for="announcement in announcements" :key="announcement.id" class="management-item">
        <div class="management-item-copy">
          <strong>{{ announcement.title }}</strong>
          <p>{{ announcement.content }}</p>
        </div>
        <div class="management-actions">
          <button class="text-button" type="button" @click="editAnnouncement(announcement)">编辑</button>
          <button class="text-button danger-button" type="button" @click="deleteAnnouncement(announcement)">删除</button>
        </div>
      </article>
    </div>

    <div v-if="props.section === 'articles'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>科普文章</h2>
          <p>整理心理健康知识，帮助用户获得可靠的科普内容。</p>
        </div>
        <span class="management-count">{{ articles.length }} 篇文章</span>
      </div>
      <form class="admin-form management-form" @submit.prevent="saveArticle">
        <input v-model="articleForm.title" maxlength="200" placeholder="文章标题" />
        <input v-model="articleForm.summary" maxlength="500" placeholder="文章摘要" />
        <textarea
          v-model="articleForm.content"
          class="expandable-editor"
          maxlength="200000"
          rows="5"
          placeholder="文章正文"
          title="双击打开大窗口编辑"
          @dblclick="openExpandedEditor('articleContent')"
        />
        <div class="management-actions">
          <button class="primary-button" type="submit">{{ editingArticleId ? '保存文章' : '发布文章' }}</button>
          <button v-if="editingArticleId" class="text-button" type="button" @click="cancelArticleEdit">取消编辑</button>
        </div>
      </form>
      <div v-if="!articles.length" class="empty-state">暂无科普文章。</div>
      <article v-for="article in articles" :key="article.id" class="management-item">
        <div class="management-item-copy">
          <strong>{{ article.title }}</strong>
          <span>
            更新于 {{ formatDateTime(article.updatedAt) }} · 更新者 {{ article.updatedBy || '未记录' }}
          </span>
          <p>{{ article.summary || '暂无文章摘要。' }}</p>
        </div>
        <div class="management-actions">
          <button class="text-button" type="button" @click="editArticle(article)">编辑</button>
          <button class="text-button danger-button" type="button" @click="deleteArticle(article)">删除</button>
        </div>
      </article>
    </div>

    <div v-if="props.section === 'users'" class="admin-section">
      <h2>用户管理</h2>
      <form class="user-search" role="search" @submit.prevent="searchUsers">
        <label for="user-keyword">搜索用户名</label>
        <input
          id="user-keyword"
          v-model="userKeyword"
          maxlength="100"
          autocomplete="off"
          placeholder="输入用户名"
        />
        <button class="primary-button" type="submit">搜索</button>
        <button
          v-if="userKeyword"
          class="text-button"
          type="button"
          @click="clearUserSearch"
        >
          清空
        </button>
      </form>
      <div v-if="!users.length" class="empty-state">暂无用户。</div>
      <div v-else class="user-table-scroll">
        <div class="admin-row user-row-head">
          <span>账号</span>
          <span>用户名</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        <article v-for="user in users" :key="user.id" class="admin-row">
          <span>{{ user.username }}</span>
          <span>{{ user.nickname }}</span>
          <span>
            <span
              class="status-chip"
              :class="user.status === 'ACTIVE' ? 'status-success' : 'status-pending'"
            >
              {{ statusLabel(user.status) }}
            </span>
          </span>
          <button
            v-if="user.status !== 'CLOSED'"
            class="secondary"
            type="button"
            @click="toggleUser(user)"
          >
            {{ user.status === 'ACTIVE' ? '禁用' : '启用' }}
          </button>
          <span v-else class="management-count">账号已注销</span>
        </article>
      </div>
      <div v-if="userPage.totalPages > 1" class="pagination">
        <button
          class="text-button"
          :disabled="userPage.page === 0"
          type="button"
          @click="changeUserPage(userPage.page - 1)"
        >
          上一页
        </button>
        <span>{{ userPage.page + 1 }} / {{ userPage.totalPages }}</span>
        <button
          class="text-button"
          :disabled="userPage.page + 1 >= userPage.totalPages"
          type="button"
          @click="changeUserPage(userPage.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <div v-if="props.section === 'knowledge'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>知识库文档</h2>
          <p>维护 AI 对话检索使用的知识内容，并管理向量化状态。</p>
        </div>
        <span class="management-count">{{ documents.length }} 份文档</span>
      </div>
      <form class="admin-form management-form" @submit.prevent="saveKnowledgeSettings">
        <h3>分片参数</h3>
        <p class="question-type-hint">
          统一设置向量化的分片大小与重叠长度，修改后需要重新向量化已有文档才会生效。
        </p>
        <label>
          <span>分片大小（100 - 4000）</span>
          <input v-model.number="knowledgeSettings.chunkSize" type="number" min="100" max="4000" />
        </label>
        <label>
          <span>重叠长度（0 - 1000，且必须小于分片大小）</span>
          <input v-model.number="knowledgeSettings.chunkOverlap" type="number" min="0" max="1000" />
        </label>
        <div class="management-actions">
          <button class="primary-button" type="submit" :disabled="knowledgeSettingsSaving">
            {{ knowledgeSettingsSaving ? '保存中...' : '保存分片参数' }}
          </button>
        </div>
      </form>
      <form class="admin-form management-form" @submit.prevent="saveDocument">
        <input v-model="documentForm.title" placeholder="文档标题" />
        <textarea v-model="documentForm.content" placeholder="文档正文" rows="4" />
        <div class="management-actions">
          <button class="primary-button" :disabled="saving" type="submit">
            {{ saving ? '保存中...' : editingId ? '保存修改' : '新增文档' }}
          </button>
          <button v-if="editingId" class="text-button" type="button" @click="cancelDocumentEdit">取消编辑</button>
        </div>
      </form>
      <div v-if="!documents.length" class="empty-state">暂无知识库文档。</div>
      <article v-for="document in documents" :key="document.id" class="management-item">
        <div class="management-item-copy">
          <strong>{{ document.title }}</strong>
          <span
            class="status-chip"
            :class="document.vectorStatus === 'VECTORIZED' ? 'status-success' : 'status-pending'"
          >
            {{ document.vectorStatus === 'VECTORIZED' ? '已向量化' : '待向量化' }}
          </span>
        </div>
        <div class="management-actions">
          <button class="secondary" type="button" @click="vectorize(document)">
            {{ document.vectorStatus === 'VECTORIZED' ? '重新向量化' : '向量化' }}
          </button>
          <button class="text-button" type="button" @click="editDocument(document)">编辑</button>
          <button class="text-button danger-button" type="button" @click="deleteDocument(document)">删除</button>
        </div>
      </article>
    </div>
    <div v-if="props.section === 'push'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>通知推送</h2>
          <p>推送心理小贴士；未勾选永不过期时，通知默认 30 天后自动隐藏。</p>
        </div>
        <span class="management-count">{{ notificationPage.total || 0 }} 条推送记录</span>
      </div>
      <form class="admin-form management-form" @submit.prevent="pushNotification">
        <h3>新建推送</h3>
        <label>
          <span>推送范围</span>
          <select v-model="notificationForm.scope">
            <option value="ALL">全部用户</option>
            <option value="USER">指定用户</option>
          </select>
        </label>
        <label v-if="notificationForm.scope === 'USER'">
          <span>目标用户 ID</span>
          <input v-model="notificationForm.userId" inputmode="numeric" />
        </label>
        <label>
          <span>标题（最多 200 字）</span>
          <input v-model="notificationForm.title" maxlength="200" />
        </label>
        <label>
          <span>内容（最多 2000 字）</span>
          <textarea v-model="notificationForm.content" maxlength="2000" rows="4" />
        </label>
        <label class="admin-checkbox">
          <input v-model="notificationForm.permanent" type="checkbox" />
          <span>永不过期</span>
        </label>
        <div class="management-actions">
          <button class="primary-button" type="submit">推送通知</button>
        </div>
      </form>
      <div v-if="!notifications.length" class="empty-state">暂无推送记录。</div>
      <article v-for="notification in notifications" :key="notification.id" class="management-item">
        <div class="management-item-copy">
          <strong>{{ notification.title }}</strong>
          <span>
            {{ notification.scope === 'ALL' ? '全部用户' : '指定用户' }} ·
            {{ notification.expireAt ? '过期时间 ' + formatDateTime(notification.expireAt) : '永不过期' }}
          </span>
          <p>{{ notification.content }}</p>
        </div>
        <div class="management-actions">
          <button class="text-button danger-button" type="button" @click="revokeNotification(notification)">
            撤回
          </button>
        </div>
      </article>
      <div v-if="notificationPage.totalPages > 1" class="pagination">
        <button
          class="text-button"
          type="button"
          :disabled="notificationPage.page <= 0"
          @click="changeNotificationPage(notificationPage.page - 1)"
        >
          上一页
        </button>
        <span>第 {{ notificationPage.page + 1 }} / {{ notificationPage.totalPages }} 页</span>
        <button
          class="text-button"
          type="button"
          :disabled="notificationPage.page >= notificationPage.totalPages - 1"
          @click="changeNotificationPage(notificationPage.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <div v-if="props.section === 'sensitive'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>敏感词词库</h2>
          <p>CARE 级别只提示不阻断，HIGH 级别会直接阻断对话并给出心理援助热线。</p>
        </div>
        <span class="management-count">{{ sensitiveWords.length }} 个词条</span>
      </div>
      <form class="admin-form management-form" @submit.prevent="saveSensitiveWord">
        <h3>{{ editingSensitiveWordId ? '编辑词条' : '新增词条' }}</h3>
        <label>
          <span>敏感词（最多 64 字）</span>
          <input v-model="sensitiveWordForm.word" maxlength="64" />
        </label>
        <label>
          <span>级别</span>
          <select v-model="sensitiveWordForm.level">
            <option value="CARE">CARE（提示但不阻断）</option>
            <option value="HIGH">HIGH（直接阻断对话）</option>
          </select>
        </label>
        <label class="admin-checkbox">
          <input v-model="sensitiveWordForm.enabled" type="checkbox" />
          <span>启用该词条</span>
        </label>
        <div class="management-actions">
          <button class="primary-button" type="submit">
            {{ editingSensitiveWordId ? '保存修改' : '新增词条' }}
          </button>
          <button
            v-if="editingSensitiveWordId"
            class="text-button"
            type="button"
            @click="cancelSensitiveWordEdit"
          >
            取消编辑
          </button>
        </div>
      </form>
      <div v-if="!sensitiveWords.length" class="empty-state">
        词库为空时服务端会回退内置词表，校验仍然生效。
      </div>
      <article v-for="item in sensitiveWords" :key="item.id" class="management-item">
        <div class="management-item-copy">
          <strong>{{ item.word }}</strong>
          <span>
            {{ item.level === 'HIGH' ? 'HIGH 直接阻断' : 'CARE 提示不阻断' }} ·
            {{ item.enabled ? '已启用' : '已停用' }}
          </span>
        </div>
        <div class="management-actions">
          <button class="text-button" type="button" @click="editSensitiveWord(item)">编辑</button>
          <button class="text-button danger-button" type="button" @click="deleteSensitiveWord(item)">删除</button>
        </div>
      </article>
    </div>

    <div v-if="props.section === 'feedbacks'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>反馈工单</h2>
          <p>查看用户提交的问题与建议，处理后标记状态并留下备注。</p>
        </div>
        <span class="management-count">{{ feedbackPage.total || 0 }} 条工单</span>
      </div>
      <div class="admin-filter-bar">
        <label>
          <span>状态筛选</span>
          <select v-model="feedbackStatusFilter" @change="searchFeedbacks">
            <option value="">全部</option>
            <option value="PENDING">待处理</option>
            <option value="PROCESSED">已处理</option>
            <option value="REJECTED">已驳回</option>
          </select>
        </label>
      </div>
      <div v-if="!feedbacks.length" class="empty-state">暂无反馈工单。</div>
      <article v-for="ticket in feedbacks" :key="ticket.id" class="management-item">
        <div class="management-item-copy">
          <strong>
            {{ ticket.type === 'BUG' ? '问题反馈' : ticket.type === 'SUGGESTION' ? '功能建议' : '其他反馈' }}
          </strong>
          <span>
            {{ formatDateTime(ticket.createdAt) }} ·
            {{ ticket.status === 'PENDING' ? '待处理' : ticket.status === 'PROCESSED' ? '已处理' : '已驳回' }}
          </span>
          <p>{{ ticket.content }}</p>
          <input v-model="ticket.remarkDraft" maxlength="500" placeholder="处理备注（最多 500 字）" />
        </div>
        <div class="management-actions">
          <button class="secondary" type="button" @click="handleFeedback(ticket, 'PROCESSED')">标记已处理</button>
          <button class="text-button" type="button" @click="handleFeedback(ticket, 'REJECTED')">驳回</button>
        </div>
      </article>
      <div v-if="feedbackPage.totalPages > 1" class="pagination">
        <button
          class="text-button"
          type="button"
          :disabled="feedbackPage.page <= 0"
          @click="changeFeedbackPage(feedbackPage.page - 1)"
        >
          上一页
        </button>
        <span>第 {{ feedbackPage.page + 1 }} / {{ feedbackPage.totalPages }} 页</span>
        <button
          class="text-button"
          type="button"
          :disabled="feedbackPage.page >= feedbackPage.totalPages - 1"
          @click="changeFeedbackPage(feedbackPage.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <div v-if="props.section === 'logs'" class="admin-section management-section">
      <div class="management-heading">
        <div>
          <h2>操作日志</h2>
          <p>只记录操作者、类型、目标与摘要，不含业务正文，方便审计与追溯。</p>
        </div>
        <span class="management-count">{{ operationLogPage.total || 0 }} 条记录</span>
      </div>
      <div class="admin-filter-bar">
        <label>
          <span>操作类型</span>
          <select v-model="operationLogTypeFilter" @change="searchOperationLogs">
            <option value="">全部</option>
            <option value="DOCUMENT">知识库文档</option>
            <option value="SCALE">测评量表</option>
            <option value="ARTICLE">科普文章</option>
            <option value="ANNOUNCEMENT">系统公告</option>
            <option value="USER">用户状态</option>
            <option value="NOTIFICATION">通知推送</option>
            <option value="SENSITIVE_WORD">敏感词规则</option>
            <option value="FEEDBACK">反馈工单</option>
            <option value="SYSTEM_SETTING">系统设置</option>
          </select>
        </label>
        <label>
          <span>开始日期</span>
          <input v-model="operationLogForm.startDate" type="date" />
        </label>
        <label>
          <span>结束日期</span>
          <input v-model="operationLogForm.endDate" type="date" />
        </label>
        <button class="secondary" type="button" @click="searchOperationLogs">查询</button>
      </div>
      <div v-if="!operationLogs.length" class="empty-state">暂无操作日志。</div>
      <div v-else class="log-table">
        <div class="log-row log-row-head">
          <span>操作者</span>
          <span>类型</span>
          <span>目标</span>
          <span>摘要</span>
          <span>时间</span>
        </div>
        <div v-for="log in operationLogs" :key="log.id" class="log-row">
          <span>{{ log.operatorName || '-' }}</span>
          <span>{{ log.type }}</span>
          <span>{{ log.targetId ? log.targetType + ' #' + log.targetId : log.targetType }}</span>
          <span>{{ log.summary }}</span>
          <time>{{ formatDateTime(log.createdAt) }}</time>
        </div>
      </div>
      <div v-if="operationLogPage.totalPages > 1" class="pagination">
        <button
          class="text-button"
          type="button"
          :disabled="operationLogPage.page <= 0"
          @click="changeOperationLogPage(operationLogPage.page - 1)"
        >
          上一页
        </button>
        <span>第 {{ operationLogPage.page + 1 }} / {{ operationLogPage.totalPages }} 页</span>
        <button
          class="text-button"
          type="button"
          :disabled="operationLogPage.page >= operationLogPage.totalPages - 1"
          @click="changeOperationLogPage(operationLogPage.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </section>
  <div
    v-if="expandedEditorTarget"
    class="editor-modal-backdrop"
    @click.self="closeExpandedEditor"
  >
    <section class="editor-modal" role="dialog" aria-modal="true" :aria-label="expandedEditorTitle">
      <div class="editor-modal-head">
        <div>
          <h2>{{ expandedEditorTitle }}</h2>
          <p>内容较多时可在右侧滚动查看，修改会同步到表单。</p>
        </div>
        <button class="text-button" type="button" @click="closeExpandedEditor">关闭</button>
      </div>
      <textarea v-model="expandedEditorContent" class="editor-modal-textarea" maxlength="200000" />
      <div class="editor-modal-actions">
        <span>{{ expandedEditorContent.length }} / 200000</span>
        <button class="primary-button" type="button" @click="closeExpandedEditor">完成编辑</button>
      </div>
    </section>
  </div>

  <div v-if="viewingScale" class="modal-backdrop" @click.self="closeScaleView">
    <section
      class="modal scale-view-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scale-view-title"
    >
      <header class="scale-view-head">
        <div>
          <span class="eyebrow">QUESTIONNAIRE</span>
          <h2 id="scale-view-title">{{ viewingScale.name }}</h2>
          <p class="scale-view-meta">
            共 {{ viewQuestions.length }} 道题目
            <span class="scale-view-dot">·</span>
            {{ viewingScale.applicableScene || '未设置适用场景' }}
            <span v-if="viewingScale.published" class="status-chip status-success">已发布</span>
          </p>
        </div>
        <button class="text-button scale-view-close" type="button" @click="closeScaleView">关闭</button>
      </header>
      <p v-if="viewingScale.description" class="scale-view-description">{{ viewingScale.description }}</p>
      <div v-if="viewLoading" class="empty-state">问卷内容加载中...</div>
      <div v-else-if="!viewQuestions.length" class="empty-state">该量表暂无题目。</div>
      <ol v-else class="scale-view-list">
        <li
          v-for="(question, questionIndex) in viewQuestions"
          :key="question.id"
          class="scale-view-question"
          :style="{ '--i': questionIndex }"
        >
          <div class="scale-view-question-title">
            <b>{{ String(questionIndex + 1).padStart(2, '0') }}</b>
            <div class="scale-view-question-text">
              <span>{{ question.content }}</span>
              <em>{{ questionTypeLabel(question.type) }}</em>
            </div>
          </div>
          <ul v-if="question.options?.length" class="scale-view-options">
            <li v-for="option in question.options" :key="option.id">
              <span>{{ option.label }}</span>
              <small>{{ option.score }} 分</small>
            </li>
          </ul>
          <p
            v-if="question.type === 'MATRIX' && question.matrixRows"
            class="scale-view-matrix"
          >
            矩阵行：{{ question.matrixRows.split('\n').filter(Boolean).join('、') }}
          </p>
        </li>
      </ol>
      <footer class="scale-view-foot">此处仅预览问卷内容，不支持在预览中修改。</footer>
    </section>
  </div>
  <ConfirmDialog
    :visible="Boolean(pendingConfirm)"
    :title="pendingConfirm ? pendingConfirm.title : '操作确认'"
    :message="pendingConfirm ? pendingConfirm.message : ''"
    :confirm-text="pendingConfirm ? pendingConfirm.confirmText : '确认'"
    :danger="true"
    :busy="confirmBusy"
    @confirm="runConfirmedAction"
    @cancel="cancelConfirm"
  />
</template>
