<script setup>
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ChevronDown,
  FileText,
  LogOut,
  MessageCircle,
  NotebookPen,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-vue-next';
import { ref, watch } from 'vue';

const props = defineProps({
  active: { type: String, required: true },
  adminSection: { type: String, default: 'overview' },
  open: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
});
const emit = defineEmits(['select', 'select-admin', 'close', 'logout']);
const adminExpanded = ref(props.active === 'admin');

watch(() => props.active, (value) => {
  if (value !== 'admin') {
    adminExpanded.value = false;
  }
});

function toggleAdmin() {
  adminExpanded.value = !adminExpanded.value;
}
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand"><div class="brand-mark"><Sparkles :size="18" /></div><div><strong>MindHarbor</strong><small>心理健康助手</small></div><button class="icon mobile-close" @click="emit('close')"><X :size="18" /></button></div>
    <nav>
      <button :class="{ active: active === 'chat' }" @click="emit('select', 'chat')"><MessageCircle :size="18" />对话陪伴</button>
      <button :class="{ active: active === 'assessment' }" @click="emit('select', 'assessment')"><ClipboardCheck :size="18" />心理测评</button>
      <button :class="{ active: active === 'articles' }" @click="emit('select', 'articles')"><BookOpen :size="18" />心理科普</button>
      <button :class="{ active: active === 'diary' }" @click="emit('select', 'diary')"><NotebookPen :size="18" />情绪日记</button>
      <button
        v-if="isAdmin"
        class="admin-nav-toggle"
        :class="{ active: active === 'admin' }"
        :aria-expanded="adminExpanded"
        @click="toggleAdmin"
      >
        <ShieldCheck :size="18" />
        <span>管理后台</span>
        <ChevronDown class="admin-nav-caret" :class="{ expanded: adminExpanded }" :size="15" />
      </button>
      <div v-if="isAdmin && adminExpanded" class="admin-subnav">
        <button :class="{ active: active === 'admin' && adminSection === 'overview' }" @click="emit('select-admin', 'overview')"><BarChart3 :size="16" />数据概览</button>
        <button :class="{ active: active === 'admin' && adminSection === 'users' }" @click="emit('select-admin', 'users')"><Users :size="16" />用户管理</button>
        <button :class="{ active: active === 'admin' && adminSection === 'scales' }" @click="emit('select-admin', 'scales')"><Scale :size="16" />测评量表</button>
        <button :class="{ active: active === 'admin' && adminSection === 'articles' }" @click="emit('select-admin', 'articles')"><BookOpen :size="16" />科普文章</button>
        <button :class="{ active: active === 'admin' && adminSection === 'knowledge' }" @click="emit('select-admin', 'knowledge')"><FileText :size="16" />知识库</button>
        <button :class="{ active: active === 'admin' && adminSection === 'announcements' }" @click="emit('select-admin', 'announcements')"><MessageCircle :size="16" />系统公告</button>
      </div>
    </nav>
    <div class="side-note"><ShieldCheck :size="17" />你的对话仅用于提供陪伴服务，请放心表达。</div>
    <button class="logout" @click="emit('logout')"><LogOut :size="17" />退出登录</button>
  </aside>
</template>
