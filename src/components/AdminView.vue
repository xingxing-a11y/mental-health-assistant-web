<script setup>
import { onMounted, ref } from 'vue';
import { adminApi, assessmentApi } from '../api/modules';

const users = ref([]);
const userPage = ref({ page: 0, size: 20, total: 0, totalPages: 0 });
const documents = ref([]);
const scales = ref([]);
const articles = ref([]);
const error = ref('');
const documentForm = ref({ title: '', content: '' });
const editingId = ref(null);
const scaleForm = ref({ name: '', description: '', applicableScene: '' });
const editingScaleId = ref(null);
const questionScaleId = ref(null);
const questionJson = ref('[]');
const saving = ref(false);
const audits = ref([]);
const statistics = ref(null);
const announcements = ref([]);
const announcementForm = ref({ title: '', content: '' });
const editingAnnouncementId = ref(null);
const articleForm = ref({ title: '', summary: '', content: '' });
const editingArticleId = ref(null);

async function load() {
  try {
    const [userResult, documentResult, scaleResult, articleResult, auditResult, statsResult, announcementResult] = await Promise.all([
      adminApi.users(userPage.value.page, userPage.value.size),
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
  const saved = editingId.value
    ? await adminApi.updateDocument(editingId.value, documentForm.value)
    : await adminApi.createDocument(documentForm.value);
  if (editingId.value) {
    const index = documents.value.findIndex((item) => item.id === editingId.value);
    documents.value[index] = saved;
  } else {
    documents.value.unshift(saved);
  }
  documentForm.value = { title: '', content: '' };
  editingId.value = null;
  saving.value = false;
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
  questionJson.value = JSON.stringify(
    (detail.questions || []).map((question) => ({
      order: question.questionOrder,
      content: question.content,
      options: (question.options || []).map((option) => ({
        label: option.label,
        score: option.score,
      })),
    })),
    null,
    2,
  );
}

async function saveQuestions() {
  let questions;
  try {
    questions = JSON.parse(questionJson.value);
  } catch (parseError) {
    error.value = '题目 JSON 格式不正确';
    return;
  }
  await adminApi.updateQuestions(questionScaleId.value, questions);
  questionScaleId.value = null;
}

onMounted(load);
</script>

<template>
  <section class="content admin-page">
    <p v-if="error" class="error-banner">{{ error }}</p>
    <div class="admin-section">
      <h2>测评量表</h2>
      <form class="admin-form" @submit.prevent="saveScale">
        <input v-model="scaleForm.name" placeholder="量表名称" />
        <input v-model="scaleForm.applicableScene" placeholder="适用场景" />
        <textarea v-model="scaleForm.description" placeholder="量表简介" rows="3" />
        <div>
          <button class="primary-button" type="submit">{{ editingScaleId ? '保存修改' : '新增量表' }}</button>
          <button v-if="editingScaleId" class="text-button" type="button" @click="editingScaleId = null">取消编辑</button>
        </div>
      </form>
      <div v-if="!scales.length" class="empty-state">暂无量表。</div>
      <article v-for="scale in scales" :key="scale.id" class="admin-row">
        <span>{{ scale.name }}</span>
        <span>{{ scale.applicableScene }}</span>
        <button class="text-button" type="button" @click="editScale(scale)">编辑</button>
        <button class="text-button" type="button" @click="deleteScale(scale)">删除</button>
        <button class="text-button" type="button" @click="editQuestions(scale)">维护题目</button>
      </article>
      <div v-if="questionScaleId" class="admin-form">
        <h3>题目与选项</h3>
        <textarea v-model="questionJson" rows="12" />
        <div>
          <button class="primary-button" type="button" @click="saveQuestions">保存题目</button>
          <button class="text-button" type="button" @click="questionScaleId = null">取消</button>
        </div>
      </div>
    </div>

    <div class="admin-section">
      <h2>数据概览</h2>
      <p v-if="statistics">用户 {{ statistics.registeredUsers }} · 测评 {{ statistics.assessmentCompletions }} · 会话 {{ statistics.chatSessions }}</p>
      <h3>高危审计</h3>
      <p v-for="audit in audits" :key="audit.sessionId">会话 {{ audit.sessionId }} · {{ audit.summary }}</p>
    </div>

    <div class="admin-section">
      <h2>系统公告</h2>
      <form class="admin-form" @submit.prevent="saveAnnouncement">
        <input v-model="announcementForm.title" placeholder="公告标题" maxlength="200" />
        <textarea v-model="announcementForm.content" placeholder="公告内容" maxlength="10000" rows="3" />
        <div>
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
      <article v-for="announcement in announcements" :key="announcement.id" class="admin-row">
        <strong>{{ announcement.title }}</strong>
        <span>{{ announcement.content }}</span>
        <button class="text-button" type="button" @click="editAnnouncement(announcement)">编辑</button>
        <button class="text-button" type="button" @click="deleteAnnouncement(announcement)">删除</button>
      </article>
    </div>

    <div class="admin-section">
      <h2>科普文章</h2>
      <form class="admin-form" @submit.prevent="saveArticle">
        <input v-model="articleForm.title" maxlength="200" placeholder="文章标题" />
        <input v-model="articleForm.summary" maxlength="500" placeholder="文章摘要" />
        <textarea v-model="articleForm.content" maxlength="200000" rows="5" placeholder="文章正文" />
        <div>
          <button class="primary-button" type="submit">{{ editingArticleId ? '保存文章' : '发布文章' }}</button>
          <button v-if="editingArticleId" class="text-button" type="button" @click="editingArticleId = null">取消编辑</button>
        </div>
      </form>
      <div v-if="!articles.length" class="empty-state">暂无科普文章。</div>
      <article v-for="article in articles" :key="article.id" class="admin-row">
        <span>{{ article.title }}</span>
        <span>{{ article.updatedAt }}</span>
        <button class="text-button" type="button" @click="editArticle(article)">编辑</button>
        <button class="text-button" type="button" @click="deleteArticle(article)">删除</button>
      </article>
    </div>

    <div class="admin-section">
      <h2>用户管理</h2>
      <div v-if="!users.length" class="empty-state">暂无用户。</div>
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

    <div class="admin-section">
      <h2>知识库文档</h2>
      <form class="admin-form" @submit.prevent="saveDocument">
        <input v-model="documentForm.title" placeholder="文档标题" />
        <textarea v-model="documentForm.content" placeholder="文档正文" rows="4" />
        <div>
          <button class="primary-button" :disabled="saving" type="submit">{{ saving ? '保存中...' : editingId ? '保存修改' : '新增文档' }}</button>
          <button v-if="editingId" class="text-button" type="button" @click="editingId = null">取消编辑</button>
        </div>
      </form>
      <div v-if="!documents.length" class="empty-state">暂无知识库文档。</div>
      <article v-for="document in documents" :key="document.id" class="admin-row">
        <span>{{ document.title }}</span>
        <span>{{ document.vectorStatus }}</span>
        <button class="secondary" type="button" @click="vectorize(document)">
          {{ document.vectorStatus === 'VECTORIZED' ? '重新向量化' : '向量化' }}
        </button>
        <button class="text-button" type="button" @click="editDocument(document)">编辑</button>
        <button class="text-button" type="button" @click="deleteDocument(document)">删除</button>
      </article>
    </div>
  </section>
</template>
