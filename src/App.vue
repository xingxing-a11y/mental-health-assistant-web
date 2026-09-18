<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Bell, Menu, Settings, UserRound, X } from 'lucide-vue-next';
import AppSidebar from './components/AppSidebar.vue';
import ArticleView from './components/ArticleView.vue';
import AssessmentView from './components/AssessmentView.vue';
import ChatView from './components/ChatView.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import DisclaimerModal from './components/DisclaimerModal.vue';
import ExtrasView from './components/ExtrasView.vue';
import GentleReminder from './components/GentleReminder.vue';
import ProfileView from './components/ProfileView.vue';
import RelaxView from './components/RelaxView.vue';
import SettingsView from './components/SettingsView.vue';
import LoginView from './components/LoginView.vue';
import AdminView from './components/AdminView.vue';
import DiaryView from './components/DiaryView.vue';
import {
  announcementApi,
  articleApi,
  assessmentApi,
  chatApi,
  diaryApi,
  feedbackApi,
  notificationApi,
  settingsApi,
  streamChat,
  systemApi,
  userApi,
} from './api/modules';
import { formatDateTime } from './utils/dateTime';

const active = ref('chat');
const adminSection = ref(null);
const mobileOpen = ref(false);
const profileMenuOpen = ref(false);
const announcementModalOpen = ref(false);
const selectedAnnouncement = ref(null);
const announcementReadIds = ref(new Set());
let announcementPollingId;
const disclaimerVisible = ref(false);
const sessions = ref([]);
const archivedSessions = ref([]);
const archivedSessionsVisible = ref(false);
const archivedSessionsLoading = ref(false);
const messages = ref([]);
const favorites = ref([]);
const pendingSessions = ref(new Set());
const scales = ref([]);
const assessmentHistory = ref([]);
const diaries = ref([]);
const diarySearchResults = ref([]);
const emotionTrend = ref([]);
const allDiaries = ref([]);
const allDiariesVisible = ref(false);
const allDiariesLoading = ref(false);
const allDiariesPage = ref(0);
const allDiariesTotalPages = ref(0);
const allDiariesTotal = ref(0);
const ALL_DIARIES_PAGE_SIZE = 10;
const announcements = ref([]);
const articles = ref([]);
const profile = ref(null);
const avatarUploading = ref(false);
const selectedScale = ref(null);
const report = ref(null);
const selectedArticle = ref(null);
const currentSessionId = ref(null);
const chatMode = ref('COMPANION');
const assessmentAnalysisLoading = ref(false);
const diaryAnalysis = ref('');
const diaryAnalysisLoading = ref(false);
const loading = ref(false);
const error = ref('');
const toast = ref('');
const pendingConfirm = ref(null);
const confirmBusy = ref(false);
const authenticated = ref(true);
const authChecking = ref(true);
const ANNOUNCEMENT_VISIBLE_DAYS = 10;
const BELL_POLL_INTERVAL = 60000;
const NOTIFICATION_PAGE_SIZE = 10;

const relaxSection = ref('breathe');
const extrasSection = ref('compare');
const userSettings = ref(null);
const systemPolicy = ref(null);
const pendingSensitive = ref(null);
const exporting = ref(false);
const riskTriggered = ref(false);
const notifications = ref([]);
const unreadNotificationCount = ref(0);
const notificationTab = ref('announcement');
const notificationLoading = ref(false);
const notificationPage = ref(0);
const notificationTotalPages = ref(0);
const settingsSaving = ref(false);
const settingsMessage = ref('');
const settingsMessageError = ref(false);

/** 流式输出的节流间隔（毫秒），FAST 为 0 表示直接显示。 */
const STREAM_INTERVAL = {
  SLOW: 120,
  NORMAL: 50,
  FAST: 0,
};

const unreadAnnouncementCount = computed(() => announcements.value
  .filter((announcement) => !announcementReadIds.value.has(String(announcement.id)))
  .length);

const bellUnreadCount = computed(() => unreadAnnouncementCount.value + unreadNotificationCount.value);

/** 危机干预提示：用户开关打开，或本次对话触发过高危提示时展示。 */
const showCrisisTip = computed(() => riskTriggered.value || Boolean(userSettings.value?.crisisTip));

const hotlines = computed(() => systemPolicy.value?.hotlines || []);

function handleAuthExpired() {
  authenticated.value = false;
  authChecking.value = false;
  profile.value = null;
  sessions.value = [];
  messages.value = [];
  announcementModalOpen.value = false;
}

const titles = {
  chat: '对话陪伴',
  assessment: '心理测评',
  articles: '心理科普',
  diary: '情绪日记',
  relax: '放松小工具',
  extras: '拓展功能',
  profile: '个人中心',
  settings: '设置',
  admin: '管理后台',
};

function notify(message, duration = 1800) {
  toast.value = message;
  window.setTimeout(() => {
    toast.value = '';
  }, duration);
}

/** 打开二次确认弹窗，用户确认后再执行不可恢复的操作。 */
function askConfirm(options) {
  pendingConfirm.value = {
    title: options.title,
    message: options.message,
    confirmText: options.confirmText || '确认',
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

  const { action } = pendingConfirm.value;
  confirmBusy.value = true;
  try {
    await action();
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    confirmBusy.value = false;
    pendingConfirm.value = null;
  }
}

function isRecentAnnouncement(announcement) {
  if (!announcement?.createdAt) {
    return false;
  }

  const createdAt = new Date(announcement.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const visibleSince = Date.now() - ANNOUNCEMENT_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
  return createdAt.getTime() >= visibleSince;
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
  announcementModalOpen.value = false;
  if (module !== 'settings') {
    archivedSessionsVisible.value = false;
  }
}

function selectAdminSection(section) {
  active.value = 'admin';
  adminSection.value = section;
  mobileOpen.value = false;
  profileMenuOpen.value = false;
  announcementModalOpen.value = false;
}

function selectRelaxSection(section) {
  active.value = 'relax';
  relaxSection.value = section;
  mobileOpen.value = false;
  profileMenuOpen.value = false;
  announcementModalOpen.value = false;
}

function selectExtrasSection(section) {
  active.value = 'extras';
  extrasSection.value = section;
  mobileOpen.value = false;
  profileMenuOpen.value = false;
  announcementModalOpen.value = false;
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value;
  announcementModalOpen.value = false;
}

function announcementReadStorageKey() {
  return `mh-read-announcements-${profile.value?.id || 'anonymous'}`;
}

function loadReadAnnouncementIds() {
  try {
    const storedIds = JSON.parse(localStorage.getItem(announcementReadStorageKey()) || '[]');
    announcementReadIds.value = new Set(Array.isArray(storedIds) ? storedIds.map(String) : []);
  } catch {
    announcementReadIds.value = new Set();
  }
}

function persistReadAnnouncementIds() {
  localStorage.setItem(
    announcementReadStorageKey(),
    JSON.stringify([...announcementReadIds.value]),
  );
}

function markAnnouncementsRead() {
  const nextReadIds = new Set(announcementReadIds.value);
  announcements.value.forEach((announcement) => nextReadIds.add(String(announcement.id)));
  announcementReadIds.value = nextReadIds;
  persistReadAnnouncementIds();
}

function markAnnouncementRead(announcement) {
  const nextReadIds = new Set(announcementReadIds.value);
  nextReadIds.add(String(announcement.id));
  announcementReadIds.value = nextReadIds;
  persistReadAnnouncementIds();
}

function toggleAnnouncementModal() {
  announcementModalOpen.value = !announcementModalOpen.value;
  profileMenuOpen.value = false;

  if (announcementModalOpen.value) {
    notificationTab.value = 'announcement';
    refreshAnnouncements();
    refreshUnreadNotificationCount();
  }
}

function closeAnnouncementModal() {
  announcementModalOpen.value = false;
  selectedAnnouncement.value = null;
}

function openAnnouncementDetail(announcement) {
  markAnnouncementRead(announcement);
  selectedAnnouncement.value = announcement;
}

function closeAnnouncementDetail() {
  selectedAnnouncement.value = null;
}

function handleAnnouncementCardKeydown(event, announcement) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openAnnouncementDetail(announcement);
  }
}

function selectProfileMenu(module) {
  active.value = module;
  profileMenuOpen.value = false;
  if (module === 'settings') {
    archivedSessionsVisible.value = false;
  }
}

function closeProfileMenu(event) {
  if (!event.target.closest('.profile-menu-wrap')) {
    profileMenuOpen.value = false;
  }
}

function handleAnnouncementKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (selectedAnnouncement.value) {
    closeAnnouncementDetail();
  } else if (announcementModalOpen.value) {
    closeAnnouncementModal();
  }
}

async function refreshAnnouncements() {
  if (!authenticated.value || !profile.value) {
    return;
  }

  try {
    const announcementData = await announcementApi.list();
    announcements.value = (announcementData || []).filter(isRecentAnnouncement);
  } catch {
    // 后台轮询失败不打断用户当前页面，下一次轮询会继续尝试。
  }
}

async function loadData() {
  if (!authenticated.value) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const [
      sessionData,
      scaleData,
      articleData,
      userData,
      historyData,
      diaryData,
      trendData,
      announcementData,
      favoriteData,
      settingsData,
      policyData,
      unreadData,
    ] = await Promise.all([
      chatApi.list(),
      assessmentApi.scales(),
      articleApi.list(),
      userApi.current(),
      assessmentApi.history(),
      diaryApi.list(),
      diaryApi.trend('', ''),
      announcementApi.list(),
      chatApi.favorites({ size: 50 }),
      settingsApi.get(),
      systemApi.policy(),
      notificationApi.unreadCount(),
    ]);

    sessions.value = sessionData || [];
    scales.value = scaleData || [];
    articles.value = articleData || [];
    profile.value = userData || null;
    assessmentHistory.value = historyData || [];
    diaries.value = diaryData || [];
    emotionTrend.value = trendData || [];
    announcements.value = (announcementData || []).filter(isRecentAnnouncement);
    loadReadAnnouncementIds();
    favorites.value = favoriteData?.items || [];
    userSettings.value = settingsData || null;
    systemPolicy.value = policyData || null;
    unreadNotificationCount.value = unreadData?.count ?? 0;
    disclaimerVisible.value = true;
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
    authChecking.value = false;
  }
}

async function createDiary(data) {
  diaries.value = await diaryApi.list();
  emotionTrend.value = await diaryApi.trend('', '');
  notify('日记已保存');
}

async function deleteDiary(diary) {
  await diaryApi.remove(diary.id);
  diaries.value = diaries.value.filter((item) => item.id !== diary.id);
  diarySearchResults.value = diarySearchResults.value.filter((item) => item.id !== diary.id);
  allDiaries.value = allDiaries.value.filter((item) => item.id !== diary.id);
  allDiariesTotal.value = Math.max(allDiariesTotal.value - 1, 0);
  emotionTrend.value = await diaryApi.trend('', '');
  notify('日记已删除');
}

async function updateDiary(diary, data) {
  try {
    const updated = await diaryApi.update(diary.id, data);
    const index = diaries.value.findIndex((item) => item.id === diary.id);
    if (index >= 0) {
      diaries.value[index] = updated;
    }
    diarySearchResults.value = diarySearchResults.value.map((item) => (
      item.id === diary.id ? updated : item
    ));
    allDiaries.value = allDiaries.value.map((item) => (
      item.id === diary.id ? updated : item
    ));
    notify('日记已更新');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function loadAllDiaries(page = 0) {
  allDiariesLoading.value = true;
  try {
    const result = await diaryApi.all(page, ALL_DIARIES_PAGE_SIZE);
    allDiaries.value = result.items || [];
    allDiariesPage.value = result.page || 0;
    allDiariesTotalPages.value = result.totalPages || 0;
    allDiariesTotal.value = result.total || 0;
  } catch (requestError) {
    notify(requestError.message, 3000);
  } finally {
    allDiariesLoading.value = false;
  }
}

function openAllDiaries() {
  allDiariesVisible.value = true;
  loadAllDiaries(0);
}

function closeAllDiaries() {
  allDiariesVisible.value = false;
}

function changeAllDiariesPage(page) {
  loadAllDiaries(page);
}

async function refreshTrend(startDate, endDate) {
  try {
    emotionTrend.value = await diaryApi.trend(startDate, endDate);
    const result = await diaryApi.all(0, 50, startDate, endDate);
    diarySearchResults.value = result.items || [];
  } catch (requestError) {
    notify(requestError.message, 3000);
  }
}

async function analyzeDiary(diary) {
  if (diaryAnalysisLoading.value) {
    return;
  }

  diaryAnalysisLoading.value = true;
  error.value = '';
  try {
    const result = await diaryApi.analyze(diary.id);
    diaryAnalysis.value = result.analysis || '暂时没有生成分析内容，请稍后再试。';
  } catch (requestError) {
    error.value = requestError.message || 'AI 分析暂时不可用';
  } finally {
    diaryAnalysisLoading.value = false;
  }
}

function closeDiaryAnalysis() {
  diaryAnalysis.value = '';
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

async function archiveSession(session) {
  await chatApi.archive(session.id);
  sessions.value = sessions.value.filter((item) => item.id !== session.id);

  if (currentSessionId.value === session.id) {
    currentSessionId.value = null;
    messages.value = [];
  }
}

async function openArchivedSessions() {
  archivedSessionsLoading.value = true;
  error.value = '';
  try {
    archivedSessions.value = await chatApi.archived();
    archivedSessionsVisible.value = true;
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    archivedSessionsLoading.value = false;
  }
}

async function unarchiveSession(session) {
  try {
    const restored = await chatApi.unarchive(session.id);
    archivedSessions.value = archivedSessions.value.filter((item) => item.id !== session.id);
    sessions.value = [restored, ...sessions.value];
    notify('会话已取消归档');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

/** 会话删除不可恢复，统一走 ConfirmDialog 二次确认。 */
function deleteArchivedSession(session) {
  askConfirm({
    title: '删除会话',
    message: `删除“${session.name || '未命名会话'}”后将无法恢复，确定继续吗？`,
    confirmText: '永久删除',
    action: async () => {
      await chatApi.remove(session.id);
      archivedSessions.value = archivedSessions.value.filter((item) => item.id !== session.id);
      notify('会话已永久删除');
    },
  });
}

async function renameSession(session, name) {
  const updated = await chatApi.rename(session.id, name);
  const index = sessions.value.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    sessions.value[index] = updated;
  }
}

async function togglePinSession(session) {
  const updated = await chatApi.togglePin(session.id);
  sessions.value = sessions.value
    .map((item) => (item.id === session.id ? updated : item))
    .sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return Number(right.pinned) - Number(left.pinned);
      }
      return new Date(right.latestMessageAt) - new Date(left.latestMessageAt);
    });
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
  try {
    const nextFavorite = !message.favorite;
    await chatApi.favoriteMessage(message.id, nextFavorite);
    const currentMessage = messages.value.find((item) => item.id === message.id);
    if (currentMessage) {
      currentMessage.favorite = nextFavorite;
    }
    await loadFavorites();
  } catch (requestError) {
    error.value = requestError.message;
  }
}

/** 收藏列表统一走分页信封，会话内展示时按当前会话过滤。 */
async function loadFavorites() {
  try {
    const sessionId = String(currentSessionId.value || '').startsWith('draft-')
      ? undefined
      : currentSessionId.value;
    const result = await chatApi.favorites({ size: 50, sessionId });
    favorites.value = result.items || [];
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function searchArticles(keyword) {
  try {
    articles.value = await articleApi.list(keyword);
  } catch (requestError) {
    error.value = requestError.message;
  }
}

/** 发送前预校验：命中敏感内容时先温和提示，用户确认后再真正发送。 */
async function sendMessage(content, skipCheck = false) {
  if (!content || !currentSessionId.value) {
    return;
  }

  if (skipCheck) {
    await deliverMessage(content);
    return;
  }

  try {
    const result = await chatApi.sensitiveCheck(content);
    if (result?.triggered) {
      pendingSensitive.value = {
        content,
        prompt: result.prompt,
        level: result.level,
        hotline: result.hotline,
      };
      return;
    }
  } catch {
    // 预校验失败不阻断发送，服务端仍会执行强制校验。
  }

  await deliverMessage(content);
}

function cancelSensitiveSend() {
  pendingSensitive.value = null;
}

async function continueSensitiveSend() {
  const pending = pendingSensitive.value;
  pendingSensitive.value = null;
  if (pending) {
    await sendMessage(pending.content, true);
  }
}

async function deliverMessage(content) {
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

  const streamWriter = createStreamWriter(messages.value[assistantIndex]);

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
          streamWriter.push(payload.content || '');
        }
      }

      if (eventName === 'risk') {
        streamWriter.finish();
        if (String(currentSessionId.value) === String(requestSessionId)
            && messages.value[assistantIndex]) {
          const hotlineText = payload.hotline ? `\n心理援助热线：${payload.hotline}` : '';
          messages.value[assistantIndex].content = `${payload.message || ''}${hotlineText}`;
        }
        riskTriggered.value = true;
        notify('检测到危机风险，请优先联系专业援助');
      }

      if (eventName === 'error') {
        streamWriter.finish();
        if (String(currentSessionId.value) === String(requestSessionId)
            && messages.value[assistantIndex]
            && !messages.value[assistantIndex].content) {
          messages.value[assistantIndex].content = payload.message || 'AI 服务暂时不可用';
        }
        notify(payload.message || 'AI 服务暂时不可用');
      }
    });
  } catch (requestError) {
    streamWriter.finish();
    if (String(currentSessionId.value) === String(requestSessionId)
        && messages.value[assistantIndex]
        && !messages.value[assistantIndex].content) {
      messages.value[assistantIndex].content = requestError.message;
    }
    notify(requestError.message);
  } finally {
    streamWriter.finish();
    playMessageSound();
    const nextPending = new Set(pendingSessions.value);
    nextPending.delete(requestSessionId);
    pendingSessions.value = nextPending;
  }
}

async function startAssessment(scale) {
  selectedScale.value = await assessmentApi.detail(scale.id);
  const answers = {};
  selectedScale.value.questions.forEach((question) => {
    answers[question.id] = question.type === 'MULTIPLE' ? [] : question.type === 'MATRIX' ? {} : '';
  });
  report.value = { answers, otherAnswers: {} };
  assessmentAnalysisLoading.value = false;
}

async function submitAssessment() {
  const answers = selectedScale.value.questions.map((question) => {
    const value = report.value.answers[question.id];
    if (question.type === 'TEXT') {
      return { questionId: question.id, textAnswer: value };
    }
    if (question.type === 'MULTIPLE') {
      return {
        questionId: question.id,
        optionIds: value,
        otherAnswer: report.value.otherAnswers?.[question.id] || null,
      };
    }
    if (question.type === 'MATRIX') {
      return { questionId: question.id, matrixAnswers: value };
    }
    return {
      questionId: question.id,
      optionId: Number(value),
      otherAnswer: report.value.otherAnswers?.[question.id] || null,
    };
  });

  report.value = await assessmentApi.submit({
    scaleId: selectedScale.value.id,
    answers,
  });
  assessmentHistory.value = await assessmentApi.history();
  notify('测评报告已生成');
}

async function analyzeAssessment() {
  if (!report.value?.resultId || assessmentAnalysisLoading.value) {
    return;
  }

  assessmentAnalysisLoading.value = true;
  error.value = '';
  try {
    const result = await assessmentApi.analyze(report.value.resultId);
    report.value = {
      ...report.value,
      aiAnalysis: result.analysis,
    };
  } catch (requestError) {
    error.value = requestError.message || 'AI 分析暂时不可用';
  } finally {
    assessmentAnalysisLoading.value = false;
  }
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

async function uploadAvatar(file) {
  avatarUploading.value = true;
  try {
    profile.value = await userApi.uploadAvatar(file);
    notify('头像已更新');
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    avatarUploading.value = false;
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

/** 主题与字号只作用在根元素上，取值来自后端保存的个人设置。 */
function applyAppearance(settings) {
  const root = document.documentElement;
  root.classList.toggle('mh-theme-dark', settings?.theme === 'DARK');
  root.classList.remove('mh-font-small', 'mh-font-medium', 'mh-font-large');
  root.classList.add(`mh-font-${(settings?.fontScale || 'MEDIUM').toLowerCase()}`);
}

/** 消息提示音由 Web Audio 现场合成，不引入任何音频素材。 */
function playMessageSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!userSettings.value?.messageSound || !AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.06, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.addEventListener('ended', () => context.close());
}

/**
 * 按“流式输出打字速度”把 SSE 片段逐步写入气泡。
 * FAST 直接写入；其它档位先缓存，再按固定间隔成块刷出。
 */
function createStreamWriter(message) {
  const interval = STREAM_INTERVAL[userSettings.value?.streamSpeed];
  if (!interval) {
    return {
      push: (chunk) => {
        message.content += chunk;
      },
      finish: () => {},
    };
  }

  let buffer = '';
  const timerId = window.setInterval(() => {
    if (!buffer) {
      return;
    }
    message.content += buffer.slice(0, 6);
    buffer = buffer.slice(6);
  }, interval);

  return {
    push: (chunk) => {
      buffer += chunk;
    },
    finish: () => {
      window.clearInterval(timerId);
      message.content += buffer;
      buffer = '';
    },
  };
}

async function refreshUnreadNotificationCount() {
  if (!authenticated.value || !profile.value) {
    return;
  }

  try {
    const result = await notificationApi.unreadCount();
    unreadNotificationCount.value = result?.count ?? 0;
  } catch {
    // 低频轮询失败不打断当前页面，下一次轮询会继续尝试。
  }
}

async function loadNotifications(page = 0) {
  notificationLoading.value = true;
  try {
    const result = await notificationApi.list(page, NOTIFICATION_PAGE_SIZE);
    notifications.value = result.items || [];
    notificationPage.value = result.page || 0;
    notificationTotalPages.value = result.totalPages || 0;
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    notificationLoading.value = false;
  }
}

/** 铃铛是公告与个人通知的统一入口，展开时才拉取对应列表。 */
function switchNotificationTab(tab) {
  notificationTab.value = tab;
  if (tab === 'notification') {
    loadNotifications(0);
    return;
  }
  refreshAnnouncements();
}

async function markNotificationRead(notification) {
  if (notification.read) {
    return;
  }

  try {
    await notificationApi.markRead(notification.id);
    notification.read = true;
    await refreshUnreadNotificationCount();
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function markAllNotificationsRead() {
  try {
    await notificationApi.markAllRead();
    notifications.value = notifications.value.map((item) => ({ ...item, read: true }));
    unreadNotificationCount.value = 0;
  } catch (requestError) {
    error.value = requestError.message;
  }
}

function changeNotificationPage(page) {
  if (page < 0 || (notificationTotalPages.value && page >= notificationTotalPages.value)) {
    return;
  }
  loadNotifications(page);
}

async function exportSession(session, format) {
  if (exporting.value) {
    return;
  }

  exporting.value = true;
  error.value = '';
  try {
    const filename = await chatApi.exportSession(session.id, format);
    notify(`已导出 ${filename}`, 2600);
  } catch (requestError) {
    notify(requestError.message, 3000);
  } finally {
    exporting.value = false;
  }
}

async function saveSettings(data) {
  if (settingsSaving.value) {
    return;
  }

  settingsSaving.value = true;
  settingsMessage.value = '';
  settingsMessageError.value = false;
  try {
    userSettings.value = await settingsApi.update(data);
    settingsMessage.value = '设置已保存';
    notify('设置已保存');
  } catch (requestError) {
    settingsMessage.value = requestError.message || '保存失败，请稍后重试';
    settingsMessageError.value = true;
    error.value = requestError.message;
  } finally {
    settingsSaving.value = false;
    window.setTimeout(() => {
      settingsMessage.value = '';
      settingsMessageError.value = false;
    }, 3000);
  }
}

async function submitFeedback(data) {
  try {
    await feedbackApi.submit(data);
    notify('反馈已提交，感谢你的建议');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

/** 注销只做匿名化，业务数据保留，因此必须二次确认。 */
function deactivateAccount() {
  askConfirm({
    title: '注销账号',
    message: '注销后账号不可恢复，昵称、头像与手机号会被清除；聊天、日记与测评数据将匿名化保留。确定继续吗？',
    confirmText: '确认注销',
    action: async () => {
      await settingsApi.deactivate();
      notify('账号已注销', 2600);
      window.setTimeout(() => window.location.reload(), 900);
    },
  });
}

async function startScaleFromExtras(scaleId) {
  try {
    await startAssessment({ id: scaleId });
    active.value = 'assessment';
  } catch (requestError) {
    error.value = requestError.message;
  }
}

function refreshBellCounters() {
  refreshAnnouncements();
  refreshUnreadNotificationCount();
}

watch(userSettings, (settings) => applyAppearance(settings));

onMounted(() => {
  window.addEventListener('mh-auth-expired', handleAuthExpired);
  document.addEventListener('click', closeProfileMenu);
  window.addEventListener('keydown', handleAnnouncementKeydown);
  announcementPollingId = window.setInterval(refreshBellCounters, BELL_POLL_INTERVAL);
  loadData();
});

onBeforeUnmount(() => {
  window.removeEventListener('mh-auth-expired', handleAuthExpired);
  document.removeEventListener('click', closeProfileMenu);
  window.removeEventListener('keydown', handleAnnouncementKeydown);
  window.clearInterval(announcementPollingId);
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
      :relax-section="relaxSection"
      :extras-section="extrasSection"
      :open="mobileOpen"
      :is-admin="profile?.role === 'ADMIN'"
      @select="selectModule"
      @select-admin="selectAdminSection"
      @select-relax="selectRelaxSection"
      @select-extras="selectExtrasSection"
      @close="mobileOpen = false"
      @logout="logout"
    />

    <main :class="{ 'settings-layout': active === 'settings' }">
      <header>
        <button class="icon mobile-menu" @click="mobileOpen = true">
          <Menu :size="21" />
        </button>
        <div>
          <span class="eyebrow">SPACE FOR YOUR THOUGHTS</span>
          <h1>{{ titles[active] }}</h1>
        </div>
        <div v-if="profile" class="header-actions">
          <div>
            <button
              class="notification-trigger"
              type="button"
              aria-label="查看消息中心"
              :aria-expanded="announcementModalOpen"
              aria-haspopup="dialog"
              @click="toggleAnnouncementModal"
            >
              <Bell :size="19" />
              <span v-if="bellUnreadCount" class="notification-badge">
                {{ bellUnreadCount > 99 ? '99+' : bellUnreadCount }}
              </span>
            </button>
          </div>
          <div class="profile-menu-wrap">
            <button
              class="header-user profile-trigger"
              type="button"
              :aria-expanded="profileMenuOpen"
              aria-haspopup="menu"
              @click="toggleProfileMenu"
            >
              <img
                v-if="profile.avatarUrl"
                class="avatar profile-avatar-image"
                :src="`/api/v1${profile.avatarUrl}`"
                alt="用户头像"
              />
              <span v-else class="avatar">{{ profile.nickname?.slice(0, 1) || 'U' }}</span>
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
        </div>
      </header>

      <p v-if="loading" class="loading-state">正在加载...</p>
      <p v-if="error" class="error-banner">{{ error }}</p>
      <ChatView
        v-if="active === 'chat'"
        :sessions="sessions"
        :messages="messages"
        :favorites="favorites"
        :pending="pendingSessions.has(currentSessionId)"
        :current-session-id="currentSessionId"
        :mode="chatMode"
        :disclaimer-visible="disclaimerVisible"
        :crisis-tip="showCrisisTip"
        :hotlines="hotlines"
        @create="createSession"
        @open="openSession"
        @archive="archiveSession"
        @rename="renameSession"
        @pin="togglePinSession"
        @clear="clearContext"
        @send="sendMessage"
        @mode="updateChatMode"
        @favorite="toggleFavorite"
        @load-favorites="loadFavorites"
        @export="exportSession"
      />
      <AssessmentView
        v-else-if="active === 'assessment'"
        :scales="scales"
        :selected-scale="selectedScale"
        :report="report"
        :history="assessmentHistory"
        @start="startAssessment"
        @submit="submitAssessment"
        @analyze="analyzeAssessment"
        :analysis-loading="assessmentAnalysisLoading"
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
        :search-results="diarySearchResults"
        :analysis-loading="diaryAnalysisLoading"
        :all-visible="allDiariesVisible"
        :all-diaries="allDiaries"
        :all-loading="allDiariesLoading"
        :all-page="allDiariesPage"
        :all-total-pages="allDiariesTotalPages"
        :all-total="allDiariesTotal"
        @create="createDiary"
        @delete="deleteDiary"
        @update="updateDiary"
        @analyze="analyzeDiary"
        @trend="refreshTrend"
        @open-all="openAllDiaries"
        @close-all="closeAllDiaries"
        @all-page="changeAllDiariesPage"
      />
      <RelaxView
        v-else-if="active === 'relax'"
        :section="relaxSection"
      />
      <ExtrasView
        v-else-if="active === 'extras'"
        :section="extrasSection"
        @start-scale="startScaleFromExtras"
        @notify="notify"
      />
      <AdminView
        v-else-if="active === 'admin' && profile?.role === 'ADMIN'"
        :section="adminSection"
      />
      <SettingsView
        v-else-if="active === 'settings'"
        class="settings-view"
        :archived-sessions="archivedSessions"
        :archived-visible="archivedSessionsVisible"
        :loading="archivedSessionsLoading"
        :settings="userSettings"
        :policy="systemPolicy"
        :saving="settingsSaving"
        :message="settingsMessage"
        :message-error="settingsMessageError"
        @open-archived="openArchivedSessions"
        @back="archivedSessionsVisible = false"
        @unarchive="unarchiveSession"
        @delete="deleteArchivedSession"
        @save-settings="saveSettings"
        @submit-feedback="submitFeedback"
        @deactivate="deactivateAccount"
      />
      <ProfileView
        v-else
        :profile="profile"
        :avatar-uploading="avatarUploading"
        @save-profile="saveProfile"
        @change-password="changePassword"
        @upload-avatar="uploadAvatar"
      />
    </main>

    <DisclaimerModal
      :visible="disclaimerVisible"
      @close="acknowledgeDisclaimer"
    />
    <div
      v-if="announcementModalOpen"
      class="announcement-modal-backdrop"
      role="presentation"
      @click.self="closeAnnouncementModal"
    >
      <section
        class="announcement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
      >
        <div class="announcement-modal-head">
          <div>
            <span class="eyebrow">MESSAGE CENTER</span>
            <h2 id="announcement-modal-title">消息中心</h2>
          </div>
          <button
            class="icon"
            type="button"
            aria-label="关闭消息中心"
            title="关闭"
            @click="closeAnnouncementModal"
          >
            <X :size="19" />
          </button>
        </div>
        <div class="notification-tabs">
          <button
            type="button"
            :class="{ active: notificationTab === 'announcement' }"
            @click="switchNotificationTab('announcement')"
          >
            系统公告
          </button>
          <button
            type="button"
            :class="{ active: notificationTab === 'notification' }"
            @click="switchNotificationTab('notification')"
          >
            我的通知
          </button>
        </div>
        <template v-if="notificationTab === 'announcement'">
          <div v-if="!announcements.length" class="announcement-empty">
            暂无系统公告
          </div>
          <div v-else class="announcement-modal-list">
            <article
              v-for="announcement in announcements"
              :key="announcement.id"
              class="announcement-card"
              role="button"
              tabindex="0"
              @click="openAnnouncementDetail(announcement)"
              @keydown="handleAnnouncementCardKeydown($event, announcement)"
            >
              <div class="announcement-card-marker" aria-hidden="true" />
              <div class="announcement-card-body">
                <div class="announcement-card-meta">
                  <span>系统通知</span>
                  <time>{{ formatDateTime(announcement.createdAt) }}</time>
                </div>
                <h3>{{ announcement.title }}</h3>
                <p class="announcement-card-preview">{{ announcement.content }}</p>
              </div>
            </article>
          </div>
        </template>
        <div v-else class="notification-list-wrap">
          <p v-if="notificationLoading" class="loading-state">正在加载通知...</p>
          <div v-else-if="!notifications.length" class="announcement-empty">
            暂无个人通知
          </div>
          <div v-else class="notification-list">
            <article
              v-for="notification in notifications"
              :key="notification.id"
              class="notification-card"
              :class="{ unread: !notification.read }"
              @click="markNotificationRead(notification)"
            >
              <div class="notification-card-head">
                <strong>{{ notification.title }}</strong>
                <time>{{ formatDateTime(notification.createdAt) }}</time>
              </div>
              <p>{{ notification.content }}</p>
            </article>
          </div>
          <div v-if="notificationTotalPages > 1" class="pagination">
            <button
              class="text-button"
              type="button"
              :disabled="notificationPage <= 0"
              @click="changeNotificationPage(notificationPage - 1)"
            >
              上一页
            </button>
            <span>第 {{ notificationPage + 1 }} / {{ notificationTotalPages }} 页</span>
            <button
              class="text-button"
              type="button"
              :disabled="notificationPage >= notificationTotalPages - 1"
              @click="changeNotificationPage(notificationPage + 1)"
            >
              下一页
            </button>
          </div>
        </div>
        <div class="announcement-modal-foot">
          <span>
            {{ notificationTab === 'announcement' ? '仅显示最近 10 天的公告' : '通知由管理后台推送，过期后自动隐藏' }}
          </span>
          <div class="announcement-modal-foot-actions">
            <button
              v-if="notificationTab === 'announcement'"
              class="secondary"
              type="button"
              @click="markAnnouncementsRead"
            >
              全部标为已读
            </button>
            <button v-else class="secondary" type="button" @click="markAllNotificationsRead">
              全部标为已读
            </button>
            <button class="primary-button" type="button" @click="closeAnnouncementModal">知道了</button>
          </div>
        </div>
      </section>
    </div>
    <div
      v-if="selectedAnnouncement"
      class="announcement-detail-backdrop"
      role="presentation"
      @click.self="closeAnnouncementDetail"
    >
      <section
        class="announcement-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-detail-title"
      >
        <div class="announcement-detail-head">
          <div>
            <span class="eyebrow">SYSTEM NOTICE</span>
            <h2 id="announcement-detail-title">{{ selectedAnnouncement.title }}</h2>
          </div>
          <button
            class="icon"
            type="button"
            aria-label="关闭公告详情"
            title="关闭"
            @click="closeAnnouncementDetail"
          >
            <X :size="19" />
          </button>
        </div>
        <time class="announcement-detail-time">
          {{ formatDateTime(selectedAnnouncement.createdAt) }}
        </time>
        <div class="announcement-detail-content">
          <p>{{ selectedAnnouncement.content }}</p>
        </div>
        <div class="announcement-detail-actions">
          <button class="primary-button" type="button" @click="closeAnnouncementDetail">返回公告列表</button>
        </div>
      </section>
    </div>
    <div
      v-if="diaryAnalysis"
      class="analysis-modal-backdrop"
      role="presentation"
      @click.self="closeDiaryAnalysis"
    >
      <section
        class="analysis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diary-analysis-title"
      >
        <div class="analysis-modal-head">
          <div>
            <span class="eyebrow">PERSONAL INSIGHT</span>
            <h2 id="diary-analysis-title">日记 AI 分析</h2>
          </div>
          <button
            class="icon"
            type="button"
            aria-label="关闭日记 AI 分析"
            title="关闭"
            @click="closeDiaryAnalysis"
          >
            <X :size="19" />
          </button>
        </div>
        <div class="analysis-modal-content">
          <p>{{ diaryAnalysis }}</p>
        </div>
        <div class="analysis-modal-actions">
          <span>内容仅供自我觉察参考，不构成医学诊断。</span>
          <button class="primary-button" type="button" @click="closeDiaryAnalysis">知道了</button>
        </div>
      </section>
    </div>
    <GentleReminder
      :visible="Boolean(pendingSensitive)"
      :prompt="pendingSensitive ? pendingSensitive.prompt : ''"
      :level="pendingSensitive ? pendingSensitive.level : 'CARE'"
      :hotline="pendingSensitive ? pendingSensitive.hotline : ''"
      @continue="continueSensitiveSend"
      @cancel="cancelSensitiveSend"
    />
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
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
  <div v-else class="loading-state">正在验证登录状态...</div>
</template>
