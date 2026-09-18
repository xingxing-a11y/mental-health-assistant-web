<script setup>
import { reactive, ref, watch } from 'vue';
import {
  Archive,
  ArrowLeft,
  Bell,
  CircleHelp,
  Info,
  LifeBuoy,
  MessageSquarePlus,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Type,
  UserRound,
} from 'lucide-vue-next';

const props = defineProps({
  archivedSessions: { type: Array, required: true },
  archivedVisible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  settings: { type: Object, default: null },
  policy: { type: Object, default: null },
  saving: { type: Boolean, default: false },
  message: { type: String, default: '' },
  messageError: { type: Boolean, default: false },
});

const emit = defineEmits([
  'open-archived',
  'back',
  'unarchive',
  'delete',
  'save-settings',
  'submit-feedback',
  'deactivate',
]);

const SETTINGS_SECTIONS = [
  { key: 'account', label: '账号', icon: UserRound },
  { key: 'preference', label: '偏好设置', icon: Palette },
  { key: 'privacy', label: '隐私设置', icon: ShieldCheck },
  { key: 'general', label: '通用设置', icon: Type },
  { key: 'crisis', label: '危机干预', icon: LifeBuoy },
];

const CHAT_MODES = [
  { value: 'COMPANION', label: '温柔陪伴' },
  { value: 'ANALYTICAL', label: '理性分析' },
];

const STREAM_SPEEDS = [
  { value: 'SLOW', label: '慢速（逐字浮现）' },
  { value: 'NORMAL', label: '标准' },
  { value: 'FAST', label: '快速（立即显示）' },
];

const RETENTION_OPTIONS = [
  { value: 'PERMANENT', label: '永久保存对话' },
  { value: 'THIRTY_DAYS', label: '30 天后自动清理历史会话' },
];

const THEME_OPTIONS = [
  { value: 'LIGHT', label: '浅色模式' },
  { value: 'DARK', label: '深色模式' },
];

const FONT_SCALES = [
  { value: 'SMALL', label: '小' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LARGE', label: '大' },
];

const FEEDBACK_TYPES = [
  { value: 'BUG', label: '问题反馈' },
  { value: 'SUGGESTION', label: '功能建议' },
  { value: 'OTHER', label: '其他' },
];

const activeSection = ref('account');
const policyVisible = ref(false);
const cacheCleared = ref(false);
const feedbackForm = reactive({ type: 'BUG', content: '', contact: '' });

const form = reactive({
  defaultChatMode: 'COMPANION',
  streamSpeed: 'NORMAL',
  messageRetention: 'PERMANENT',
  dataConsent: false,
  theme: 'LIGHT',
  fontScale: 'MEDIUM',
  messageSound: true,
  crisisTip: true,
});

watch(
  () => props.settings,
  (settings) => {
    if (!settings) {
      return;
    }

    form.defaultChatMode = settings.defaultChatMode || 'COMPANION';
    form.streamSpeed = settings.streamSpeed || 'NORMAL';
    form.messageRetention = settings.messageRetention || 'PERMANENT';
    form.dataConsent = Boolean(settings.dataConsent);
    form.theme = settings.theme || 'LIGHT';
    form.fontScale = settings.fontScale || 'MEDIUM';
    form.messageSound = settings.messageSound !== false;
    form.crisisTip = settings.crisisTip !== false;
  },
  { immediate: true },
);

function saveSettings() {
  emit('save-settings', { ...form });
}

/** 本地缓存清理只处理前端写入的 mh- 前缀键，不影响后端数据。 */
function clearLocalCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('mh-'))
    .forEach((key) => localStorage.removeItem(key));
  cacheCleared.value = true;
}

function submitFeedback() {
  if (!feedbackForm.content.trim()) {
    return;
  }

  emit('submit-feedback', {
    type: feedbackForm.type,
    content: feedbackForm.content.trim(),
    contact: feedbackForm.contact.trim() || null,
  });
  feedbackForm.content = '';
  feedbackForm.contact = '';
}
</script>

<template>
  <section class="content settings-page">
    <div class="settings-fixed">
      <div v-if="!archivedVisible" class="settings-tabs">
        <button
          v-for="item in SETTINGS_SECTIONS"
          :key="item.key"
          type="button"
          :class="{ active: activeSection === item.key }"
          @click="activeSection = item.key"
        >
          <component :is="item.icon" :size="16" />
          {{ item.label }}
        </button>
      </div>

      <div
        v-if="!archivedVisible && activeSection !== 'account'"
        class="settings-save-bar"
      >
        <span v-if="message" class="settings-save-hint" :class="{ error: messageError }">
          {{ message }}
        </span>
        <button class="primary-button" type="button" :disabled="saving" @click="saveSettings">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </div>

    <div class="settings-scroll">
      <div v-if="!archivedVisible && activeSection === 'account'" class="settings-panel">
        <button class="settings-option" type="button" @click="emit('open-archived')">
          <span class="settings-option-icon"><Archive :size="19" /></span>
          <span class="settings-option-copy">
            <strong>归档会话</strong>
            <small>查看、恢复或永久删除已归档的会话</small>
          </span>
          <span class="settings-option-count">{{ archivedSessions.length }}</span>
        </button>

        <div class="settings-option settings-option-static">
          <span class="settings-option-icon"><Trash2 :size="19" /></span>
          <span class="settings-option-copy">
            <strong>注销账号</strong>
            <small>
              注销后账号不可恢复，昵称、头像等个人信息会被清除；
              聊天、日记与测评数据将匿名化保留，不再与你的身份关联。
            </small>
          </span>
          <button class="danger-button" type="button" @click="emit('deactivate')">申请注销</button>
        </div>
      </div>

      <div v-else-if="!archivedVisible && activeSection === 'preference'" class="settings-panel">
        <label class="settings-field">
          <span>AI 对话角色默认模式</span>
          <small>新建会话时默认使用的陪伴风格，会话内仍可随时切换。</small>
          <select v-model="form.defaultChatMode">
            <option v-for="option in CHAT_MODES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="settings-field">
          <span>流式输出打字速度</span>
          <small>调整 AI 回复逐字显示的快慢。</small>
          <select v-model="form.streamSpeed">
            <option v-for="option in STREAM_SPEEDS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="settings-field">
          <span>消息保存策略</span>
          <small>选择 30 天清理时，历史会话会由后台定时任务按批次回收。</small>
          <select v-model="form.messageRetention">
            <option v-for="option in RETENTION_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-else-if="!archivedVisible && activeSection === 'privacy'" class="settings-panel">
        <label class="settings-switch">
          <span>
            <strong>匿名数据授权</strong>
            <small>允许匿名使用对话数据优化知识库，默认关闭，不包含可识别身份的信息。</small>
          </span>
          <input v-model="form.dataConsent" type="checkbox" />
        </label>

        <button class="settings-option" type="button" @click="policyVisible = !policyVisible">
          <span class="settings-option-icon"><ShieldCheck :size="19" /></span>
          <span class="settings-option-copy">
            <strong>数据隐私协议查看</strong>
            <small>查看隐私协议、数据用途说明与免责声明</small>
          </span>
          <span class="settings-option-count">{{ policyVisible ? '收起' : '展开' }}</span>
        </button>

        <div v-if="policyVisible" class="policy-panel">
          <h4>隐私协议</h4>
          <p>{{ policy?.privacyPolicy || '暂未配置隐私协议内容。' }}</p>
          <h4>数据用途说明</h4>
          <p>{{ policy?.dataUsage || '暂未配置数据用途说明。' }}</p>
          <h4>隐私说明</h4>
          <p>对话与日记仅用于提供陪伴服务和你的自我觉察，不会对外泄露或用于商业用途。</p>
          <h4>免责声明</h4>
          <p>{{ policy?.disclaimer || '本服务不构成医学诊断或治疗建议。' }}</p>
        </div>

        <button class="settings-option" type="button" @click="clearLocalCache">
          <span class="settings-option-icon"><RotateCcw :size="19" /></span>
          <span class="settings-option-copy">
            <strong>本地缓存清理</strong>
            <small>清除浏览器中保存的公告已读状态等前端缓存，不影响账号数据。</small>
          </span>
          <span class="settings-option-count">{{ cacheCleared ? '已清理' : '清理' }}</span>
        </button>
      </div>

      <div v-else-if="!archivedVisible && activeSection === 'general'" class="settings-panel">
        <label class="settings-field">
          <span>主题切换</span>
          <small>深色模式适合夜间使用。</small>
          <select v-model="form.theme" @change="saveSettings">
            <option v-for="option in THEME_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="settings-field">
          <span>字体大小</span>
          <small>调整页面文字大小，保存后立即生效。</small>
          <select v-model="form.fontScale" @change="saveSettings">
            <option v-for="option in FONT_SCALES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="settings-switch">
          <span>
            <strong>消息提示音</strong>
            <small>AI 回复完成时播放一声轻提示音。</small>
          </span>
          <input v-model="form.messageSound" type="checkbox" />
        </label>

        <form class="settings-feedback" @submit.prevent="submitFeedback">
          <h3><MessageSquarePlus :size="17" />帮助与反馈</h3>
          <label>
            <span>反馈类型</span>
            <select v-model="feedbackForm.type">
              <option v-for="option in FEEDBACK_TYPES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label>
            <span>反馈内容（最多 2000 字）</span>
            <textarea
              v-model="feedbackForm.content"
              maxlength="2000"
              rows="4"
              placeholder="描述遇到的问题或希望新增的功能..."
            />
          </label>
          <label>
            <span>联系方式（可选）</span>
            <input v-model="feedbackForm.contact" maxlength="200" placeholder="邮箱或其他联系方式" />
          </label>
          <button class="primary-button" type="submit" :disabled="!feedbackForm.content.trim()">
            提交反馈
          </button>
        </form>

        <div class="settings-about">
          <h3><Info :size="17" />关于我们</h3>
          <p>MindHarbor 心理健康助手 · 版本 {{ policy?.version || '未知' }}</p>
          <p>{{ policy?.disclaimer || '本服务仅提供心理陪伴与科普，不进行医学诊断。' }}</p>
          <h4><CircleHelp :size="15" />心理援助热线</h4>
          <ul>
            <li v-for="hotline in (policy?.hotlines || [])" :key="hotline">{{ hotline }}</li>
          </ul>
        </div>
      </div>

      <div v-else-if="!archivedVisible && activeSection === 'crisis'" class="settings-panel">
        <label class="settings-switch">
          <span>
            <strong>危机干预提示开关</strong>
            <small>开启后，每次进入对话页面都会展示心理求助热线。</small>
          </span>
          <input v-model="form.crisisTip" type="checkbox" />
        </label>

        <div class="settings-about">
          <h3><Bell :size="17" />需要帮助时</h3>
          <p>如果出现强烈的自伤念头，请优先联系专业援助，或让身边的人陪你去最近的医院急诊。</p>
          <ul>
            <li v-for="hotline in (policy?.hotlines || [])" :key="hotline">{{ hotline }}</li>
          </ul>
        </div>
      </div>

      <div v-if="archivedVisible" class="archived-sessions-panel">
        <div class="archived-sessions-head">
          <div>
            <button class="text-button settings-back" type="button" @click="emit('back')">
              <ArrowLeft :size="16" />返回设置
            </button>
            <h3>归档会话</h3>
            <p>归档会话不会出现在“我的会话”中，恢复后即可继续使用。</p>
          </div>
          <span>{{ archivedSessions.length }} 个会话</span>
        </div>
        <div v-if="loading" class="empty-state">正在加载归档会话...</div>
        <div v-else-if="!archivedSessions.length" class="empty-state">暂无归档会话。</div>
        <div v-else class="archived-session-list">
          <article v-for="session in archivedSessions" :key="session.id" class="archived-session-item">
            <div>
              <strong>{{ session.name }}</strong>
              <p>{{ session.preview || '暂无会话摘要' }}</p>
            </div>
            <div class="archived-session-actions">
              <button class="text-button" type="button" @click="emit('unarchive', session)">
                <RotateCcw :size="15" />取消归档
              </button>
              <button class="text-button danger-button" type="button" @click="emit('delete', session)">
                <Trash2 :size="15" />永久删除
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
