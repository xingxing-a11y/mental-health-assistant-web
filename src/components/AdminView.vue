<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { adminApi, assessmentApi } from '../api/modules';

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
    const [userResult, documentResult, scaleResult, articleResult, auditResult, statsResult, announcementResult] = await Promise.all([
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
    error.value = requestError.message;
  }
}

async function toggleUser(user) {
  const status = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  user.status = (await adminApi.updateUserStatus(user.id, status)).status;
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
    error.value = '文档标题和正文不能为空';
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
    error.value = requestError.message || '知识库文档保存失败';
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

async function deleteDocument(document) {
  await adminApi.deleteDocument(document.id);
  documents.value = documents.value.filter((item) => item.id !== document.id);
}

async function saveScale() {
  if (!scaleForm.value.name.trim()) {
    error.value = '量表名称不能为空';
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

function editScale(scale) {
  editingScaleId.value = scale.id;
  scaleForm.value = {
    name: scale.name,
    description: scale.description || '',
    applicableScene: scale.applicableScene || '',
  };
}

async function deleteScale(scale) {
  await adminApi.deleteScale(scale.id);
  scales.value = scales.value.filter((item) => item.id !== scale.id);
}

async function deleteArticle(article) {
  await adminApi.deleteArticle(article.id);
  articles.value = articles.value.filter((item) => item.id !== article.id);
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

function formatArticleUpdatedAt(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

async function deleteAnnouncement(announcement) {
  await adminApi.deleteAnnouncement(announcement.id);
  announcements.value = announcements.value.filter((item) => item.id !== announcement.id);
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
    return;
  }

  if (question.type === 'JUDGE') {
    question.options = [
      { label: '正确', score: 1 },
      { label: '错误', score: 0 },
    ];
    return;
  }

  if (!question.options.length) {
    question.options = [
      { label: '', score: 0 },
      { label: '', score: 0 },
    ];
  }
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
    error.value = '题目内容不能为空';
    return;
  }
  if (questionForm.value.some((question) => question.type !== 'TEXT'
      && question.options.every((option) => !option.label.trim()))) {
    error.value = '选择题至少需要一个有效选项';
    return;
  }
  const questions = questionForm.value.map((question) => ({
    order: question.order,
    content: question.content.trim(),
    type: question.type,
    options: question.type === 'TEXT'
      ? []
      : question.options
        .filter((option) => option.label.trim())
        .map((option) => ({
          label: option.label.trim(),
          score: Number(option.score) || 0,
        })),
  }));
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

function formatAuditTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

onMounted(() => {
  load();
  window.addEventListener('resize', resizeOverviewChart);
});

watch(
  () => [props.section, statistics.value],
  renderOverviewChart,
  { deep: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeOverviewChart);
  destroyOverviewChart();
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
          <button v-if="editingScaleId" class="text-button" type="button" @click="editingScaleId = null">取消编辑</button>
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
          <button class="secondary" type="button" @click="editQuestions(scale)">维护题目</button>
          <button class="text-button" type="button" @click="editScale(scale)">编辑</button>
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
            </select>
          </label>
          <div v-if="question.type !== 'TEXT'" class="option-editor">
            <div class="option-editor-head">
              <span>选项与分值</span>
              <button class="text-button" type="button" @click="addOption(question)">添加选项</button>
            </div>
            <div v-for="(option, optionIndex) in question.options" :key="optionIndex" class="option-editor-row">
              <input v-model="option.label" maxlength="500" placeholder="选项内容" />
              <input v-model.number="option.score" type="number" min="0" placeholder="分值" />
              <button class="text-button danger-button" type="button" @click="removeOption(question, optionIndex)">删除</button>
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
            <time>{{ formatAuditTime(audit.createdAt) }}</time>
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
            @click="editingAnnouncementId = null; announcementForm = { title: '', content: '' }"
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
            更新于 {{ formatArticleUpdatedAt(article.updatedAt) }} · 更新者 {{ article.updatedBy || '未记录' }}
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
      <div v-else class="admin-row user-row-head">
        <span>账号</span>
        <span>用户名</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <article v-for="user in users" :key="user.id" class="admin-row">
        <span>{{ user.username }}</span>
        <span>{{ user.nickname }}</span>
        <span>{{ user.status }}</span>
        <button class="secondary" type="button" @click="toggleUser(user)">
          {{ user.status === 'ACTIVE' ? '禁用' : '启用' }}
        </button>
      </article>
      <div v-if="userPage.totalPages > 1" class="pagination">
        <button class="text-button" :disabled="userPage.page === 0" type="button" @click="changeUserPage(userPage.page - 1)">上一页</button>
        <span>{{ userPage.page + 1 }} / {{ userPage.totalPages }}</span>
        <button class="text-button" :disabled="userPage.page + 1 >= userPage.totalPages" type="button" @click="changeUserPage(userPage.page + 1)">下一页</button>
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
      <form class="admin-form management-form" @submit.prevent="saveDocument">
        <input v-model="documentForm.title" placeholder="文档标题" />
        <textarea v-model="documentForm.content" placeholder="文档正文" rows="4" />
        <div class="management-actions">
          <button class="primary-button" :disabled="saving" type="submit">{{ saving ? '保存中...' : editingId ? '保存修改' : '新增文档' }}</button>
          <button v-if="editingId" class="text-button" type="button" @click="editingId = null">取消编辑</button>
        </div>
      </form>
      <div v-if="!documents.length" class="empty-state">暂无知识库文档。</div>
      <article v-for="document in documents" :key="document.id" class="management-item">
        <div class="management-item-copy">
          <strong>{{ document.title }}</strong>
          <span class="status-chip" :class="document.vectorStatus === 'VECTORIZED' ? 'status-success' : 'status-pending'">
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
</template>
