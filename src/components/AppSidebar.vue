<script setup>
import {
  BarChart3,
  Bookmark,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileText,
  GitCompare,
  Gauge,
  History,
  Inbox,
  LogOut,
  Megaphone,
  MessageCircle,
  Moon,
  NotebookPen,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wind,
  X,
} from 'lucide-vue-next';
import { ref, watch } from 'vue';

const props = defineProps({
  active: { type: String, required: true },
  adminSection: { type: String, default: 'overview' },
  relaxSection: { type: String, default: 'breathe' },
  extrasSection: { type: String, default: 'compare' },
  open: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
});

const emit = defineEmits([
  'select',
  'select-admin',
  'select-relax',
  'select-extras',
  'close',
  'logout',
]);

const adminExpanded = ref(props.active === 'admin');
const relaxExpanded = ref(props.active === 'relax');
const extrasExpanded = ref(props.active === 'extras');

watch(() => props.active, (value) => {
  if (value !== 'admin') {
    adminExpanded.value = false;
  }
  if (value !== 'relax') {
    relaxExpanded.value = false;
  }
  if (value !== 'extras') {
    extrasExpanded.value = false;
  }
});

function toggleGroup(group) {
  if (group === 'admin') {
    adminExpanded.value = !adminExpanded.value;
    return;
  }
  if (group === 'relax') {
    relaxExpanded.value = !relaxExpanded.value;
    return;
  }
  extrasExpanded.value = !extrasExpanded.value;
}
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <div class="brand-mark">
        <Sparkles :size="18" />
      </div>
      <div>
        <strong>MindHarbor</strong>
        <small>心理健康助手</small>
      </div>
      <button class="icon mobile-close" @click="emit('close')">
        <X :size="18" />
      </button>
    </div>
    <nav>
      <button :class="{ active: active === 'chat' }" @click="emit('select', 'chat')">
        <MessageCircle :size="18" />
        对话陪伴
      </button>
      <button :class="{ active: active === 'assessment' }" @click="emit('select', 'assessment')">
        <ClipboardCheck :size="18" />
        心理测评
      </button>
      <button :class="{ active: active === 'articles' }" @click="emit('select', 'articles')">
        <BookOpen :size="18" />
        心理科普
      </button>
      <button :class="{ active: active === 'diary' }" @click="emit('select', 'diary')">
        <NotebookPen :size="18" />
        情绪日记
      </button>
      <button
        class="sidebar-nav-toggle"
        :class="{ active: active === 'relax' }"
        :aria-expanded="relaxExpanded"
        @click="toggleGroup('relax')"
      >
        <Wind :size="18" />
        <span>放松小工具</span>
        <ChevronDown class="sidebar-nav-caret" :class="{ expanded: relaxExpanded }" :size="15" />
      </button>
      <div v-if="relaxExpanded" class="sidebar-subnav">
        <button
          :class="{ active: active === 'relax' && relaxSection === 'breathe' }"
          @click="emit('select-relax', 'breathe')"
        >
          <Wind :size="16" />
          呼吸放松
        </button>
        <button
          :class="{ active: active === 'relax' && relaxSection === 'meditation' }"
          @click="emit('select-relax', 'meditation')"
        >
          <Moon :size="16" />
          正念冥想
        </button>
        <button
          :class="{ active: active === 'relax' && relaxSection === 'stress' }"
          @click="emit('select-relax', 'stress')"
        >
          <Gauge :size="16" />
          压力打卡
        </button>
      </div>
      <button
        class="sidebar-nav-toggle"
        :class="{ active: active === 'extras' }"
        :aria-expanded="extrasExpanded"
        @click="toggleGroup('extras')"
      >
        <Compass :size="18" />
        <span>拓展功能</span>
        <ChevronDown class="sidebar-nav-caret" :class="{ expanded: extrasExpanded }" :size="15" />
      </button>
      <div v-if="extrasExpanded" class="sidebar-subnav">
        <button
          :class="{ active: active === 'extras' && extrasSection === 'compare' }"
          @click="emit('select-extras', 'compare')"
        >
          <GitCompare :size="16" />
          测评结果对比
        </button>
        <button
          :class="{ active: active === 'extras' && extrasSection === 'favorites' }"
          @click="emit('select-extras', 'favorites')"
        >
          <Star :size="16" />
          测评收藏
        </button>
        <button
          :class="{ active: active === 'extras' && extrasSection === 'recommend' }"
          @click="emit('select-extras', 'recommend')"
        >
          <Compass :size="16" />
          量表推荐
        </button>
        <button
          :class="{ active: active === 'extras' && extrasSection === 'messages' }"
          @click="emit('select-extras', 'messages')"
        >
          <Bookmark :size="16" />
          消息收藏
        </button>
      </div>
      <button
        v-if="isAdmin"
        class="sidebar-nav-toggle"
        :class="{ active: active === 'admin' }"
        :aria-expanded="adminExpanded"
        @click="toggleGroup('admin')"
      >
        <ShieldCheck :size="18" />
        <span>管理后台</span>
        <ChevronDown class="sidebar-nav-caret" :class="{ expanded: adminExpanded }" :size="15" />
      </button>
      <div v-if="isAdmin && adminExpanded" class="sidebar-subnav">
        <button
          :class="{ active: active === 'admin' && adminSection === 'overview' }"
          @click="emit('select-admin', 'overview')"
        >
          <BarChart3 :size="16" />
          数据概览
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'users' }"
          @click="emit('select-admin', 'users')"
        >
          <Users :size="16" />
          用户管理
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'scales' }"
          @click="emit('select-admin', 'scales')"
        >
          <Scale :size="16" />
          测评量表
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'articles' }"
          @click="emit('select-admin', 'articles')"
        >
          <BookOpen :size="16" />
          科普文章
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'knowledge' }"
          @click="emit('select-admin', 'knowledge')"
        >
          <FileText :size="16" />
          知识库
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'announcements' }"
          @click="emit('select-admin', 'announcements')"
        >
          <MessageCircle :size="16" />
          系统公告
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'push' }"
          @click="emit('select-admin', 'push')"
        >
          <Megaphone :size="16" />
          通知推送
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'sensitive' }"
          @click="emit('select-admin', 'sensitive')"
        >
          <ShieldAlert :size="16" />
          敏感词词库
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'feedbacks' }"
          @click="emit('select-admin', 'feedbacks')"
        >
          <Inbox :size="16" />
          反馈工单
        </button>
        <button
          :class="{ active: active === 'admin' && adminSection === 'logs' }"
          @click="emit('select-admin', 'logs')"
        >
          <History :size="16" />
          操作日志
        </button>
      </div>
    </nav>
    <div class="side-note">
      <ShieldCheck :size="17" />
      你的对话仅用于提供陪伴服务，请放心表达。
    </div>
    <button class="logout" @click="emit('logout')">
      <LogOut :size="17" />
      退出登录
    </button>
  </aside>
</template>