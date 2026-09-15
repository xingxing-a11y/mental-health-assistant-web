<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Menu, Settings, UserRound } from 'lucide-vue-next';
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
const adminSection = ref(null);
const mobileOpen = ref(false);
const profileMenuOpen = ref(false);
const disclaimerVisible = ref(false);
const sessions = ref([]);
const messages = ref([]);
const favorites = ref([]);
const pendingSessions = ref(new Set());
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
  settings: '设置',
  admin: '管理后台',
};

function notify(message) {
  toast.value = message;
  window.setTimeout(() => {
    toast.value = '';
  }, 1800);
}

function acknowledgeDisclaimer() {
  disclaimerVisible.value = false;
}

function handleLoginSuccess() {
  authenticated.value = true;
  authChecking.value = true;
  disclaimerVisible.value = true;
  loadData();
}

function selectModule(module) {
  active.value = module;
  mobileOpen.value = false;
  profileMenuOpen.value = false;
}

function selectAdminSection(section) {
  active.value = 'admin';
  adminSection.value = section;
  mobileOpen.value = false;
  profileMenuOpen.value = false;
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value;
}

function selectProfileMenu(module) {
  active.value = module;
  profileMenuOpen.value = false;
}

function closeProfileMenu(event) {
  if (!event.target.closest('.profile-menu-wrap')) {
    profileMenuOpen.value = false;
  }
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
    disclaimerVisible.value = true;
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
  currentSessionId.value = `draft-${Date.now()}`;
  messages.value = [];
  chatMode.value = 'COMPANION';
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

async function renameSession(session, name) {
  const updated = await chatApi.rename(session.id, name);
  const index = sessions.value.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    sessions.value[index] = updated;
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
  const nextFavorite = !message.favorite;
  await chatApi.favoriteMessage(message.id, nextFavorite);
  const currentMessage = messages.value.find((item) => item.id === message.id);
  if (currentMessage) {
    currentMessage.favorite = nextFavorite;
  }
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

  if (String(currentSessionId.value).startsWith('draft-')) {
    const session = await chatApi.create({});
    currentSessionId.value = session.id;
    chatMode.value = session.mode || 'COMPANION';
  }

  const requestSessionId = currentSessionId.value;
  pendingSessions.value = new Set(pendingSessions.value).add(requestSessionId);
  messages.value.push({ role: 'USER', content });
  messages.value.push({ role: 'ASSISTANT', content: '' });
  const assistantIndex = messages.value.length - 1;
  if (!sessions.value.some((session) => String(session.id) === String(currentSessionId.value))) {
    sessions.value.unshift({
      id: currentSessionId.value,
      name: content.slice(0, 255),
      preview: content,
      latestMessageAt: new Date().toISOString(),
      mode: chatMode.value,
    });
  }

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
        if (String(currentSessionId.value) === String(requestSessionId)
            && messages.value[assistantIndex]) {
          messages.value[assistantIndex].content += payload.content || '';
        }
      }

      if (eventName === 'risk') {
        if (String(currentSessionId.value) === String(requestSessionId)
            && messages.value[assistantIndex]) {
          messages.value[assistantIndex].content = payload.message || '';
        }
        notify('检测到危机风险，请优先联系专业援助');
      }

      if (eventName === 'error') {
        if (String(currentSessionId.value) === String(requestSessionId)
            && messages.value[assistantIndex]
            && !messages.value[assistantIndex].content) {
          messages.value[assistantIndex].content = payload.message || 'AI 服务暂时不可用';
        }
        notify(payload.message || 'AI 服务暂时不可用');
      }
    });
  } catch (requestError) {
    if (String(currentSessionId.value) === String(requestSessionId)
        && messages.value[assistantIndex]
        && !messages.value[assistantIndex].content) {
      messages.value[assistantIndex].content = requestError.message;
    }
    notify(requestError.message);
  } finally {
    const nextPending = new Set(pendingSessions.value);
    nextPending.delete(requestSessionId);
    pendingSessions.value = nextPending;
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
  document.addEventListener('click', closeProfileMenu);
  loadData();
});

onBeforeUnmount(() => {
  window.removeEventListener('mh-auth-expired', handleAuthExpired);
  document.removeEventListener('click', closeProfileMenu);
});
</script>

<template>
  <LoginView
    v-if="!authChecking && !authenticated"
    @success="handleLoginSuccess"
  />
  <div v-else-if="!authChecking" class="shell">
    <AppSidebar
      :active="active"
      :admin-section="adminSection"
      :open="mobileOpen"
      :is-admin="profile?.role === 'ADMIN'"
      @select="selectModule"
      @select-admin="selectAdminSection"
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
        <div v-if="profile" class="profile-menu-wrap">
          <button
            class="header-user profile-trigger"
            type="button"
            :aria-expanded="profileMenuOpen"
            aria-haspopup="menu"
            @click="toggleProfileMenu"
          >
            <span class="avatar">{{ profile.nickname?.slice(0, 1) }}</span>
            <span>{{ profile.nickname }}</span>
            <UserRound :size="16" />
          </button>
          <div v-if="profileMenuOpen" class="profile-menu" role="menu">
            <button type="button" role="menuitem" @click="selectProfileMenu('profile')">
              <UserRound :size="16" />个人中心
            </button>
            <button type="button" role="menuitem" @click="selectProfileMenu('settings')">
              <Settings :size="16" />设置
            </button>
          </div>
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
        :pending="pendingSessions.has(currentSessionId)"
        :current-session-id="currentSessionId"
        :mode="chatMode"
        :disclaimer-visible="disclaimerVisible"
        @create="createSession"
        @open="openSession"
        @delete="deleteSession"
        @rename="renameSession"
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
      <AdminView
        v-else-if="active === 'admin' && profile?.role === 'ADMIN'"
        :section="adminSection"
      />
      <section v-else-if="active === 'settings'" class="content settings-placeholder">
        <Settings :size="28" />
        <h2>设置</h2>
        <p>设置功能暂未开放。</p>
      </section>
      <ProfileView
        v-else
        :profile="profile"
        @save-profile="saveProfile"
        @change-password="changePassword"
      />
    </main>

    <DisclaimerModal
      :visible="disclaimerVisible"
      @close="acknowledgeDisclaimer"
    />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
  <div v-else class="loading-state">正在验证登录状态...</div>
</template>
