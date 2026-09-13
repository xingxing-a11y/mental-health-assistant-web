<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Menu } from 'lucide-vue-next';
import AppSidebar from './components/AppSidebar.vue';
import ArticleView from './components/ArticleView.vue';
import AssessmentView from './components/AssessmentView.vue';
import ChatView from './components/ChatView.vue';
import DisclaimerModal from './components/DisclaimerModal.vue';
import ProfileView from './components/ProfileView.vue';
import LoginView from './components/LoginView.vue';
import AdminView from './components/AdminView.vue';
import DiaryView from './components/DiaryView.vue';
import { announcementApi, articleApi, assessmentApi, chatApi, diaryApi, streamChat, userApi } from './api/modules';

const active = ref('chat');
const mobileOpen = ref(false);
const disclaimerVisible = ref(true);
const sessions = ref([]);
const messages = ref([]);
const favorites = ref([]);
const scales = ref([]);
const assessmentHistory = ref([]);
const diaries = ref([]);
const emotionTrend = ref([]);
const announcements = ref([]);
const articles = ref([]);
const profile = ref(null);
const selectedScale = ref(null);
const report = ref(null);
const selectedArticle = ref(null);
const currentSessionId = ref(null);
const chatMode = ref('COMPANION');
const loading = ref(false);
const error = ref('');
const toast = ref('');
const authenticated = ref(true);
const authChecking = ref(true);

function handleAuthExpired() {
  authenticated.value = false;
  authChecking.value = false;
  profile.value = null;
  sessions.value = [];
  messages.value = [];
}

const titles = {
  chat: '对话陪伴',
  assessment: '心理测评',
  articles: '心理科普',
  diary: '情绪日记',
  profile: '个人中心',
  admin: '管理后台',
};

function notify(message) {
  toast.value = message;
  window.setTimeout(() => {
    toast.value = '';
  }, 1800);
}

function selectModule(module) {
  active.value = module;
  mobileOpen.value = false;
}

async function loadData() {
  if (!authenticated.value) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const [sessionData, scaleData, articleData, userData, historyData, diaryData, trendData, announcementData, favoriteData] = await Promise.all([
      chatApi.list(),
      assessmentApi.scales(),
      articleApi.list(),
      userApi.current(),
      assessmentApi.history(),
      diaryApi.list(),
      diaryApi.trend('', ''),
      announcementApi.list(),
      chatApi.favorites(),
    ]);

    sessions.value = sessionData || [];
    scales.value = scaleData || [];
    articles.value = articleData || [];
    profile.value = userData || null;
    assessmentHistory.value = historyData || [];
    diaries.value = diaryData || [];
    emotionTrend.value = trendData || [];
    announcements.value = announcementData || [];
    favorites.value = favoriteData || [];
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
    authChecking.value = false;
  }
}

async function createDiary(data) {
  diaries.value.unshift(await diaryApi.create(data));
  emotionTrend.value = await diaryApi.trend('', '');
  notify('日记已保存');
}

async function deleteDiary(diary) {
  await diaryApi.remove(diary.id);
  diaries.value = diaries.value.filter((item) => item.id !== diary.id);
}

async function analyzeDiary(diary) {
  const result = await diaryApi.analyze(diary.id);
  notify(result.analysis || '分析已完成');
}

async function refreshTrend(startDate, endDate) {
  try {
    emotionTrend.value = await diaryApi.trend(startDate, endDate);
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function openSession(session) {
  currentSessionId.value = session.id;
  chatMode.value = session.mode || 'COMPANION';
  messages.value = await chatApi.history(session.id);
}

async function createSession() {
  const session = await chatApi.create({});
  sessions.value.unshift(session);
  await openSession(session);
  notify('已创建新会话');
}

async function deleteSession(session) {
  await chatApi.remove(session.id);
  sessions.value = sessions.value.filter((item) => item.id !== session.id);

  if (currentSessionId.value === session.id) {
    currentSessionId.value = null;
    messages.value = [];
  }
}

async function clearContext(sessionId) {
  await chatApi.clearContext(sessionId);
  messages.value = [];
  notify('已开启新的对话上下文');
}

async function updateChatMode(mode) {
  chatMode.value = mode;
  await chatApi.updateSettings(currentSessionId.value, mode);
}

async function toggleFavorite(message) {
  message.favorite = !message.favorite;
  await chatApi.favoriteMessage(message.id, message.favorite);
  favorites.value = await chatApi.favorites();
}

async function loadFavorites() {
  favorites.value = await chatApi.favorites();
}

async function searchArticles(keyword) {
  try {
    articles.value = await articleApi.list(keyword);
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function sendMessage(content) {
  if (!content || !currentSessionId.value) {
    return;
  }

  messages.value.push({ role: 'USER', content });
  const assistant = { role: 'ASSISTANT', content: '' };
  messages.value.push(assistant);

  try {
    await streamChat(currentSessionId.value, content, (eventName, data) => {
      if (eventName === 'ping') {
        return;
      }

      let payload = {};
      if (data) {
        try {
          payload = JSON.parse(data);
        } catch (parseError) {
          error.value = 'AI 返回的数据格式无效';
          return;
        }
      }

      if (eventName === 'message') {
        assistant.content += payload.content || '';
      }

      if (eventName === 'risk') {
        assistant.content = payload.message || '';
        notify('检测到危机风险，请优先联系专业援助');
      }

      if (eventName === 'error') {
        assistant.content = payload.message || 'AI 服务暂时不可用';
      }
    });
  } catch (requestError) {
    if (!assistant.content) {
      assistant.content = requestError.message;
    }
    error.value = requestError.message;
  }
}

async function startAssessment(scale) {
  selectedScale.value = await assessmentApi.detail(scale.id);
  report.value = { answers: {} };
}

async function submitAssessment() {
  const answers = Object.entries(report.value.answers).map(
    ([questionId, optionId]) => ({
      questionId: Number(questionId),
      optionId: Number(optionId),
    }),
  );

  report.value = await assessmentApi.submit({
    scaleId: selectedScale.value.id,
    answers,
  });
  assessmentHistory.value = await assessmentApi.history();
  notify('测评报告已生成');
}

async function showArticle(article) {
  selectedArticle.value = await articleApi.detail(article.id);
}

async function logout() {
  await userApi.logout();
  window.location.reload();
}

async function saveProfile(data) {
  try {
    profile.value = await userApi.updateProfile(data);
    notify('资料已更新');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function changePassword(data) {
  try {
    await userApi.updatePassword(data);
    notify('密码已更新');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

onMounted(() => {
  window.addEventListener('mh-auth-expired', handleAuthExpired);
  loadData();
});

onBeforeUnmount(() => {
  window.removeEventListener('mh-auth-expired', handleAuthExpired);
});
</script>

<template>
  <LoginView
    v-if="!authChecking && !authenticated"
    @success="authenticated = true; authChecking = true; loadData()"
  />
  <div v-else-if="!authChecking" class="shell">
    <AppSidebar
      :active="active"
      :open="mobileOpen"
      :is-admin="profile?.role === 'ADMIN'"
      @select="selectModule"
      @close="mobileOpen = false"
      @logout="logout"
    />

    <main>
      <header>
        <button class="icon mobile-menu" @click="mobileOpen = true">
          <Menu :size="21" />
        </button>
        <div>
          <span class="eyebrow">SPACE FOR YOUR THOUGHTS</span>
          <h1>{{ titles[active] }}</h1>
        </div>
        <div v-if="profile" class="header-user">
          <span class="avatar">{{ profile.nickname?.slice(0, 1) }}</span>
          {{ profile.nickname }}
        </div>
      </header>

      <p v-if="loading" class="loading-state">正在加载...</p>
      <p v-if="error" class="error-banner">{{ error }}</p>
      <div v-if="announcements.length" class="notice">
        <strong>{{ announcements[0].title }}</strong>：{{ announcements[0].content }}
      </div>

      <ChatView
        v-if="active === 'chat'"
        :sessions="sessions"
        :messages="messages"
        :favorites="favorites"
        :current-session-id="currentSessionId"
        :mode="chatMode"
        @create="createSession"
        @open="openSession"
        @delete="deleteSession"
        @clear="clearContext"
        @send="sendMessage"
        @mode="updateChatMode"
        @favorite="toggleFavorite"
        @load-favorites="loadFavorites"
      />
      <AssessmentView
        v-else-if="active === 'assessment'"
        :scales="scales"
        :selected-scale="selectedScale"
        :report="report"
        :history="assessmentHistory"
        @start="startAssessment"
        @submit="submitAssessment"
      />
      <ArticleView
        v-else-if="active === 'articles'"
        :articles="articles"
        :selected-article="selectedArticle"
        @open="showArticle"
        @back="selectedArticle = null"
        @search="searchArticles"
      />
      <DiaryView
        v-else-if="active === 'diary'"
        :diaries="diaries"
        :trend="emotionTrend"
        @create="createDiary"
        @delete="deleteDiary"
        @analyze="analyzeDiary"
        @trend="refreshTrend"
      />
      <AdminView v-else-if="active === 'admin' && profile?.role === 'ADMIN'" />
      <ProfileView
        v-else
        :profile="profile"
        @save-profile="saveProfile"
        @change-password="changePassword"
      />
    </main>

    <DisclaimerModal
      :visible="disclaimerVisible"
      @close="disclaimerVisible = false"
    />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
  <div v-else class="loading-state">正在验证登录状态...</div>
</template>
